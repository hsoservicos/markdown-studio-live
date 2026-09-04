# syntax=docker/dockerfile:1
#
# Markdown-Studio — container de produção (estático, sem backend).
#
# Multi-stage:
#   1. deps     — instala dependências (cacheável separadamente)
#   2. builder  — Node 22 LTS gera ./dist via Vite
#   3. runtime  — nginx alpine serve ./dist com SPA fallback
#
# Imagem final: apenas nginx + dist (~40-50MB).

# ---------- Stage 1: dependencies (cache) ----------
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --ignore-scripts \
    && npm cache clean --force

# ---------- Stage 2: build ----------
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG VITE_BUILD_DATE=unknown
ENV VITE_BUILD_DATE=${VITE_BUILD_DATE}

RUN npm run build

# ---------- Stage 3: runtime (nginx) ----------
FROM nginx:1.27-alpine AS runtime

# Metadata
LABEL maintainer="markdown-studio"
LABEL description="Markdown-Studio editor — static SPA served by nginx"

# Segurança: não rodar como root
RUN addgroup -g 1001 -S app && \
    adduser -S app -u 1001 -G app

# Copiar configuração do nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar artefatos do build
COPY --from=builder /app/dist /usr/share/nginx/html

# Ajustar permissões
RUN chown -R app:app /usr/share/nginx/html && \
    chown -R app:app /var/cache/nginx && \
    chown -R app:app /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown app:app /var/run/nginx.pid

# Marca de build reproduzível
ARG VITE_BUILD_DATE=unknown
ENV VITE_BUILD_DATE=${VITE_BUILD_DATE}

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/ || exit 1

USER app

CMD ["nginx", "-g", "daemon off;"]
