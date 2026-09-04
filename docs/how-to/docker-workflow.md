# How-to: Docker no Markdown-Studio

Guia completo de como construir, rodar, auditar e manter o Markdown-Studio como container Docker.

## Visão geral

O Markdown-Studio é um app 100% client-side (estático): editor Monaco + render no
browser, persistência em `localStorage`. O container serve apenas os artefatos do build (`dist/`).

## Artefatos

| Artefato                  | Papel                                                            |
| ------------------------- | ---------------------------------------------------------------- |
| `Dockerfile`              | Build multi-stage (deps→builder→runtime nginx) com USER non-root |
| `Dockerfile.dev`          | Container de desenvolvimento com hot-reload (Vite)               |
| `compose.yaml`            | Produção: porta 5001, healthcheck, security, resource limits     |
| `compose.dev.yaml`        | Desenvolvimento: volumes mountados, hot-reload                   |
| `nginx.conf`              | Config produção (SPA fallback, gzip, security headers)           |
| `.dockerignore`           | Exclui node_modules, docs, testes, CI do contexto                |
| `scripts/docker.sh`       | Script principal de gerenciamento                                |
| `scripts/docker-audit.sh` | Auditoria completa de segurança e funcionalidade                 |
| `scripts/docker-clean.sh` | Limpeza de containers, imagens e volumes órfãos                  |

## Comandos rápidos (npm)

```bash
npm run docker:build       # build da imagem production
npm run docker:up          # sobe container na porta 5001
npm run docker:down        # para e remove container
npm run docker:logs        # logs em tempo real
npm run docker:ps          # status dos containers
npm run docker:status      # status detalhado (health, portas, HTTP)
npm run docker:shell       # abre shell no container
npm run docker:audit       # auditoria completa (11 testes)
npm run docker:clean       # limpeza completa de tudo
npm run docker:dev         # dev com hot-reload (porta 5173)
npm run docker:dev:down    # para dev
```

## Script docker.sh

Script principal para gerenciamento completo:

```bash
./scripts/docker.sh <comando> [opções]

# Produção
./scripts/docker.sh build          # build imagem
./scripts/docker.sh up             # sobe container
./scripts/docker.sh down           # para container
./scripts/docker.sh restart        # reinicia
./scripts/docker.sh logs           # logs
./scripts/docker.sh ps             # status
./scripts/docker.sh status         # status detalhado
./scripts/docker.sh shell          # shell no container

# Auditoria e manutenção
./scripts/docker.sh audit          # auditoria completa
./scripts/docker.sh clean          # limpeza completa

# Desenvolvimento
./scripts/docker.sh dev            # dev server
./scripts/docker.sh dev-down       # para dev
```

### Variável PORT

```bash
PORT=8080 ./scripts/docker.sh up    # usa porta 8080
```

## Auditoria (docker-audit.sh)

Script de validação completa com 11 testes:

```bash
./scripts/docker-audit.sh
```

### O que é testado

1. **Build** — imagem compila sem erros
2. **Container** — inicia corretamente
3. **Healthcheck** — fica healthy em ≤30s
4. **HTTP** — retorna 200 em /
5. **SPA Fallback** — rotas profundas funcionam
6. **Security Headers** — X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, CSP
7. **Server Tokens** — versão nginx não exposta
8. **Arquivos Sensíveis** — .env, .git/config bloqueados
9. **Asset Cache** — Cache-Control presente
10. **Tamanho da Imagem** — reportado
11. **Non-Root** — container não roda como root

### Exemplo de saída

```
═══════════════════════════════════════════════════
  Markdown-Studio Docker Audit
═══════════════════════════════════════════════════

▸ Build
  ✓ Build da imagem markdown-studio:local

▸ Container
  ✓ Container iniciado

▸ Healthcheck
  ✓ Healthcheck: healthy

▸ HTTP
  ✓ HTTP 200 em /

▸ SPA Fallback
  ✓ SPA fallback (/some/deep/route → 200)

▸ Security Headers
  ✓ X-Content-Type-Options: nosniff
  ✓ X-Frame-Options: SAMEORIGIN
  ✓ X-XSS-Protection: 1; mode=block
  ✓ Referrer-Policy: strict-origin-when-cross-origin
  ✓ Content-Security-Policy: default-src 'self'...

▸ Server Tokens
  ✓ Server header não expõe versão

▸ Arquivos Sensíveis
  ✓ /env bloqueado (404)
  ✓ /git/config bloqueado (404)
  ✓ /.htaccess bloqueado (404)
  ✓ /package.json bloqueado (404)

▸ Imagem
  ℹ Tamanho: 45.2MB

▸ Segurança do Container
  ✓ Rodando como non-root (UID: 1001)
  ✓ Root filesystem read-only

═══════════════════════════════════════════════════
  Resultado
═══════════════════════════════════════════════════
  ✓ Passou: 17
  ⚠ Avisos: 0
  ✗ Falhou: 0

✓ Auditoria aprovada!
```

## Limpeza (docker-clean.sh)

```bash
./scripts/docker-clean.sh
```

Remove:

1. Containers do projeto (compose down)
2. Containers parados/exited/dead
3. Imagens dangling
4. Volumes órfãos
5. Cache de build

## Segurança

| Recurso                         | Status |
| ------------------------------- | ------ |
| USER non-root (app:1001)        | ✅     |
| read_only: true                 | ✅     |
| no-new-privileges               | ✅     |
| tmpfs para /var/cache/nginx     | ✅     |
| CSP header                      | ✅     |
| X-Content-Type-Options          | ✅     |
| X-Frame-Options                 | ✅     |
| X-XSS-Protection                | ✅     |
| server_tokens off               | ✅     |
| Resource limits (128MB/0.5 CPU) | ✅     |
| Arquivos sensíveis bloqueados   | ✅     |

## CI/CD

### Docker Build (`.github/workflows/docker.yml`)

- **Trigger**: push/PR quando Dockerfile ou src mudam
- **Build**: Docker Buildx + cache GHA
- **Teste**: health check após build
- **Push**: GHCR no main branch (latest + SHA)

### Dependabot (`.github/dependabot.yml`)

- Atualizações semanais (npm + GitHub Actions)
- Agrupadas por tipo (dev/production)
- Labels automáticas

## Desenvolvimento

### Modo dev (hot-reload)

```bash
npm run docker:dev       # ou: docker compose -f compose.dev.yaml up
```

Volumes mountados para hot-reload:

- `./src` → `/app/src` (somente leitura)
- `./public` → `/app/public` (somente leitura)
- `./index.html` → `/app/index.html` (somente leitura)

Acessa em `<http://localhost:5173>`

### Rebuild após mudanças

```bash
# Produção
npm run docker:down
npm run docker:build
npm run docker:up

# Ou com o script
./scripts/docker.sh restart
```

## Troubleshooting

### Container não inicia

```bash
docker compose logs markdown-studio
```

### Porta em uso

```bash
# Verificar o que usa a porta
lsof -i :5001
# Ou usar outra porta
PORT=8080 npm run docker:up
```

### Container órfão

```bash
docker ps -a --filter "name=markdown-studio"
docker rm <CONTAINER_ID>
npm run docker:up
```

### Limpeza completa

```bash
./scripts/docker-clean.sh
```
