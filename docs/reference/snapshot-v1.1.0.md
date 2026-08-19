# Snapshot v1.1.0 — 2026-08-19

Registro compacto do momento de implementação do Markdown-Studio na release estável **v1.1.0**. Publicado por convenção BMAD: qualidade verde, build ok e container healthy.

## Estado verificado (gate)

| Checagem               | Resultado                                                               |
| ---------------------- | ----------------------------------------------------------------------- |
| `npm run format:check` | Passou                                                                  |
| `npm run lint`         | 0 issues (`--max-warnings=0`)                                           |
| `npm run lint:md`      | Passou                                                                  |
| `npm test`             | 8 arquivos / **76 testes verdes**                                       |
| `npm run build`        | `dist/` gerado (chunks editor/mermaid/html2pdf/katex/cytoscape/cynefin) |
| Docker `compose up -d` | `markdown-studio:local` healthy, HTTP 200 em `:5001`                    |

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

## Pós-snapshot (2026-08-19, mesmo dia)

- **Git inicializado** (`master`): commit `release: v1.1.0` + tag `v1.1.0`; workflow de release `npm run release` volta a valer.
- **BMAD Method (bmm) v6.11.0 instalado** via installer oficial: `_bmad/` (core+bmm+config), **49 skills → `.agents/skills`**, **49 commands → `.opencode/commands`**, tool **opencode** configurado. `.agents/`/`_bmad/` ignorados por prettier/markdownlint (gate mantido verde) e `_bmad/config.user.toml` gitignored (pessoal/máquina).
- **Verificação/análise BMAD concluída** (estilo `bmad-code-review`): 3 camadas paralelas (código, testes, produto) → achados A1–A3 e M1–M5 resolvidos/registrados, e 10 propostas de features P0–P2 documentadas em `_bmad-output/`. Ver análise em `_bmad-output/verifications/`.
