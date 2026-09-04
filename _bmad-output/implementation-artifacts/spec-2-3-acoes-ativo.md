---
title: 'Ações do editor operando no documento ativo'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: 'b32bda3cd2b0a73c65a886c756ade103fe0991a8'
context:
  - src/main.js
  - src/ui/snapshots.js
  - src/documents.js
  - src/ui/exportPdf.js
  - src/ui/exportHtml.js
  - src/ui/copyRich.js
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Copy/Export PDF/Export HTML usam `editor.getValue()` diretamente. Em modo multi-documento, precisam usar o conteúdo e nome do documento ativo do storage, e snapshots devem preservar a origem (docId).

**Approach:** (1) Handlers em main.js passam conteúdo do doc ativo via `getContent(activeDoc.id)`; (2) snapshots ganham campo `docId`; (3) snapshots legados são atribuídos ao doc ativo na migração.

## Boundaries & Constraints

**Always:** Conteúdo do doc ativo (não do editor) para ações; nome sanitizado para download; snapshots com docId; legado migrado; quality gate verde

**Ask First:** Mudança no schema de snapshots; remoção de funcionalidade existente

**Never:** Perder snapshots legados silenciosamente; quebrar ações existentes

</frozen-after-approval>

## Code Map

- `src/main.js` -- Handlers de ação: copy, copyHtml, exportHtml, exportPdf, snapshots. Precisam usar conteúdo do doc ativo
- `src/ui/snapshots.js` -- `pushSnapshot`, `maybeAutoSnapshot`. Precisam suportar `docId`
- `src/documents.js` -- `getActiveDocument`, `getContent`. Fonte de verdade do conteúdo
- `src/ui/exportPdf.js` -- `exportRasterFallback`, `exportPdfVector`. Já recebem `getMarkdown`
- `src/ui/exportHtml.js` -- `exportStandaloneHtml`. Recebe `getHtml` e `filename`
- `src/ui/copyRich.js` -- `copyRichHtml`. Recebe `getHtml` e `getPlain`

## Tasks & Acceptance

**Execution:**
- [ ] `src/ui/snapshots.js` -- Adicionar campo `docId` ao Snapshot type; `pushSnapshot` aceita `docId`; `migrateLegacySnapshots` atribui snapshots sem docId ao doc ativo
- [ ] `src/main.js` -- Handlers usam `getContent(activeDoc.id)` para conteúdo e `activeDoc.title` para nome; `maybeAutoSnapshot` recebe `docId`
- [ ] `tests/unit/snapshots.test.js` -- Adicionar testes para `docId` e migração de legado
- [ ] `tests/unit/documents.test.js` -- Verificar que ações usam conteúdo do doc ativo

**Acceptance Criteria:**
- Given doc ativo com conteúdo, when Copy/Export PDF/Export HTML, then usa conteúdo e nome do doc ativo
- Given snapshot criado, when listado, then tem `docId` do doc ativo
- Given snapshots legados sem `docId`, when migração roda, then são atribuídos ao doc ativo
- Given quality gate, when roda `npm run quality`, then verde

## Verification

**Commands:**
- `npm run quality` -- expected: verde (285+ tests)
- `npm run build` -- expected: build OK

**Manual checks:**
- Snapshots têm campo `docId`
- Ações usam conteúdo do doc ativo
- Snapshots legados são migrados
