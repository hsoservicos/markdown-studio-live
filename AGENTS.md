# AGENTS.md

## Project Overview

Markdown-Studio is a client-side Markdown editor with live preview, re-built from `tanabe/markdown-live-preview` under the BMAD methodology. No backend: content renders in the browser and persists in `localStorage`. Goal: a testable, accessible, pt-BR first, static-deployable editor for personal and professional use.

## Collaborators

| Collaborator    | Role                                        | Terminal                     |
| --------------- | ------------------------------------------- | ---------------------------- |
| **hsoservicos** | Desenvolvedor principal e único colaborador | hsantos (terminal principal) |

> O repositório é mantido exclusivamente por **hsoservicos**. O terminal `hsantos` é o mesmo colaborador principal, utilizado em ambiente de desenvolvimento local.

## Coding Agents

Este projeto utiliza os seguintes agentes de codificação:

| Agent        | Description                                                                |
| ------------ | -------------------------------------------------------------------------- |
| **Opencode** | Agente de código principal para desenvolvimento, debugging e implementação |
| **Claude**   | Assistente de IA para análise, documentação e revisão de código            |
| **Freebuff** | Agente de suporte para tarefas auxiliares e validação                      |

### Agent Guidelines

- **Opencode**: Responsável pela implementação principal, testes e refactoring
- **Claude**: Responsável por análise de código, documentação e revisão
- **Freebuff**: Suporte para validação e tarefas auxiliares

## Key Commands

### Development

```bash
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # Production build → dist/
npm run preview      # Vite preview of build
npm run serve-dist   # http-server dist -p 5001 -c-1
```

### Testing & Validation

```bash
npm test               # Vitest full suite (run once)
npm run test:watch     # Vitest watch mode
npm run lint           # ESLint check (--max-warnings=0)
npm run lint:md        # markdownlint-cli2
npm run format:check   # Prettier check
npm run format:fix     # Prettier fix
npm run quality        # format:check && lint && lint:md && test  (pre-push gate)
```

### Release

```bash
npm run release           # Bump patch + tag
npm run release:minor     # Bump minor + tag
npm run release:major     # Bump major + tag
npm run changelog         # promote [Unreleased] section
```

### Docker (acesso local em container)

```bash
docker compose build         # build imagem markdown-studio:local
docker compose up -d         # sobe container na porta 5001 (nginx serve dist)
docker compose ps            # status do container (healthcheck healthy)
docker compose down          # para e remove o container
docker compose logs -f       # acompanha logs
```

A imagem é multi-stage (`Dockerfile`): stage `builder` (node:22-alpine, `npm ci` + `vite build`) e stage `runtime` (nginx:alpine serve `/usr/share/nginx/html` na porta 80 → mapeada para 5001). `nginx.conf` fornece SPA fallback, cache imutável para `/assets/` e nega arquivos sensíveis. Contexto de build exclui `node_modules/`, `dist/`, `.opencode/`, `.impeccable/` via `.dockerignore`.

## Architecture

### Source Structure (`src/`)

- `src/main.js` — entry point / bootstrap (`window.addEventListener('load', init)`).
- `src/storage.js` — deterministic localStorage wrapper (replaces storehouse-js).
- `src/render/` — pure rendering pipeline (marked → DOMPurify → mermaid).
- `src/ui/` — DOM glue: editor bootstrap, scroll sync, theme, divider, buttons.
- `src/i18n/` — pt-BR first localization (strings + default template).

### Data flow

```
edição no Monaco
  └─ onDidChangeModelContent
       └─ convert(value)                (pure, testable)
            ├─ marked.parse → html
            ├─ DOMPurify.sanitize
            ├─ #output.innerHTML
            └─ scheduleMermaidRender (debounce 150ms)
```

### Important Concepts

- **Security edge**: DOMPurify is the ONLY frontier sanitizing `marked` output before DOM injection.
- **Mermaid render discipline**: manual `render()`, never `startOnLoad`; deferred debounce + version-guard against races.
- **localStorage contract**: keys `com.markdownstudio.last_state`, `scroll_bar_settings`, `theme_settings`; expiry 2099.
- **Theme boot**: inline head script sets `data-theme` pre-paint (anti-FOUC); app keeps source of truth.

## Engineering doctrine

1. **Preserve behavior first.** Persisted keys, default template, exported UI strings are contracts.
2. **Split by responsibility, never by line count.** A cohesive pipeline stays whole.
3. **Fail loud at boundaries.** Typed escalation over bare `catch`.
4. **Tests at the lowest layer** that catches the regression: pure core unit > seam > integration.
5. **Do not refactor untouched code** just to satisfy new rules.
6. **No LLM calls in any "control loop"** if automation is added (BMAD hard rule).
7. Every PR lands with a Conventional Commit and a CHANGELOG entry under `[Unreleased]`.

## Repo hygiene

- CHANGELOG entries terse, imperative, scannable, under `## [Unreleased]`.
- Six subsections only: Added, Changed, Deprecated, Removed, Fixed, Security.
- Release promotes `[Unreleased]` → `[X.Y.Z]` and opens a fresh empty section.
- Never commit `node_modules/`, `dist/`, coverage, or local notes.

## Docs index

| Doc                                       | Read when                             |
| ----------------------------------------- | ------------------------------------- |
| `docs/tutorials/getting-started.md`       | first run / quickstart                |
| `docs/how-to/re-edit-overview.md`         | planning any change to the app        |
| `docs/how-to/impeccable-design-system.md` | changing UI / layout / presentation   |
| `docs/how-to/docker-workflow.md`          | building/deploying via Docker         |
| `docs/explanation/architecture.md`        | understanding the pipeline            |
| `docs/reference/api-convert.md`           | writing/extending `convert()`         |
| `docs/reference/storage-contract.md`      | touching persistence                  |
| `specs/prd.md`                            | the product definition                |
| `specs/spec-v1.md`                        | acceptance criteria (Given/When/Then) |
| `PRODUCT.md`                              | durable product truth (Impeccable)    |
| `DESIGN.md`                               | visual design system (Impeccable)     |
| `CHANGELOG.md`                            | release history                       |

## Build/Deploy notes

- Node 22 LTS required (see `.nvmrc`); engines `>=20.12.0`.
- `firebase.json` hosts `dist/` (Firebase Hosting). Optional firebase-tools install for `firebase deploy`.
- Monaco, marked, DOMPurify, mermaid are npm deps (no runtime CDN) — app is offline-capable after build.
