#!/usr/bin/env bash
#
# docker.sh — Gerenciamento Docker do Markdown-Studio
#
# Uso: ./scripts/docker.sh <comando> [opções]
#
# Comandos:
#   build       Build da imagem de produção
#   up          Sobe container em background
#   down        Para e remove container
#   restart     Reinicia container
#   logs        Mostra logs em tempo real
#   ps          Mostra status dos containers
#   status      Mostra status detalhado (health, portas, imagem)
#   shell       Abre shell no container (sh)
#   audit       Roda auditoria completa (build+health+headers)
#   clean       Remove imagens, containers e volumes órfãos
#   dev         Sobe container de desenvolvimento
#   dev-down    Para container de desenvolvimento
#   help        Mostra esta ajuda
#

set -euo pipefail

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuração
PROJECT_NAME="markdown-studio"
IMAGE_NAME="${PROJECT_NAME}:local"
CONTAINER_NAME="${PROJECT_NAME}"
HOST_PORT="${PORT:-5001}"
CONTAINER_PORT=80
DEV_PORT=5173

# Diretório do projeto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $*"; }

check_docker() {
  if ! command -v docker &>/dev/null; then
    log_error "Docker não encontrado. Instale: https://docs.docker.com/get-docker/"
    exit 1
  fi
  if ! docker info &>/dev/null 2>&1; then
    log_error "Docker daemon não está rodando."
    exit 1
  fi
}

cmd_build() {
  log_step "Build da imagem ${IMAGE_NAME}..."
  cd "$PROJECT_DIR"
  docker compose build "$@"
  log_ok "Build concluído."
}

cmd_up() {
  log_step "Sobe container ${CONTAINER_NAME}..."
  cd "$PROJECT_DIR"
  docker compose up -d "$@"
  log_ok "Container rodando em http://localhost:${HOST_PORT}"
  log_info "Aguardando healthcheck..."
  sleep 5
  cmd_ps
}

cmd_down() {
  log_step "Para e remove container..."
  cd "$PROJECT_DIR"
  docker compose down "$@"
  log_ok "Container removido."
}

cmd_restart() {
  log_step "Reinicia container..."
  cmd_down
  cmd_up
}

cmd_logs() {
  cd "$PROJECT_DIR"
  docker compose logs -f "$@"
}

cmd_ps() {
  cd "$PROJECT_DIR"
  docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
}

cmd_status() {
  log_step "Status detalhado do container..."
  cd "$PROJECT_DIR"

  echo ""
  echo -e "${CYAN}=== Containers ===${NC}"
  docker compose ps

  echo ""
  echo -e "${CYAN}=== Health ===${NC}"
  local health
  health=$(docker inspect "$CONTAINER_NAME" --format='{{.State.Health.Status}}' 2>/dev/null || echo "não encontrado")
  echo -e "Status: ${health}"

  echo ""
  echo -e "${CYAN}=== Portas ===${NC}"
  docker port "$CONTAINER_NAME" 2>/dev/null || echo "Nenhuma porta mapeada"

  echo ""
  echo -e "${CYAN}=== Imagem ===${NC}"
  docker images "$IMAGE_NAME" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

  echo ""
  echo -e "${CYAN}=== Teste HTTP ===${NC}"
  if curl -sf "http://localhost:${HOST_PORT}/" >/dev/null 2>&1; then
    log_ok "HTTP 200 em http://localhost:${HOST_PORT}"
  else
    log_warn "Não foi possível acessar http://localhost:${HOST_PORT}"
  fi
}

cmd_shell() {
  log_step "Abrindo shell no container..."
  docker exec -it "$CONTAINER_NAME" sh
}

