# Markdown-Studio

Editor Markdown com preview em tempo real — projeto pessoal e profissional, reconstruído a partir do [`tanabe/markdown-live-preview`](https://github.com/tanabe/markdown-live-preview) — repositório de estudo base para o desenvolvimento deste projeto — sob a metodologia **BMAD**.

## Visão Geral

Markdown-Studio é um editor 100% client-side (sem backend) com:

- **Editor Monaco** com syntax highlighting para Markdown
- **Preview em tempo real** com renderização de Mermaid, KaTeX e tabelas
- **PDF vetorial pesquisável** (Ctrl+F funciona no PDF exportado)
- **Múltiplos documentos** com gerenciamento na sidebar
- **Persistência local** via `localStorage` (sem conta, sem nuvem)
- **Tema claro/escuro** com anti-FOUC
- **i18n** pt-BR (padrão) e English
- **Acessibilidade** (teclado, aria-labels, foco visível)

## Stack

| Camada           | Tecnologia        | Versão                     |
| ---------------- | ----------------- | -------------------------- |
| **Build**        | Vite              | 8.2.2                      |
| **Teste**        | Vitest + jsdom    | 5.0.0 + 30.0.1             |
| **Lint**         | ESLint + Prettier | 10.10.0 + 3.7.4            |
| **Editor**       | Monaco Editor     | 0.53.0                     |
| **Markdown**     | marked            | 18.0.11                    |
| **Sanitização**  | DOMPurify         | 3.4.14                     |
| **Diagrams**     | Mermaid           | 11.17.2                    |
| **Matemática**   | KaTeX             | 0.18.5                     |
| **PDF vetorial** | pdfmake           | 0.3.11                     |
| **PDF raster**   | html2pdf.js       | 0.14.0                     |
| **Container**    | Docker + nginx    | 1.27-alpine                |
| **CI/CD**        | GitHub Actions    | quality + docker + release |

## Comandos

### Desenvolvimento

| Ação          | Comando                                       |
| ------------- | --------------------------------------------- |
| Instalar      | `npm ci`                                      |
| Dev server    | `npm run dev` (porta 5173)                    |
| Testes        | `npm test` / `npm run test:watch`             |
| Coverage      | `npm run test:coverage`                       |
| Build         | `npm run build`                               |
| Quality gate  | `npm run quality`                             |
| Lint JS       | `npm run lint`                                |
| Lint MD       | `npm run lint:md`                             |
| Formatar      | `npm run format:check` / `npm run format:fix` |
| Preview build | `npm run preview`                             |
| Serve dist    | `npm run serve-dist` (porta 5001)             |

### Docker

| Ação               | Comando                |
| ------------------ | ---------------------- |
| Build imagem       | `npm run docker:build` |
| Subir container    | `npm run docker:up`    |
| Parar container    | `npm run docker:down`  |
| Logs               | `npm run docker:logs`  |
| Status             | `npm run docker:ps`    |
| Auditoria          | `npm run docker:audit` |
| Shell no container | `npm run docker:shell` |
| Dev (hot-reload)   | `npm run docker:dev`   |
| Limpeza            | `npm run docker:clean` |

### Release

| Ação       | Comando                 |
| ---------- | ----------------------- |
| Bump patch | `npm run release`       |
| Bump minor | `npm run release:minor` |
| Bump major | `npm run release:major` |

## Estrutura

```
Markdown-Studio/
├── src/
│   ├── main.js              # Entry point / bootstrap
│   ├── storage.js           # localStorage wrapper
│   ├── documents.js         # Multi-document index
│   ├── i18n/                # pt-BR / en translations
│   ├── render/
│   │   ├── convert.js       # marked → DOMPurify pipeline
│   │   ├── mermaid.js       # Mermaid rendering
│   │   ├── katexExt.js      # KaTeX extensions
│   │   └── toc.js           # Table of contents
│   ├── pdf/
│   │   ├── markdown-to-pdfmake.js  # Markdown → pdfmake
│   │   ├── pdfmake-adapter.js      # pdfmake lazy-load
│   │   └── svg-embed.js           # SVG helpers
│   └── ui/
│       ├── exportPdf.js         # PDF export (raster + vector)
│       ├── exportPdfVector.js   # Vector PDF entry point
│       ├── documents-ui.js      # Document manager UI
│       ├── sidebar.js           # Sidebar component
│       ├── snapshots.js         # Backup snapshots
│       └── ...                  # Other UI modules
├── tests/unit/              # Vitest unit tests (287 tests)
├── docs/                    # Diataxis documentation
├── specs/                   # PRD, specs, sprint status
├── scripts/                 # Docker + version scripts
├── Dockerfile               # Multi-stage production build
├── compose.yaml             # Docker Compose production
├── compose.dev.yaml         # Docker Compose development
├── nginx.conf               # nginx config (SPA, security)
└── AGENTS.md                # AI agent instructions
```

## Features

### v1.0 (Core)

- Editor Monaco com syntax highlighting
- Preview em tempo real (Mermaid, KaTeX)
- Persistência em localStorage
- Tema claro/escuro com anti-FOUC
- Sidebar com ações (Copy, Export PDF, Reset)
- i18n pt-BR / English
- Sync scroll editor→preview
- Docker multi-stage (nginx)

### v1.1 (P0/P1)

- Configuração de impressão (margem, papel, orientação)
- Quebras de página conscientes
- Barra de status com estatísticas
- Sumário (TOC) bidirecional
- Suporte a matemática (KaTeX)
- Copiar como HTML rico
- Exportar HTML standalone
- Snapshots locais com recuperação

### v1.2 (P2-A: PDF Vetorial)

- PDF com texto vetorial pesquisável (pdfmake)
- Feature-flag `com.markdownstudio.pdf.vector`
- Fallback transparente para raster
- KaTeX → PNG via html2canvas
- Mermaid SVG capture do DOM

### v1.2 (P2-B: Multi-Documentos)

- Índice de documentos no localStorage
- Gerenciador de documentos na sidebar
- Criar/renomear/alternar/fechar docs
- Snapshots com `docId` (associação a documento)
- Boot com restauração e migração legado

## CI/CD

| Workflow      | Trigger                  | Ações                                        |
| ------------- | ------------------------ | -------------------------------------------- |
| `quality.yml` | push/PR main             | lint, lint:md, format, test:coverage, build  |
| `docker.yml`  | push/PR (Dockerfile/src) | build, health test, push GHCR                |
| `release.yml` | manual dispatch          | bump, quality, build, Docker, GitHub Release |

## Segurança

- **DOMPurify**: sanitização de HTML (fronteira de segurança ÚNICA)
- **CSP**: documentado (unsafe-eval para Monaco, unsafe-inline para KaTeX)
- **Docker**: non-root, read-only, no-new-privileges, resource limits
- **Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy
- **0 vulnerabilidades** npm audit

## Licença

ISC (herdada do projeto original) — para uso pessoal e profissional.

## Colaboradores

| Colaborador     | Função                                      |
| --------------- | ------------------------------------------- |
| **hsoservicos** | Desenvolvedor principal e único colaborador |

### Agentes de Código

| Agente       | Descrição                                             |
| ------------ | ----------------------------------------------------- |
| **Opencode** | Agente principal para desenvolvimento e implementação |
| **Claude**   | Assistente de IA para análise e documentação          |
| **Freebuff** | Agente de suporte para validação                      |

_Baseado em [`tanabe/markdown-live-preview`](https://github.com/tanabe/markdown-live-preview) (ISC)._
