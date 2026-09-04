---
title: Markdown-Studio v1 Spec
created: 2026-08-18
updated: 2026-09-04
module: Markdown-Studio
status: implemented
---

# Spec v1 — Markdown-Studio

Objetivo: **uma única remodelagem coesa** — portar o `markdown-live-preview` para Markdown-Studio com arquitetura testável, pt-BR, sem CDN e sem rastreadores.

**Escopo (single goal):** reconstruir o tool como Markdown-Studio entregando editor+preview, persistência, tema, sync scroll, copy e export em uma única PR revisionável, com qualidade gate verde.

## Ready for Development (autoconformity)

- **Actionable** ✅ — tarefas com caminho de arquivo abaixo.
- **Testable** ✅ — ACs Given/When/Then.
- **Complete** ✅ — todas as tarefas T1–T10 implementadas (sem `[TODO]` remanescentes).
- **Sufficient** ✅ — dependências de PRD mapeadas.
- **Coherent** ✅ — sem contradições internas.

## Tarefas implementadas (Fase 0–3 do roadmap)

| #   | Tarefa                    | Arquivo(s)                                                                             | Status |
| --- | ------------------------- | -------------------------------------------------------------------------------------- | ------ |
| T1  | Scaffold repo + estrutura | raiz, `docs/`, `specs/`                                                                | ✅     |
| T2  | Docs diataxis             | `docs/**`                                                                              | ✅     |
| T3  | PRD + Spec                | `specs/prd.md`, `specs/spec-v1.md`                                                     | ✅     |
| T4  | Config build/test/lint    | `package.json`, `.nvmrc`, vite/vitest/eslint/prettier/markdownlint/husky, `.gitignore` | ✅     |
| T5  | Storage wrapper           | `src/storage.js` + testes                                                              | ✅     |
| T6  | Pipeline render           | `src/render/{convert,mermaid,katexExt,toc}.js` + testes                                | ✅     |
| T7  | i18n pt-BR                | `src/i18n/index.js`                                                                    | ✅     |
| T8  | UI glue                   | `index.html`, `src/main.js`, `src/ui/*`                                                | ✅     |
| T9  | Assets estáticos          | `public/css/style.css`, `public/image/*`                                               | ✅     |
| T10 | quality + CI              | `.github/workflows/quality.yml`, firebase.json                                         | ✅     |

## ACs (Given/When/Then)

### AC-1 — Renderização ao digitar

- **Given** o app aberto com Markdown no editor
- **When** o usuário edita o texto
- **Then** o preview atualiza `#output` com HTML sanitizado, sem XSS; blocos `mermaid` viram `<pre class="mermaid">` e renderizam com debounce

### AC-2 — Persistência e restauração

- **Given** conteúdo editado no editor
- **When** a página é recarregada
- **Then** o último conteúdo é restaurado de `localStorage` (`com.markdownstudio.last_state`)

### AC-3 — Reset seguro

- **Given** conteúdo diferente do template padrão
- **When** o usuário clica Reset
- **Then** há confirmação antes de restaurar o template padrão

### AC-4 — Tema persistido com anti-FOUC

- **Given** tema escuro ativado
- **When** a página carrega
- **Then** nenhum flash de tema claro; `data-theme="dark"` no carregamento; toggle persiste em `theme_settings`

### AC-5 — Sync scroll

- **Given** sync scroll ativo
- **When** o usuário rola o editor
- **Then** o preview rola proporcionalmente (editor→preview)

### AC-6 — Copy

- **Given** conteúdo no editor
- **When** o usuário clica Copy
- **Then** o Markdown vai para o clipboard e o rótulo vira "Copiado!" por 1s

### AC-7 — Export PDF

- **Given** preview renderizado
- **When** o usuário clica Export PDF
- **Then** um PDF A4 retrato (`markdown-preview.pdf`) é baixado via `html2pdf.js` local (npm dep, dynamic import); o clone do documento força tema light e `#preview-wrapper` com largura `190mm`; sucesso reporta `pdfExported` no rodapé
- **And** se a lib não carrega, alerta `pdfUnavailable`; se o save falha, reporta `exportError` e o tema Mermaid dark é restaurado após o export

### AC-8 — Qualidade gate

- **Given** código pronto
- **When** `npm run quality` roda
- **Then** format, lint, lint:md e todos os testes passam sem warnings

### AC-9 — Sem CDN runtime

- **Given** build de produção
- **When** inspect p/inspecta módulos externos
- **Then** nenhuma dependência de jsdelivr/cdnjs/googletagmanager em runtime; tudo vendored via npm

## Non-goals v1 (reforçado)

- Auth/backend/multiusuário ❌
- Analytics ❌
- Integrações externas ❌

## Reference

- PRD: `specs/prd.md`
- Tutorial: `docs/tutorials/getting-started.md`
- Workflow dev: `docs/how-to/re-edit-overview.md`