cmd_audit() {
  log_step "Auditoria completa do Docker..."
  echo ""

  # 1. Build
  log_step "1/5 Build..."
  cmd_build
  echo ""

  # 2. Container rodando
  log_step "2/5 Subindo container..."
  cmd_up
  echo ""

  # 3. Healthcheck
  log_step "3/5 Verificando healthcheck..."
  local max_wait=30
  local waited=0
  while [ $waited -lt $max_wait ]; do
    local health
    health=$(docker inspect "$CONTAINER_NAME" --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
    if [ "$health" = "healthy" ]; then
      log_ok "Healthcheck: healthy"
      break
    fi
    sleep 2
    waited=$((waited + 2))
  done
  if [ "$health" != "healthy" ]; then
    log_warn "Healthcheck não ficou healthy em ${max_wait}s (status: ${health})"
  fi
  echo ""

  # 4. Headers de segurança
  log_step "4/5 Verificando headers de segurança..."
  local headers
  headers=$(curl -sI "http://localhost:${HOST_PORT}/" 2>/dev/null)

  local required_headers=(
    "X-Content-Type-Options"
    "X-Frame-Options"
    "X-XSS-Protection"
    "Referrer-Policy"
    "Content-Security-Policy"
  )

  for header in "${required_headers[@]}"; do
    if echo "$headers" | grep -qi "$header"; then
      log_ok "$header presente"
    else
      log_warn "$header AUSENTE"
    fi
  done
  echo ""

  # 5. Tamanho da imagem
  log_step "5/5 Tamanho da imagem..."
  local size
  size=$(docker images "$IMAGE_NAME" --format '{{.Size}}' | head -1)
  log_ok "Tamanho: ${size}"
  echo ""

  log_ok "Auditoria concluída!"
  cmd_down
}

cmd_clean() {
  log_step "Limpeza completa..."
  cd "$PROJECT_DIR"

  log_step "Parando containers..."
  docker compose down --rmi local --volumes 2>/dev/null || true
  docker compose -f compose.dev.yaml down --rmi local --volumes 2>/dev/null || true

  log_step "Removendo containers órfãos..."
  docker rm -f $(docker ps -aq --filter "name=${PROJECT_NAME}") 2>/dev/null || true

  log_step "Removendo imagens órfãas..."
  docker rmi -f $(docker images -q --filter "dangling=true") 2>/dev/null || true

  log_step "Limpando cache de build..."
  docker builder prune -f 2>/dev/null || true

  log_ok "Limpeza concluída."
  echo ""
  echo -e "${CYAN}Espaço Docker:${NC}"
  docker system df
}

cmd_dev() {
  log_step "Sobe container de desenvolvimento..."
  cd "$PROJECT_DIR"
  docker compose -f compose.dev.yaml up -d "$@"
  log_ok "Dev server rodando em http://localhost:${DEV_PORT}"
}

cmd_dev_down() {
  log_step "Para container de desenvolvimento..."
  cd "$PROJECT_DIR"
  docker compose -f compose.dev.yaml down "$@"
  log_ok "Dev server parado."
}

cmd_help() {
  cat <<EOF
${CYAN}Markdown-Studio Docker Manager${NC}

Uso: $(basename "$0") <comando> [opções]

${GREEN}Comandos de produção:${NC}
  build [args]      Build da imagem de produção
  up [args]         Sobe container em background
  down [args]       Para e remove container
  restart           Reinicia container
  logs [args]       Mostra logs em tempo real
  ps                Mostra status dos containers
  status            Mostra status detalhado
  shell             Abre shell no container
  audit             Roda auditoria completa

${GREEN}Comandos de desenvolvimento:${NC}
  dev               Sobe container de dev (hot-reload)
  dev-down          Para container de dev

${GREEN}Comandos de manutenção:${NC}
  clean             Remove imagens, containers e volumes órfãos
  help              Mostra esta ajuda

${GREEN}Variáveis de ambiente:${NC}
  PORT              Porta do host (padrão: 5001)

${GREEN}Exemplos:${NC}
  $(basename "$0") build
  $(basename "$0") up
  $(basename "$0") audit
  PORT=8080 $(basename "$0") up
  $(basename "$0") dev
EOF
}

# Main
check_docker

case "${1:-help}" in
  build)     shift; cmd_build "$@" ;;
  up)        shift; cmd_up "$@" ;;
  down)      shift; cmd_down "$@" ;;
  restart)   cmd_restart ;;
  logs)      shift; cmd_logs "$@" ;;
  ps)        cmd_ps ;;
  status)    cmd_status ;;
  shell)     cmd_shell ;;
  audit)     cmd_audit ;;
  clean)     cmd_clean ;;
  dev)       shift; cmd_dev "$@" ;;
  dev-down)  shift; cmd_dev_down "$@" ;;
  help|--help|-h) cmd_help ;;
  *)
    log_error "Comando desconhecido: $1"
    echo ""
    cmd_help
    exit 1
    ;;
esac
