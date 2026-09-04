---
title: 'Gerenciador de documentos (UI)'
type: 'feature'
created: '2026-09-04'
status: 'ready-for-dev'
baseline_commit: 'b32bda3cd2b0a73c65a886c756ade103fe0991a8'
context:
  - src/documents.js
  - src/ui/sidebar.js
  - src/main.js
  - src/i18n/index.js
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A camada de dados multi-documento (`documents.js`) está pronta, mas não há UI para criar, renomear, alternar e fechar documentos. O usuário precisa de uma lista visível na sidebar.

**Approach:** Criar `src/ui/documents.js` com `setupDocumentManager` que renderiza uma lista de documentos na sidebar, com ações de criar/renomear/alternar/fechar, operável por teclado com `aria-current`.

## Boundaries & Constraints

**Always:** Nomes trim, não vazios, ≤128 chars, únicos (sufixo numérico); confirmação antes de descartar (newFileConfirm); aria-current no ativo; foco visível; i18n pt-BR/en; quality gate verde

**Ask First:** Mudança no layout da sidebar; adição de elementos visuais fora do design "The Quiet Studio"

**Never:** Remover funcionalidade existente da sidebar; quebrar persistência existente

</frozen-after-approval>

## Code Map

- `src/documents.js` -- Camada de dados: `createDocument`, `updateTitle`, `setActive`, `deleteDocument`, `listDocuments`, `getActiveDocument`, `getContent`, `setContent`. Pronta para uso pela UI
- `src/ui/sidebar.js` -- Sidebar atual: toggle, ações, dialogs. O gerenciador de documentos será adicionado como seção na sidebar
- `src/main.js` -- Boot: setupEditor, setupSidebarActions. Precisa integrar o gerenciador
- `src/i18n/index.js` -- Strings i18n: `docNew`, `docRename`, `docClose`, `docDefaultName` etc.

## Tasks & Acceptance

**Execution:**
- [ ] `src/ui/documents.js` -- `setupDocumentManager({ container, editor, getContent, onStatus })`: renderiza lista de docs na sidebar, ações criar/renomear/alternar/fechar
- [ ] `src/i18n/index.js` -- Adicionar chaves: `docNew`, `docRename`, `docClose`, `docDefaultName`, `docNameConflict`, `docEmpty`
- [ ] `src/main.js` -- Integrar `setupDocumentManager` no boot, conectar com editor
- [ ] `tests/unit/documents-ui.test.js` -- Testes: criar doc, renomear (trim, vazio, duplicata), alternar, fechar, aria-current, teclado

**Acceptance Criteria:**
- Given sidebar aberta, when usuário clica "Novo documento", then novo doc é criado e se torna ativo
- Given documento ativo, when usuário renomeia com nome duplicado, then sufixo numérico é adicionado (ex: "Documento (2)")
- Given documento ativo, when fecha, then próximo é promovido (ou template se vazio)
- Given documento com conteúdo, when fecha sem salvar, then confirmação newFileConfirm aparece
- Given lista de docs, when navega por teclado, then aria-current no ativo e foco visível
- Given quality gate, when roda `npm run quality`, then verde

## Verification

**Commands:**
- `npm run quality` -- expected: verde (285+ tests)
- `npm run build` -- expected: build OK

**Manual checks:**
- Lista de documentos visível na sidebar
- Ações criar/renomear/alternar/fechar funcionam
- Nomes duplicados recebem sufixo numérico
