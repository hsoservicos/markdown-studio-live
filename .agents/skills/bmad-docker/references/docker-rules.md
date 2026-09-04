# Docker Validation Rules

Reference for Dockerfile and docker-compose.yml validation. Based on hadolint rules and Docker best practices 2024/2025.

## Dockerfile Rules

### D001 — Syntax Pragma Required (ERROR)

**Rule:** Every Dockerfile must start with `# syntax=docker/dockerfile:1`

**Why:** Enables BuildKit features (cache mounts, secrets, SSH mounts). Required for modern Docker.

```dockerfile
# ✅ CORRETO
# syntax=docker/dockerfile:1
FROM node:22-alpine

# ❌ ERRADO
FROM node:22-alpine
```

### D002 — MAINTAINER Obsolete (ERROR)

**Rule:** Never use `MAINTAINER`. Use `LABEL maintainer=` instead.

```dockerfile
# ✅ CORRETO
LABEL maintainer="name <email>"

# ❌ ERRADO
MAINTAINER name <email>
```

### D003 — FROM Without Version Tag (WARNING)

**Rule:** Always pin a specific version tag on base images.

```dockerfile
# ✅ CORRETO
FROM node:22.8-alpine3.20
FROM python:3.12.5-slim-bookworm

# ❌ ERRADO
FROM node
FROM ubuntu
```

### D004 — FROM latest Tag (WARNING)

**Rule:** Avoid `:latest` — use explicit versions for reproducibility.

```dockerfile
# ✅ CORRETO
FROM node:22-alpine

# ❌ ERRADO
FROM node:latest
```

### D005 — CMD Shell Form (INFO)

**Rule:** Use JSON notation (exec form) for CMD/ENTRYPOINT.

```dockerfile
# ✅ CORRETO
CMD ["node", "dist/main.js"]

# ❌ ERRADO
CMD node dist/main.js
```

### D006 — apt-get Without Cleanup (WARNING)

**Rule:** Always clean apt lists after install.

```dockerfile
# ✅ CORRETO
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# ❌ ERRADO
RUN apt-get update && apt-get install -y curl
```

### D007 — Missing --no-install-recommends (INFO)

**Rule:** Use `--no-install-recommends` to minimize image size.

```dockerfile
# ✅ CORRETO
RUN apt-get install -y --no-install-recommends curl

# ❌ ERRADO
RUN apt-get install -y curl
```

### D008 — Use COPY Instead of ADD (ERROR)

**Rule:** Use `COPY` unless you specifically need `ADD` features (tar extraction, URL fetch).

```dockerfile
# ✅ CORRETO
COPY package.json ./
COPY . .

# ❌ ERRADO
ADD package.json ./
```

### D009 — Missing Non-Root USER (WARNING)

**Rule:** Always add a non-root user for production images.

```dockerfile
# ✅ CORRETO
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup
USER appuser

# ❌ ERRADO (running as root)
CMD ["node", "app.js"]
```

### D010 — Missing HEALTHCHECK (INFO)

**Rule:** Add HEALTHCHECK for container orchestration.

```dockerfile
# ✅ CORRETO
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1
```

### D011 — Missing Cache Mount (WARNING)

**Rule:** Use BuildKit cache mounts for package managers.

```dockerfile
# ✅ CORRETO
RUN --mount=type=cache,target=/root/.npm \
    npm ci

RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# ❌ ERRADO
RUN npm ci
RUN pip install -r requirements.txt
```

### D012 — Multiple Consecutive RUN (WARNING)

**Rule:** Consolidate RUN commands to reduce layers.

```dockerfile
# ✅ CORRETO
RUN apk add --no-cache python3 make g++ && \
    addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# ❌ ERRADO
RUN apk add --no-cache python3 make g++
RUN addgroup -g 1001 -S appgroup
RUN adduser -u 1001 -S appuser -G appgroup
```

### D013 — Chained npm install Without Cache (WARNING)

**Rule:** Always combine `npm ci`/`npm install` with cache mount.

```dockerfile
# ✅ CORRETO
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# ❌ ERRADO
RUN npm ci --omit=dev
```

### D014 — pip install Without Cache (WARNING)

**Rule:** Always use cache mount for pip.

```dockerfile
# ✅ CORRETO
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# ❌ ERRADO
RUN pip install -r requirements.txt
```

### D015 — Missing .dockerignore (WARNING)

**Rule:** Project should have a `.dockerignore` file.

**Suggested .dockerignore:**
```
.git
.gitignore
node_modules
.env
.env.*
*.md
docker-compose*.yml
.DS_Store
__pycache__
coverage/
.pytest_cache/
```

---

## Compose Rules

### C001 — Version Field Obsolete (ERROR)

**Rule:** Remove `version` field — it's deprecated in Compose Specification.

```yaml
# ✅ CORRETO
services:
  app:
    image: node:22-alpine

# ❌ ERRADO
version: "3.8"
services:
  app:
    image: node:22-alpine
```

### C002 — Filename Convention (INFO)

**Rule:** Use `compose.yaml` instead of `docker-compose.yml`.

```
✅ compose.yaml
✅ compose.yml
❌ docker-compose.yml
❌ docker-compose.yaml
```

### C003 — CLI Convention (INFO)

**Rule:** Use `docker compose` (space) instead of `docker-compose` (hyphen).

```bash
# ✅ CORRETO
docker compose up -d

# ❌ ERRADO
docker-compose up -d
```

### C004 — Links Deprecated (WARNING)

**Rule:** Use `networks` instead of `links`.

```yaml
# ✅ CORRETO
services:
  web:
    networks:
      - app-network
  api:
    networks:
      - app-network

networks:
  app-network:

# ❌ ERRADO
services:
  web:
    links:
      - api
```

### C005 — depends_on Without Condition (INFO)

**Rule:** Use `depends_on` with `condition` for proper startup ordering.

```yaml
# ✅ CORRETO
services:
  web:
    depends_on:
      api:
        condition: service_healthy

# ❌ ERRADO
services:
  web:
    depends_on:
      - api
```

### C006 — Missing Health Check on Dependencies (INFO)

**Rule:** Services used in `depends_on` with `condition: service_healthy` need health checks.

```yaml
# ✅ CORRETO
services:
  api:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  web:
    depends_on:
      api:
        condition: service_healthy
```

### C007 — Missing Resource Limits (WARNING)

**Rule:** Set resource limits for production deployments.

```yaml
# ✅ CORRETO
services:
  app:
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M
```
