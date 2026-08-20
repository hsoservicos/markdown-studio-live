# Propostas de novas features — Markdown-Studio (BMAD)

Gerado em 2026-08-19 a partir da análise pós-release v1.1.0. Todas respeitam os
princípios do produto: offline, sem backend, sem rastreamento, localStorage,
deps via npm (sem CDN), design "The Quiet Studio". Nenhuma proposta exige lib nova
que não exista já no repositório.

## P0 — alto valor, baixo risco, escopo v1 — **IMPLEMENTADO (2026-08-19)**

| # | Feature | Benefício | Esforço | Dependências técnicas |
| - | ------- | --------- | ------- | --------------------- |
| 1 | **Configuração de página p/ PDF/Imprimir** ✅ | margens, papel, orientação e cabeçalho/rodapé configuráveis (fecha open decision do PRODUCT.md) | M | `src/ui/printSettings.js`; `buildExportOptions` lê config; `@page`+contadores CSS no print; hook `toPdf().get('pdf')` do html2pdf |
| 2 | **Quebras de página conscientes** ✅ | sem heading órfão, tabela/código partidos nem viúvas na impressão (defeito mais visível hoje) | S | `break-inside: avoid` em table/pre/blockquote/figure no `@media print` e no clone do PDF; marcador `<!-- page-break -->` |
| 3 | **Barra de status com estatísticas** ✅ | palavras, caracteres, linhas, tempo de leitura e arquivo aberto num relance | S | `<footer>` vazio já existe; contagem no `scheduleSave`; chaves i18n; sem storage novo |
| 4 | **Sumário (TOC) bidirecional** ✅ | navegar por seções; clique num título leva o cursor ao ponto no editor | M | reusa `id` de headings de `convert.js`; `src/render/toc.js` puro; `editor.revealPosition` |
| 5 | **Suporte a matemática (KaTeX)** ✅ | fórmulas `$...$`/`$$...$$` em relatórios — katex **já** em `node_modules` (chunk do build) | M | promover katex a dep direta; extensão do `marked`; saída passa pelo DOMPurify |

Validação: 177 testes unitários verdes + probe e2e `p0_features_probe.js`
(KaTeX inline/bloco, page-break, stats, TOC com âncoras, config de impressão
persistida com `@page` aplicado; regressões M3/A2 intactas).

## P1 — boa relação valor/esforço, v1 — **IMPLEMENTADO (2026-08-20)**

| # | Feature | Benefício | Esforço | Dependências |
| - | ------- | --------- | ------- | ------------- |
| 6 | **Copiar como HTML rico** ✅ | colar formatado em e-mail/Word/Google Docs | S | `ClipboardItem` `text/html` com HTML sanitizado de `#output`; fallback plain |
| 7 | **Exportar HTML standalone** ✅ | compartilhar artefato renderizado em um `.html` offline único | S | template estático + CSS github-markdown local; `downloadBlob` já existe |
| 8 | **Snapshots locais com recuperação** ✅ | anéis de backup no navegador evitam perda se `last_state` for corrompido | M | contratos `com.markdownstudio.backup.*` no storage; dialog sidebar |

Validação: testes unitários (`copyRich`, `exportHtml`, `snapshots`, `snapshotsDialog`) +
probe e2e `p1_features_probe.mjs` (botões na sidebar, export HTML com CSS embutido,
anel de backup no storage, regressões A2/M2).

## P2 — v2

| # | Feature | Benefício | Esforço | Dependências |
| - | ------- | --------- | ------- | ------------- |
| 9 | **PDF com texto vetorial pesquisável** | Ctrl+F e seleção no PDF (mata pendência "não pesquisável" do snapshot) | L | trocar rasterização html2canvas por fluxo `jsPDF.text`/pdfmake; mermaid/tabelas como SVG |
| 10 | **Múltiplos documentos (abas/lista)** | gerir vários artefatos com a mesma privacidade local | L | índice `com.markdownstudio.documents.*`; gerenciador `src/ui/documents.js` |

## Correções técnicas recomendadas (antes das features)

Ordem sugerida pela revisão adversarial: **A1 → A2 → M1 → M2 → M3 → M4** (robustez e
segurança do que já existe) seguidas das lacunas de teste 1–5. Só então features P0
na sequência **1 → 3 → 2 → 4 → 5**.

**Status**: A1–M4 e lacunas 1–5 concluídos (commits `e6546e7`, `a1334e3`); P0 1–5
implementados e validados por probe e2e; B1–B5 resolvidos (`4856023`); P1 6–8
implementados e validados. Próximos candidatos: P2 (9–10) — PDF vetorial pesquisável,
múltiplos documentos.