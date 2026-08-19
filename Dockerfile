# syntax=docker/dockerfile:1
#
# Markdown-Studio — container de produção (estático, sem backend).
#
# Multi-stage:
#   1. builder  — Node 22 (LTS) instala deps e gera ./dist via Vite.
#   2. runtime  — nginx oficial serve ./dist com SPA fallback p/ index.html.
#
# Imagem final: apenas nginx + dist (~40MB). Nenhum runtime de build no final.

# ---------- Stage 1: build ----------
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---------- Stage 2: runtime (nginx) ----------
FROM nginx:alpine AS runtime

# Marca de build reproduzível
ARG VITE_BUILD_DATE=unknown
ENV VITE_BUILD_DATE=${VITE_BUILD_DATE}

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]