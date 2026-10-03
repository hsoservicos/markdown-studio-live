#!/usr/bin/env bash
#
# deploy-audit.sh — Auditoria da cadeia de deploy automático (GitHub → CI → Coolify → produção)
#
# Valida as condições operacionais que fazem o push em `main` virar release em produção:
# webhook configurado nos dois lados, branch protegida, último deploy origem=webhook,
# container saudável, produção servindo e postura de seguranca do Coolify.
#
# Uso: npm run deploy:audit
# Requer: gh (autenticado), git, curl. O check de fila/segurança do Coolify usa
# `docker exec` e e pulado (warn) se o container nao for encontrado.
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

REPO="${GITHUB_REPOSITORY:-hsoservicos/markdown-studio-live}"
PROD_URL="${PROD_URL:-https://mkdeditor.appservice.tec.br}"
BRANCH="${BRANCH:-main}"
# F4: identificadores do ambiente sao configuraveis — os defaults refletem a
# instalacao atual e nao devem estar hardcoded no meio do script.
HOOK_ID="${COOLIFY_WEBHOOK_ID:-689753727}"
DB_CONTAINER="${COOLIFY_DB_CONTAINER:-coolify-db}"
APP_ID="${COOLIFY_APP_ID:-4}"
APP_CONTAINER="${COOLIFY_APP_CONTAINER:-fcvi93cp8n4nbydbjyvbnk92}"

# F4: sem o binario docker o contrato e warn-and-skip — nao abortar no meio e
# sumir com o resumo (as secoes de container/fila sao puladas).
HAS_DOCKER=0
if command -v docker >/dev/null 2>&1; then
  HAS_DOCKER=1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

PASSED=0
FAILED=0
WARNED=0

