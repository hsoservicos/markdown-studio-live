# Snapshot v1.1.0 — 2026-08-19

Registro compacto do momento de implementação do Markdown-Studio na release estável **v1.1.0**. Publicado por convenção BMAD: qualidade verde, build ok e container healthy.

## Estado verificado (gate)

| Checagem | Resultado |
| -------- | --------- |
| `npm run format:check` | Passou |
| `npm run lint` | 0 issues (`--max-warnings=0`) |
| `npm run lint:md` | Passou |
| `npm test` | 8 arquivos / **76 testes verdes** |
| `npm run build` | `dist/` gerado (chunks editor/mermaid/html2pdf/katex/cytoscape/cynefin) |
| Docker `compose up -d` | `markdown-studio:local` healthy, HTTP 200 em `:5001` |

## Features entregues nesta release

- **Export PDF funcional** (`src/ui/exportPdf.js`): `html2pdf.js@^0.14.0` como dep npm local via dynamic import (sem CDN); A4 retrato, tema light forçado no clone (`190mm`), status no rodapé.
- **Sidebar com ações**: Manual, Abrir/Salvar arquivo, Imprimir, Redefinir, Novo arquivo, Copiar, Exportar PDF.
- **Colapso/drawer mobile**: toggle no header, `translateX` em ≤720px, boot colapsado em telas compactas.
- **i18n pt-BR/en**: seletor na sidebar, `applyI18n` cobre texto/labels/placeholders/aria/alt/title/meta; template do editor por locale; Manual bilingue.
- **Scroll sync editor→preview**, tema claro/escuro com anti-FOUC, persistência `localStorage`, reset com confirmação.

## Veredito

Versão **estável e utilizável** nas operações do dia a dia (escrever, visualizar, copiar e exportar PDF). Containers/deps auditados (`npm audit` → 0 vulnerabilidades). Sem pontas soltas que bloqueiem uso.

## Pendências conhecidas (não bloqueiam)

- Build avisa chunks grandes (>700 kB) — Monaco (`editor`) e libs dinâmicas; size warning conhecido, code-split já em vigor no export.
- PDF exportado é rasterizado (html2canvas/jpeg) — conteúdo não pesquisável.
- Projeto ainda **sem repositório git** (bump de versão manual; sem tag `v1.1.0`).
- BMAD tem conectores (MCP/CLI) mas **nenhum módulo de método (`bmm`) instalado** — agents/workflows em 0.