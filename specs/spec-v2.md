---
title: Markdown-Studio v2 Spec (P2)
created: 2026-09-04
updated: 2026-09-04
module: Markdown-Studio
status: draft
---

# Spec v2 — Markdown-Studio (features P2)

Objetivo: **duas remodelagens coesas** — (P2-9) PDF com texto vetorial pesquisável e (P2-10)
múltiplos documentos locais — derivadas das propostas P2 em
`_bmad-output/verifications/features-proposals.md` e detalhadas em
`_bmad-output/planning-artifacts/epics-p2.md`.

Princípios preservados (PRODUCT.md): offline, sem backend, sem rastreamento, localStorage,
deps npm sem CDN, pt-BR primeiro, design "The Quiet Studio", quality gate verde.

## Ready for Development

- **Actionable** ✅ — epics/stories com caminhos em `_bmad-output/planning-artifacts/epics-p2.md`.
- **Testable** ✅ — ACs Given/When/Then abaixo.
- **Complete** — aprovado o escopo; ACs de compatibilidade/fallback incluídas.
- **Coherent** ✅ — sem contradições com PRD/spec-v1/PRODUCT.md.

## Escopo

### Epic P2-A — PDF com texto vetorial pesquisável (story 1.1–1.4)

### Epic P2-B — Múltiplos documentos locais (story 2.1–2.4)

## ACs (Given/When/Then)

### AC-P2-9-1 — PDF pesquisável

- **Given** um documento Markdown renderizado no preview
- **When** o usuário exporta o PDF
- **Then** títulos, parágrafos, listas e tabelas são texto vetorial pesquisável (Ctrl+F e
  seleção funcionam no leitor)
- **And** margem, papel (A4/Letter), orientação e cabeçalho/rodapé com `{page}` (P0-1)
  continuam aplicados

### AC-P2-9-2 — Diagramas e matemática no PDF vetorial

- **Given** documento com blocos `mermaid` e fórmulas KaTeX `$…$`/`$$…$$`
- **When** o PDF vetorial é gerado
- **Then** diagramas e fórmulas aparecem preservados (SVG/alta resolução conforme a rota)
- **And** quebras de página conscientes (P0-2) permanecem respeitadas

### AC-P2-9-3 — Fallback e erro claro

- **Given** a lib de PDF vetorial indisponível ou falha na geração
- **When** o usuário clica em Exportar PDF
- **Then** o status reporta `pdfUnavailable`/`exportError` no canal `aria-live`
- **And** o fallback rasterizado atual permanece até a rota nova estar estável
- **And** testes unitários cobrem sucesso e erro sem rede

### AC-P2-10-1 — Índice e isolamento de documentos

- **Given** um documento ativo com conteúdo editado
- **When** um segundo documento é criado/aberto
- **Then** cada documento persiste sob `com.markdownstudio.documents.*` (índice + conteúdo)
  com leitura tipada (`StorageError`/`safeGet`)
- **And** `last_state` e o anel `backup` existentes continuam funcionando

### AC-P2-10-2 — Gerenciador de documentos

- **Given** o editor aberto com a sidebar
- **When** o usuário cria/renomeia/alterna/fecha documentos
- **Then** a UI reflete o documento ativo e persiste o documento corrente
- **And** há confirmação antes de descartar conteúdo não salvo (`newFileConfirm`)

### AC-P2-10-3 — Ações operando no documento ativo

- **Given** múltiplos documentos abertos
- **When** o usuário usa Copy/Export PDF/Export HTML/Snapshots
- **Then** a ação usa o conteúdo e o nome do documento ativo
- **And** snapshots preservam a origem (id/etiqueta)

### AC-P2-10-4 — Boot com restauração

- **Given** documentos abertos e um documento ativo na sessão anterior
- **When** a página recarrega
- **Then** a lista é restaurada e o documento ativo reabre
- **And** índice vazio/corrompido degrada para o template do idioma corrente sem crash

## Non-goals (v2)

- Backend, sync remoto, colaboração, contas.
- PDF com layout pixel-perfect idêntico ao navegador em todos os casos (rota avalia
  fidelidade vs pesquisabilidade).

## Reference

- Epics/stories: `_bmad-output/planning-artifacts/epics-p2.md`
- Propostas: `_bmad-output/verifications/features-proposals.md`
- PRD: `specs/prd.md`