pass() { echo -e "  ${GREEN}✓${NC} $*"; PASSED=$((PASSED + 1)); }
fail() { echo -e "  ${RED}✗${NC} $*"; FAILED=$((FAILED + 1)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $*"; WARNED=$((WARNED + 1)); }
info() { echo -e "  ${BLUE}ℹ${NC} $*"; }
sect() { echo -e "\n${CYAN}▸ $*${NC}"; }

# expoe apenas o path da URL, nunca o host (o dominio do painel nao vai para o repo)
mask_url() {
  local u="$1"
  printf '%s' "$u" | sed -E 's#^https?://[^/]+#<host>#'
}

echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Markdown-Studio · Deploy Chain Audit${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"

cd "$PROJECT_DIR"

# ── 1. Git sincronizado ───────────────────────────────────
sect "Git"
if HEAD_LOCAL=$(git rev-parse HEAD 2>/dev/null) && HEAD_REMOTE=$(git rev-parse "origin/$BRANCH" 2>/dev/null); then
  if [ "$HEAD_LOCAL" = "$HEAD_REMOTE" ]; then
    pass "local = origin/$BRANCH ($(printf '%s' "$HEAD_LOCAL" | cut -c1-7))"
  else
    fail "local ($(printf '%s' "$HEAD_LOCAL" | cut -c1-7)) != origin/$BRANCH ($(printf '%s' "$HEAD_REMOTE" | cut -c1-7)) — git pull"
  fi
  if [ -z "$(git status --porcelain)" ]; then
    pass "working tree limpo"
  else
    warn "working tree sujo — commits pendentes não chegam em produção"
  fi
else
  fail "sem acesso ao remoto (git fetch origin)"
  HEAD_REMOTE=""
fi

# ── 2. Webhook no GitHub ──────────────────────────────────
sect "Webhook (GitHub)"
if command -v gh >/dev/null 2>&1; then
  if HOOK_JSON=$(gh api "repos/$REPO/hooks/$HOOK_ID" 2>/dev/null); then
    pass "hook id=$HOOK_ID existe"
    ACTIVE=$(printf '%s' "$HOOK_JSON" | jq -r '.active // empty' 2>/dev/null || echo "")
    EVENTS=$(printf '%s' "$HOOK_JSON" | jq -r '.events // [] | join(",")' 2>/dev/null || echo "")
    CTYPE=$(printf '%s' "$HOOK_JSON" | jq -r '.config.content_type // empty' 2>/dev/null || echo "")
    URL=$(printf '%s' "$HOOK_JSON" | jq -r '.config.url // empty' 2>/dev/null || echo "")
    if [ "$ACTIVE" = "true" ]; then pass "hook ativo"; else fail "hook inativo (active=${ACTIVE:-vazio})"; fi
    if printf '%s' "$EVENTS" | grep -q 'push'; then pass "evento: push"; else fail "evento esperado push (recebido: $EVENTS)"; fi
    if [ "$CTYPE" = "application/json" ]; then pass "content-type: application/json"; else fail "content-type: ${CTYPE:-vazio}"; fi
    info "url: $(mask_url "${URL:-?}")"
    LAST=$(gh api "repos/$REPO/hooks/$HOOK_ID/deliveries" --jq '.[0] | "\(.status) \(.event) \(.delivered_at)"' 2>/dev/null || echo "?")
    info "ultima entrega: $LAST"
    # Gotcha: o Coolify responde HTTP 200 ate para "Invalid signature", entao o
    # GitHub marca "OK" mesmo quando a entrega foi recusada. O sinal real de
    # aceite e a fila de deploys com origem=webhook (secao Deploy).
    if printf '%s' "$LAST" | grep -q "^OK"; then
      pass "ultima entrega GitHub = OK"
    else
      warn "ultima entrega não-OK — veja 'Recent Deliveries' no GitHub"
    fi
  else
    fail "hook id=$HOOK_ID não encontrado em $REPO"
  fi

  # ── 3. Proteção da branch (gate do que chega em main) ──
  sect "Proteção de $BRANCH"
  if PROT_JSON=$(gh api "repos/$REPO/branches/$BRANCH/protection" 2>/dev/null); then
    CTX=$(printf '%s' "$PROT_JSON" | jq -r '.required_status_checks.contexts // [] | join(",")' 2>/dev/null || echo "")
    STRICT=$(printf '%s' "$PROT_JSON" | jq -r '.required_status_checks.strict // false' 2>/dev/null || echo "false")
    ENF=$(printf '%s' "$PROT_JSON" | jq -r '.enforce_admins.enabled // false' 2>/dev/null || echo "false")
    PRS=$(printf '%s' "$PROT_JSON" | jq -r '.required_pull_request_reviews != null' 2>/dev/null || echo "false")
    if printf '%s' "$CTX" | grep -q 'quality'; then pass "check exigido: quality"; else fail "check exigido ausente (ctx: $CTX)"; fi
    if [ "$STRICT" = "true" ]; then pass "strict (branch precisa estar atualizada)"; else warn "strict desligado"; fi
    if [ "$ENF" = "true" ]; then pass "enforce_admins (sem bypass)"; else warn "enforce_admins desligado"; fi
    if [ "$PRS" = "true" ]; then pass "PR obrigatório"; else warn "PR obrigatório ausente"; fi
  else
    warn "sem permissão para ler proteção da branch"
  fi
else
  warn "gh ausente — checks de webhook/proteção pulados"
fi

# ── 4. Último deploy (Coolify) ────────────────────────────
sect "Deploy (Coolify)"
# Postgres emite 't'/'f' para coluna crua e 'true'/'false' concatenada com texto.
is_true() { [ "${1:-}" = "t" ] || [ "${1:-}" = "true" ]; }
is_false() { [ "${1:-}" = "f" ] || [ "${1:-}" = "false" ]; }

if [ "$HAS_DOCKER" = "0" ]; then
  warn "docker indisponivel — checks de fila/deploy no Coolify pulados"
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$DB_CONTAINER"; then
  QUEUE=$(docker exec "$DB_CONTAINER" psql -U coolify -d coolify -t -A -F'|' -c \
    "select id||'|'||status||'|'||is_webhook||'|'||substr(commit,1,7) from application_deployment_queues where application_id='$APP_ID' order by id desc limit 1;" 2>/dev/null || echo "")
  if [ -n "$QUEUE" ]; then
    IFS='|' read -r DEP_ID DEP_STATUS DEP_WEBHOOK DEP_COMMIT <<<"$QUEUE"
    if is_true "$DEP_WEBHOOK"; then ORIGIN="webhook"; else ORIGIN="manual"; fi
    pass "deploy #$DEP_ID status=$DEP_STATUS origem=$ORIGIN commit=$DEP_COMMIT"
    if [ "$DEP_STATUS" = "finished" ]; then pass "deploy concluído"; else fail "deploy não concluído (status=$DEP_STATUS)"; fi
    if is_true "$DEP_WEBHOOK"; then pass "origem = webhook (automático)"; else warn "origem manual — a cadeia automática não foi a fonte"; fi
    if [ -n "$HEAD_REMOTE" ] && printf '%s' "$HEAD_REMOTE" | grep -q "^$DEP_COMMIT"; then
      pass "deploy = HEAD de $BRANCH"
    elif [ -n "$HEAD_REMOTE" ]; then
      fail "deploy ($DEP_COMMIT) != HEAD ($(printf '%s' "$HEAD_REMOTE" | cut -c1-7)) — push sem deploy?"
    fi
    PENDING=$(docker exec "$DB_CONTAINER" psql -U coolify -d coolify -t -A -c \
      "select count(*) from application_deployment_queues where application_id='$APP_ID' and status in ('queued','in_progress');" 2>/dev/null || echo 0)
    if [ "${PENDING:-0}" = "0" ]; then pass "nenhum deploy preso na fila"; else warn "$PENDING deploy(s) em fila"; fi
    # Historico de falhas: o audit ja falha se o ULTIMO deploy falhou (acima);
    # aqui apenas expoe falhas antigas, que continuam registradas para sempre.
    HIST_FAIL=$(docker exec "$DB_CONTAINER" psql -U coolify -d coolify -t -A -c \
      "select count(*) from application_deployment_queues where application_id='$APP_ID' and status='failed';" 2>/dev/null || echo 0)
    if [ "${HIST_FAIL:-0}" = "0" ]; then
      pass "historico de deploys sem falhas"
    else
      warn "$HIST_FAIL deploy(s) antigo(s) com falha no historico (o ultimo ja e verificado acima)"
    fi
    # Alerta de falha: notificacao habilitada NAO basta — precisa de transporte
    # configurado, senao a falha de deploy passa em silencio e producao fica
    # na versao antiga sem aviso (fica para sempre, ninguem percebe).
    NOTIF=$(docker exec "$DB_CONTAINER" psql -U coolify -d coolify -t -A -c \
      "select coalesce(
         (select 'email'    from email_notification_settings    where smtp_enabled  and deployment_failure_email_notifications),
         (select 'telegram' from telegram_notification_settings where telegram_enabled and deployment_failure_telegram_notifications),
         (select 'discord'  from discord_notification_settings  where discord_enabled and deployment_failure_discord_notifications),
         (select 'slack'    from slack_notification_settings    where slack_enabled and deployment_failure_slack_notifications),
         (select 'webhook'  from webhook_notification_settings  where webhook_enabled and deployment_failure_webhook_notifications),
         (select 'pushover' from pushover_notification_settings where pushover_enabled and deployment_failure_pushover_notifications),
         'nenhum');" 2>/dev/null || echo "?")
    case "$NOTIF" in
      "")     warn "nao consegui ler os canais de notificacao" ;;
      "?")    warn "nao consegui ler os canais de notificacao" ;;
      "nenhum") fail "nenhum canal de alerta de FALHA de deploy ativo (falha real ficaria silenciosa)" ;;
      *)      pass "alerta de falha de deploy via $NOTIF" ;;
    esac
    # API desabilitada: o deploy só pode nascer do webhook, nunca de um token.
    API_ON=$(docker exec "$DB_CONTAINER" psql -U coolify -d coolify -t -A -c \
      "select is_api_enabled from instance_settings;" 2>/dev/null || echo "")
    TOKENS=$(docker exec "$DB_CONTAINER" psql -U coolify -d coolify -t -A -c \
      "select count(*) from personal_access_tokens;" 2>/dev/null || echo "?")
    if is_false "$API_ON"; then pass "API do Coolify desabilitada"; elif [ -z "$API_ON" ]; then warn "não consegui ler is_api_enabled"; else fail "API do Coolify HABILITADA (is_api_enabled=$API_ON)"; fi
    if [ "$TOKENS" = "0" ]; then pass "0 tokens pessoais no Coolify"; else fail "$TOKENS token(s) presente(s) no Coolify"; fi
  else
    fail "nenhum deploy registrado para a aplicação"
  fi
