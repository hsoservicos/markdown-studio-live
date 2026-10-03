#!/usr/bin/env bash
#
# docker-audit.sh — Auditoria completa do container Docker
#
# Valida: build, healthcheck, headers, SPA fallback, assets, segurança
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_NAME="markdown-studio"
IMAGE_NAME="${PROJECT_NAME}:local"
CONTAINER_NAME="${PROJECT_NAME}"
HOST_PORT="${PORT:-5001}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

PASSED=0
FAILED=0
WARNED=0

pass() { echo -e "  ${GREEN}✓${NC} $*"; PASSED=$((PASSED + 1)); }
fail() { echo -e "  ${RED}✗${NC} $*"; FAILED=$((FAILED + 1)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $*"; WARNED=$((WARNED + 1)); }
info() { echo -e "  ${BLUE}ℹ${NC} $*"; }

echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Markdown-Studio Docker Audit${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""

# ── 1. Build ──────────────────────────────────────────────
echo -e "${CYAN}▸ Build${NC}"
cd "$PROJECT_DIR"
if docker build -t "$IMAGE_NAME" . >/dev/null 2>&1; then
  pass "Build da imagem $IMAGE_NAME"
else
  fail "Build da imagem $IMAGE_NAME"
fi

# ── 2. Start container ────────────────────────────────────
echo ""
echo -e "${CYAN}▸ Container${NC}"
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
if docker run -d --name "$CONTAINER_NAME" -p "${HOST_PORT}:80" \
    --read-only --tmpfs /var/cache/nginx:rw,mode=1777 --tmpfs /var/run:rw,mode=1777 \
    --security-opt no-new-privileges "$IMAGE_NAME" >/dev/null 2>&1; then
  pass "Container iniciado"
else
  fail "Container não iniciou"
  echo -e "\nResultado: ${RED}FALHOU${NC}"
  exit 1
fi

# ── 3. Healthcheck ────────────────────────────────────────
echo ""
echo -e "${CYAN}▸ Healthcheck${NC}"
info "Aguardando healthcheck (máx 30s)..."
MAX_WAIT=30
WAITED=0
HEALTH="unknown"
while [ $WAITED -lt $MAX_WAIT ]; do
  HEALTH=$(docker inspect "$CONTAINER_NAME" --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
  if [ "$HEALTH" = "healthy" ]; then
    pass "Healthcheck: healthy"
    break
  fi
  sleep 2
  WAITED=$((WAITED + 2))
done
if [ "$HEALTH" != "healthy" ]; then
  fail "Healthcheck não ficou healthy (${HEALTH})"
fi

# ── 4. HTTP Response ──────────────────────────────────────
echo ""
echo -e "${CYAN}▸ HTTP${NC}"
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${HOST_PORT}/" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  pass "HTTP 200 em /"
else
  fail "HTTP ${HTTP_CODE} em /"
fi

# ── 5. SPA Fallback ───────────────────────────────────────
echo ""
echo -e "${CYAN}▸ SPA Fallback${NC}"
SPA_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${HOST_PORT}/some/deep/route" 2>/dev/null || echo "000")
if [ "$SPA_CODE" = "200" ]; then
  pass "SPA fallback (/some/deep/route → 200)"
else
  fail "SPA fallback não funciona (${SPA_CODE})"
fi

# ── 6. Security Headers ──────────────────────────────────
echo ""
echo -e "${CYAN}▸ Security Headers${NC}"
HEADERS=$(curl -sI "http://localhost:${HOST_PORT}/" 2>/dev/null)

check_header() {
  local name="$1"
  if echo "$HEADERS" | grep -qi "^${name}:"; then
    local value
    value=$(echo "$HEADERS" | grep -i "^${name}:" | head -1 | cut -d: -f2- | xargs)
    pass "$name: $value"
  else
    fail "$name AUSENTE"
  fi
}

check_header "X-Content-Type-Options"
check_header "X-Frame-Options"
check_header "X-XSS-Protection"
check_header "Referrer-Policy"
check_header "Content-Security-Policy"

# ── 7. Server Tokens ─────────────────────────────────────
echo ""
echo -e "${CYAN}▸ Server Tokens${NC}"
SERVER_HEADER=$(echo "$HEADERS" | grep -i "^Server:" | head -1)
if echo "$SERVER_HEADER" | grep -qi "nginx/[0-9]"; then
  warn "Server header expõe versão nginx (server_tokens off não efetivo?)"
else
  pass "Server header não expõe versão"
fi

# ── 8. Sensitive Files ───────────────────────────────────
echo ""
echo -e "${CYAN}▸ Arquivos Sensíveis${NC}"
for file in ".env" ".git/config" ".htaccess" "package.json"; do
  # SPA fallback devolve 200 + index.html para qualquer path: o criterio e o
  # CONTEUDO nao ser o arquivo real, nao o codigo HTTP.
  BODY=$(curl -s "http://localhost:${HOST_PORT}/${file}" 2>/dev/null || echo "")
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${HOST_PORT}/${file}" 2>/dev/null || echo "000")
  if [ "$CODE" = "403" ] || [ "$CODE" = "404" ]; then
    pass "/${file} bloqueado (${CODE})"
  elif echo "$BODY" | head -c 400 | grep -qE '"name"\s*:\s*"markdown-studio"|MARKDOWNSTUDIO|__COOLIFY'; then
    fail "/${file} vazou conteudo real (${CODE})"
  else
    pass "/${file} nao exposto (SPA fallback, ${CODE})"
  fi
done

# ── 9. Assets Cache ──────────────────────────────────────
echo ""
echo -e "${CYAN}▸ Asset Cache${NC}"
INDEX_HEADERS=$(curl -sI "http://localhost:${HOST_PORT}/" 2>/dev/null)
if echo "$INDEX_HEADERS" | grep -qi "Cache-Control:.*no-store"; then
  pass "index.html com Cache-Control: no-store (anti tela branca pos-deploy)"
elif echo "$INDEX_HEADERS" | grep -qi "Cache-Control"; then
  fail "index.html com Cache-Control sem no-store: $(echo "$INDEX_HEADERS" | grep -i '^Cache-Control:' | head -1 | cut -d: -f2- | xargs)"
else
  fail "index.html SEM Cache-Control (risco de HTML velho pos-deploy)"
fi

# 3b. Assets carregam os MESMOS headers de seguranca do documento (heranca nginx)?
#     add_header dentro de location cancela a heranca do server — regressao classica.
ASSET=$(curl -s "http://localhost:${HOST_PORT}/" | grep -oE '/assets/[^"]+\.js' | head -1 || true)
if [ -n "$ASSET" ]; then
  ASSET_HEADERS=$(curl -sI "http://localhost:${HOST_PORT}${ASSET}" 2>/dev/null || echo "")
  MISSING=""
  for h in Content-Security-Policy X-Content-Type-Options X-Frame-Options Referrer-Policy Strict-Transport-Security; do
    echo "$ASSET_HEADERS" | grep -qi "^${h}:" || MISSING="${MISSING} ${h}"
  done
  if [ -z "$MISSING" ]; then
    pass "Asset ${ASSET} herda todos os headers de seguranca"
  else
    fail "Asset ${ASSET} SEM:${MISSING}"
  fi
  CC_COUNT=$(echo "$ASSET_HEADERS" | grep -ci "^Cache-Control:" || true)
  if [ "$CC_COUNT" -le 1 ]; then
    pass "Asset com Cache-Control unico (${CC_COUNT})"
  else
    fail "Asset com ${CC_COUNT} cabeçalhos Cache-Control conflitantes"
  fi
else
  warn "Nenhum /assets/*.js encontrado para auditar"
fi

# ── 10. Image Size ───────────────────────────────────────
echo ""
echo -e "${CYAN}▸ Imagem${NC}"
IMAGE_SIZE=$(docker images "$IMAGE_NAME" --format '{{.Size}}' | head -1)
info "Tamanho: ${IMAGE_SIZE}"
PASSED=$((PASSED + 1))

# ── 11. Running as non-root ──────────────────────────────
echo ""
echo -e "${CYAN}▸ Segurança do Container${NC}"
USER_ID=$(docker exec "$CONTAINER_NAME" id -u 2>/dev/null || echo "0")
if [ "$USER_ID" != "0" ]; then
  pass "Rodando como non-root (UID: ${USER_ID})"
else
  warn "Rodando como root"
fi

READ_ONLY=$(docker inspect "$CONTAINER_NAME" --format='{{.HostConfig.ReadonlyRootfs}}' 2>/dev/null || echo "false")
if [ "$READ_ONLY" = "true" ]; then
  pass "Root filesystem read-only"
else
  warn "Root filesystem não é read-only"
fi

# ── Resultado ─────────────────────────────────────────────
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Resultado${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}✓ Passou: ${PASSED}${NC}"
echo -e "  ${YELLOW}⚠ Avisos: ${WARNED}${NC}"
echo -e "  ${RED}✗ Falhou: ${FAILED}${NC}"
echo ""

# Cleanup
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ Auditoria aprovada!${NC}"
  exit 0
else
  echo -e "${RED}✗ Auditoria com falhas.${NC}"
  exit 1
fi
