# How-to: Publicar o Markdown-Studio em Docker (acesso local)

Guia de como construir, subir e manter o Markdown-Studio como container Docker para
**primeira visão e acesso local** do projeto — sem backend, sem publicação externa.

## Por que Docker aqui

O Markdown-Studio é um app 100% client-side (estático): editor Monaco + render no
browser, persistência em `localStorage`. Não há servidor de aplicação — o container
serve apenas os artefatos do build (`dist/`). Isso permite:

- **Reprodução idêntica**: mesma imagem em qualquer máquina com Docker.
- **Primeira visão imediata**: `docker compose up` levanta o app em segundos.
- **Isolamento**: Node/nginx dentro do container, nada instalado no host além do Docker.
- **Ambiente completamente local**: nenhuma publicação, nenhuma distribuição web.

## Artefatos do container

| Artefato        | Papel                                                                  |
| --------------- | ---------------------------------------------------------------------- |
| `Dockerfile`    | Build multi-stage (node → nginx) e HEALTHCHECK                         |
| `nginx.conf`    | Config de produção do nginx (SPA fallback, cache, headers)             |
| `compose.yaml`  | Orquestração local: porta 5001, healthcheck, `restart: unless-stopped` |
| `.dockerignore` | Exclui node_modules/, dist/, .opencode/, .impeccable/ etc. do contexto |

### Arquitetura do `Dockerfile` (multi-stage)

```
FROM node:22-alpine AS builder
    WORKDIR /app
    COPY package.json package-lock.json .
    RUN npm ci --no-audit --no-fund
    COPY . .
    RUN npm run build            # → ./dist

FROM nginx:alpine AS runtime
    COPY nginx.conf /etc/nginx/conf.d/default.conf
    COPY --from=builder /app/dist /usr/share/nginx/html
    EXPOSE 80
    HEALTHCHECK ... wget -q --spider http://127.0.0.1/ ...
    CMD ["nginx", "-g", "daemon off;"]
```

Imagem final carrega **apenas** nginx + `dist/` (116 MB total confirmado em 04/09/2026); o build inteiro fica no
stage `builder` e é descartado.

### `nginx.conf` — decisões

- `try_files $uri $uri/ /index.html` — SPA fallback (equivalente ao rewrite do `firebase.json`).
- `/assets/` — `Cache-Control: public, immutable` + `expires 1y` (assets hasheados pelo Vite).
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` — headers defensivos.
- `location ~ /\.(?!well-known)` — nega arquivos sensíveis (`.env`, `.git`, etc.) caso cheguem ao dist.
- HEALTHCHECK via `wget` do busybox (nginx alpine).

## Comandos do dia a dia

```bash
docker compose build              # build da imagem markdown-studio:local
docker compose up -d              # sobe container "markdown-studio" em background
docker compose ps                 # status + health (aguardar "healthy")
docker compose down               # para/remove container (mantém imagem)
docker compose logs -f            # logs em tempo real
```

Acesso: <http://localhost:5001> (porta 5001 do host → 80 do container).

### Rebuild após mudanças de código/UI

```bash
docker compose down
docker compose build --no-cache   # --no-cache só se o npm ci agir estranho
docker compose up -d
```

> **Conflito de nome de container órfão**: se um container antigo chamado `markdown-studio`
> ficou órfão (não pertence ao projeto compose — ex.: criado com `docker run` ou projeto
> renomeado), `docker compose up` falha com `Conflict: container name already in use` mesmo
> com `docker compose ps` vazio. Resolver listando e removendo o órfão antes de subir:
>
> ```bash
> docker ps -a --filter "name=markdown-studio"
> docker rm <CONTAINER_ID>     # se confirmado órfão/stale (nada valioso nele)
> docker compose up -d
> ```

## Auditoria da 1ª execução (18/08/2026)

Registro da primeira validação local, via Docker 29.7.2 / Compose v5.4.0:

| Etapa                       | Resultado                                                      |
| --------------------------- | -------------------------------------------------------------- |
| `docker compose build`      | ✅ imagem `markdown-studio:local` gerada (103 MB)              |
| `docker compose up -d`      | ✅ container `markdown-studio` Up; porta `0.0.0.0:5001→80/tcp` |
| `GET http://localhost:5001` | ✅ HTTP 200                                                    |
| HEALTHCHECK                 | ✅ `healthy` após ~40s (intervalo de 30s do nginx)             |
| Navegador                   | ✅ abriu `http://localhost:5001` com template pt-BR            |

Observações:

- Primeira execução do build levou ~34s (npm ci + vite build no stage builder).
- MySQL/redes de exemplo não envolvidas; nenhuma porta além da 5001 exposta.
- Se a porta 5001 estiver em uso (ex.: `npm run serve-dist`), parar o servidor local antes:
  `Get-NetTCPConnection -LocalPort 5001 | % { Stop-Process $_.OwningProcess -Force }`.

## Auditoria da 2ª execução (04/09/2026)

Revalidação após a Story 2.1 (camada de documentos), Docker 29.7.2:

| Etapa                        | Resultado                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `docker compose build`       | ✅ imagem `markdown-studio:local` reconstruída (116 MB; `npm ci` + `vite build` 39s) |
| `docker compose up -d`       | ✅ container `markdown-studio` Up; porta `0.0.0.0:5001→80/tcp`                       |
| `GET http://localhost:5001`  | ✅ HTTP 200 (index.html do build atual — `index-DAW28NGy.js`)                        |
| SPA fallback (rota profunda) | ✅ `/some/deep/route` → 200 (queda para `index.html`)                                |
| Asset `/assets/*.css`        | ✅ HTTP 200 + `Cache-Control: max-age=31536000, public, immutable`                   |
| `/.env`                      | ✅ HTTP 403 (negado no nginx)                                                        |
| HEALTHCHECK                  | ✅ `healthy` (wget busybox; ~40s)                                                    |
| Navegador/Editor             | ✅ bundle atual presente (`editor-BSnEfEh9.js` lazy chunk)                           |

Observações:

- Imagem cresceu de 103 MB (18/08) para 116 MB pelo acúmulo de deps/features; ainda é
  só nginx + `dist/`, sem runtime de build.
- Encontrado e removido um container `markdown-studio` **órfão** (Exited 255, imagem
  antiga `ced25ee51`) que bloqueava o nome — ver nota de rebuild acima.

## Limites e convenções

- **Publicação externa está fora do escopo**: a imagem é para acesso local.
- `repository` em `package.json` aponta para upstream de referência (BMAD); não há
  registry de push configurado.
- `.dockerignore` replica o zelo de privacidade do projeto: não leva `.opencode/`,
  `.impeccable/`, logs, `.env` ou git para dentro da imagem.
- Em CI (`.github/workflows/quality.yml`) o build Docker pode ser adicionado depois;
  hoje o gate é `npm run quality` + `npm run build` no node do runner.
- Mudar a porta do host: editar `ports: - "5001:80"` no `compose.yaml`.