else
  warn "container $DB_CONTAINER não encontrado — checks de fila/segurança pulados"
fi

# ── 5. Container da aplicação ─────────────────────────────
sect "Container de produção"
# F4: `set -e` + pipefail abortava o script aqui quando o docker faltava (a
# substituição falhava e o resumo nunca saía). Contrato: warn-and-skip.
APP_CT=""
if [ "$HAS_DOCKER" = "1" ]; then
  APP_CT=$(docker ps --filter "name=$APP_CONTAINER" --format '{{.Names}}' 2>/dev/null | head -1 || true)
fi
if [ "$HAS_DOCKER" = "0" ]; then
  warn "docker indisponível — checks de container pulados"
elif [ -n "$APP_CT" ]; then
  STATUS=$(docker inspect --format '{{.State.Status}}' "$APP_CT" 2>/dev/null || echo "?")
  HEALTH=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}sem-healthcheck{{end}}' "$APP_CT" 2>/dev/null || echo "?")
  if [ "$STATUS" = "running" ]; then pass "container running ($APP_CT)"; else fail "container status=$STATUS"; fi
  if [ "$HEALTH" = "healthy" ]; then pass "healthcheck healthy"; else fail "healthcheck=$HEALTH"; fi
else
  fail "container da aplicação não encontrado"
fi

# ── 6. Produção respondendo ───────────────────────────────
sect "Produção ($PROD_URL)"
CODE=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$PROD_URL/" 2>/dev/null || echo "000")
if [ "$CODE" = "200" ]; then pass "GET / -> 200"; else fail "GET / -> $CODE"; fi
ASSET=$(curl -s -m 15 "$PROD_URL/" 2>/dev/null | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1 || echo "")
if [ -n "$ASSET" ]; then
  pass "serve bundle: ${ASSET#/assets/}"
  if [ -f "dist${ASSET}" ]; then
    pass "bundle idêntico ao build local"
  else
    info "build local não contém ${ASSET#/assets/} (rode npm run build para comparar)"
  fi
else
  warn "não consegui extrair o bundle do HTML servido"
fi

# ── Resultado ─────────────────────────────────────────────
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}pass: $PASSED${NC}  ${RED}fail: $FAILED${NC}  ${YELLOW}warn: $WARNED${NC}"
if [ "$FAILED" -eq 0 ]; then
  echo -e "  ${GREEN}CADEIA DE DEPLOY OPERACIONAL${NC}"
else
  echo -e "  ${RED}CADEIA DE DEPLOY COM FALHA${NC}"
fi
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"

[ "$FAILED" -eq 0 ]
