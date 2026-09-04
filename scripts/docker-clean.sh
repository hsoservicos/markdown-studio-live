#!/usr/bin/env bash
#
# docker-clean.sh — Limpeza completa de containers e imagens Docker
#
# Remove: containers parados, imagens dangling, volumes órfãos, cache de build
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_NAME="markdown-studio"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

log_info() { echo -e "${CYAN}[INFO]${NC} $*"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Markdown-Studio Docker Clean${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""

# Espaço antes da limpeza
log_info "Espaço Docker ANTES:"
docker system df
echo ""

# ── 1. Containers do projeto ──────────────────────────────
log_info "1/5 Parando containers do projeto..."
cd "$PROJECT_DIR"
docker compose down --rmi local --volumes 2>/dev/null || true
docker compose -f compose.dev.yaml down --rmi local --volumes 2>/dev/null || true
log_ok "Containers do projeto removidos"

# ── 2. Containers órfãos ──────────────────────────────────
log_info "2/5 Removendo containers parados..."
STOPPED=$(docker ps -aq --filter "status=exited" --filter "status=dead" | wc -l)
if [ "$STOPPED" -gt 0 ]; then
  docker rm $(docker ps -aq --filter "status=exited" --filter "status=dead") 2>/dev/null || true
  log_ok "${STOPPED} containers removidos"
else
  log_ok "Nenhum container parado encontrado"
fi

# ── 3. Imagens dangling ──────────────────────────────────
log_info "3/5 Removendo imagens dangling..."
DANGLING=$(docker images -q --filter "dangling=true" | wc -l)
if [ "$DANGLING" -gt 0 ]; then
  docker rmi $(docker images -q --filter "dangling=true") 2>/dev/null || true
  log_ok "${DANGLING} imagens dangling removidas"
else
  log_ok "Nenhuma imagem dangling encontrada"
fi

# ── 4. Volumes órfãos ───────────────────────────────────
log_info "4/5 Removendo volumes órfãos..."
ORPHAN_VOLUMES=$(docker volume ls -q --filter "dangling=true" | wc -l)
if [ "$ORPHAN_VOLUMES" -gt 0 ]; then
  docker volume rm $(docker volume ls -q --filter "dangling=true") 2>/dev/null || true
  log_ok "${ORPHAN_VOLUMES} volumes órfãos removidos"
else
  log_ok "Nenhum volume órfão encontrado"
fi

# ── 5. Cache de build ───────────────────────────────────
log_info "5/5 Limpando cache de build..."
docker builder prune -f 2>/dev/null || true
log_ok "Cache de build limpo"

# ── Resultado ─────────────────────────────────────────────
echo ""
log_info "Espaço Docker DEPOIS:"
docker system df
echo ""
echo -e "${GREEN}✓ Limpeza concluída!${NC}"
