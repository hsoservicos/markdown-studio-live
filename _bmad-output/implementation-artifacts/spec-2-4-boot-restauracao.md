---
title: 'Boot com restauração de documentos'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: 'b32bda3cd2b0a73c65a886c756ade103fe0991a8'
context:
  - src/main.js
  - src/documents.js
  - src/ui/editorActions.js
  - src/i18n/index.js
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O boot atual lê `last_state` diretamente. Em modo multi-documento, precisa restaurar o índice de documentos, o doc ativo, e migrar `last_state` legado para um documento.

**Approach:** (1) No boot, checar se existe índice `documents.*`; (2) se existe, restaurar doc ativo e carregar conteúdo; (3) se não, migrar `last_state` legado para um documento; (4) tratar conteúdo corrompido com aviso.

## Boundaries & Constraints

**Always:** Índice é fonte de verdade no boot; `last_state` espelha doc ativo; migração legado preserva `last_state` original; conteúdo corrompido degrada com aviso; quality gate verde

**Ask First:** Mudança no fluxo de boot existente

**Never:** Perder dados silenciosamente; crash em boot; remover `last_state` antes de migração confirmada

</frozen-after-approval>

## Code Map

- `src/main.js` -- Boot: lê `last_state`, resolve boot input, setup editor. Precisa restaurar docs
- `src/documents.js` -- `safeGetIndex`, `getActiveDocument`, `getContent`, `setContent`, `createDocument`, `setActive`. Já tem normalização e dedup
- `src/ui/editorActions.js` -- `resolveBootInput`. Decide entre template e conteúdo salvo
- `src/storage.js` -- `safeGet`, `getItem`. Leitura tipada na fronteira

## Tasks & Acceptance

**Execution:**
- [ ] `src/main.js` -- No boot, após setupEditor: (1) `safeGetIndex()`; (2) se docs existem, `getActiveDocument()` e `getContent(activeId)` → `editor.setValue(content)`; (3) se vazio e `last_state` legado existe e não é template, `createDocument({title: 'Documento restaurado', initialContent: lastState})`
- [ ] `src/i18n/index.js` -- Adicionar `docRestored: 'Documento restaurado'` (pt-BR + en)
- [ ] `tests/unit/boot.test.js` -- Testes: boot com índice, boot com last_state legado, boot com conteúdo corrompido, boot com índice vazio

**Acceptance Criteria:**
- Given índice com docs, when boot, then doc ativo é restaurado no editor
- Given last_state legado não-template, when boot sem índice, then doc "Documento restaurado" é criado
- Given índice vazio sem last_state, when boot, then template do idioma é usado
- Given conteúdo corrompido, when boot, then doc é ignorado com aviso
- Given quality gate, when roda `npm run quality`, then verde

## Verification

**Commands:**
- `npm run quality` -- expected: verde (285+ tests)
- `npm run build` -- expected: build OK

**Manual checks:**- Boot com índice existente restaura doc ativo
- Migração de last_state cria "Documento restaurado"
- Conteúdo corrompido não causa crash
