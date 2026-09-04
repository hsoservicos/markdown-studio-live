---
title: 'Story 2.1: Índice de documentos no storage'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: '074a8261b9995b2ddea12cadaa4aaf2011da92ab'
review_loop_iteration: 0
context:
  - spec-v2.md
  - _bmad-output/implementation-artifacts/epic-2-context.md
  - docs/reference/storage-contract.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** o app assume um único documento (`KEYS.lastState`), sem identidade por artefato; abrir outro documento destruiria o rascunho atual e não há como persistir múltiplos documentos locais.

**Approach:** criar uma camada de storage de documentos sobre `src/storage.js` — um índice versionado em `com.markdownstudio.documents` + conteúdo por `com.markdownstudio.documents.content.<id>` — sem UI, pura e testável, com gravação atômica e tratamento de quota/security.

## Boundaries & Constraints

**Always:**
- Persistência apenas via `src/storage.js` (`localStorage`), nenhuma chamada externa em runtime.
- Índice: `{ version: 1, activeId, documents: [{ id, title, updatedAt }] }` em `com.markdownstudio.documents`.
- Conteúdo por id: `com.markdownstudio.documents.content.<id>` (string Markdown).
- Chaves de storage apenas com caracteres seguros (hex UUID) — nunca derivadas do título.
- `documents.*` é a fonte de verdade; `last_state` continua espelhando o documento ativo.
- Gravação índice + conteúdo é **atômica**: se uma falhar, nenhuma é aplicada.
- ids via `crypto.randomUUID()` com fallback `Date.now()` + `Math.random()`.
- `QuotaExceededError` → aviso i18n e última versão salva intacta.
- `SecurityError` (storage desabilitado em modo privado) → capturado, reportado via retorno/canal de status, sem crash.
- `safeGet` (leitura tipada que degrada a `null`) como mecanismo de leitura na fronteira.

**Ask First:**
- Se for necessário alterar o schema do índice (`version`) além de `1`, parar e consultar o usuário.
- Política de retenção/limpeza de `com.markdownstudio.backup` legado durante a migração.

**Never:**
- UI nesta story (sem sidebar, sem gerenciador visual — isso é 2.2).
- Migração completa de `last_state`/backup neste escopo (é 2.4), só o contrato de leitura/incialização do índice.
- Múltiplas abas simultâneas do mesmo navegador (última escrita vence, documentado, não suportado).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | `createDocument('Rascunho')` | novo id, entrada no índice, conteúdo vazio (template do idioma como valor inicial opcional), `activeId` atualizado | N/A |
| GET_CONTENT | `setContent(id, 'x'); getContent(id)` | round-trip idêntico | `StorageError` propagado |
| ATOMIC_WRITE | grava índice + conteúdo | ambas aplicadas ou nenhuma | se `setItem` lançar `QuotaExceededError`/`SecurityError`, reverter a chave já gravada e reportar |
| CORRUPT_INDEX | índice não-objeto ou `version !== 1` | `safeGetIndex()` → `null`/estado vazio; degrada sem crash | aviso i18n para debug/reparo |
| DUP_ID | índice com ids duplicados | dedupe mantendo o de maior `updatedAt` | aviso i18n de limpeza |
| STORAGE_DISABLED | `localStorage` lança `SecurityError` | operação retorna erro tipado, sem crash | `StorageError` com `cause`; canal de status |
| QUOTA_EXCEEDED | `setItem` lança `QuotaExceededError` | última versão salva preservada | aviso i18n `quotaExceeded` |

</frozen-after-approval>

## Code Map

- `src/storage.js` -- wrapper localStorage; `validateValue` só valida boolean/string/number → estender com `type: 'object'`. `getItem`/`setItem`/`removeItem`/`StorageError`.
- `src/i18n/index.js` -- string tables `ptBR`/`enUS`; `t(key)` falls back ao key. Adicionar chaves de aviso (quota/security).
- `src/ui/snapshots.js:18` -- exemplo de geração de id (`makeId` com `Math.random().toString(36)`); referência de estilo.
- `tests/unit/storage.test.js` -- padrão de teste com jsdom `localStorage` real + `store().clear()` em `beforeEach`/`afterEach`.
- `src/main.js:36-42` -- `safeGet` local; novo módulo reutiliza esse contrato (degrade a `null`).
- `docs/reference/storage-contract.md` -- documentação a atualizar com as novas chaves.

## Tasks & Acceptance

**Execution:**
- [x] `src/storage.js` -- estender `validateValue` com `type: 'object'` (validação de objeto não-nulo) e exportar `safeGet` como helper de leitura tipada que degrada a `null` -- contrato de leitura na fronteira.
- [x] `src/documents.js` (novo) -- módulo puro da camada de documentos: `INDEX_KEY`/`CONTENT_PREFIX`, `createId()`, `safeGetIndex()`, `saveIndex(index)`, `getContent(id)`, `setContent(id, value)`, `createDocument({ title })`, `updateTitle(id, title)`, `deleteDocument(id)`, `listDocuments()`, `setActive(id)`, `getActiveDocument()`, gravação atômica, dedupe de ids, tratamento de `QuotaExceededError`/`SecurityError` -- camada de índice sem UI.
- [x] `src/i18n/index.js` -- adicionar chaves `quotaExceeded` e `storageDisabled` (pt-BR + en) -- feedback de erro usuário.
- [x] `tests/unit/documents.test.js` (novo) -- cobrir happy path, round-trip conteúdo, atomicidade (mock setItem falha na 2ª chave → reverter 1ª e reportar), corrupção do índice, dedupe de ids, `SecurityError`/`QuotaExceededError`, ids `crypto.randomUUID` + fallback -- testes na menor camada.
- [x] `tests/unit/storage.test.js` -- adicionar casos `type: 'object'` (round-trip, objeto inválido lança `StorageError`) -- validar extensão de validação.
- [x] `docs/reference/storage-contract.md` -- documentar `com.markdownstudio.documents`, `com.markdownstudio.documents.content.<id>`, `safeGet` exportado e `type: 'object'` -- manter doc de referência fiel (repo hygiene).

**Acceptance Criteria:**
- Given um índice ausente/sem schema, when `safeGetIndex()` é chamado, then retorna estado vazio sem crash e sem lançar.
- Given conteúdo setado em um id, when `getContent(id)` é lido, then round-trip é exato.
- Given gravação atômica falha (2ª chave), when a operação roda, then a 1ª chave é revertida e um erro tipado é reportado.
- Given índice com ids duplicados, when inicializado, then ids únicos e mantém o maior `updatedAt`, com aviso.
- Given `localStorage` lança `SecurityError`/`QuotaExceededError`, when a gravação roda, then nenhuma corrupção parcial e feedback via canal (i18n), sem crash.
- Given `type: 'object'` usado, when leio um valor não-objeto, then `StorageError` é lançado.
- Tests unitários verdes e quality gate verde (`npm run quality`).

## Design Notes

- **Atomicidade sem transação real:** gravar 1ª chave; se a 2ª falhar, `removeItem`/restauração da 1ª ao valor anterior. Ou escrever num temp e commitar — manter simples: escrever índice, depois conteúdo; reverter índice se conteúdo falhar.
- **`safeGet` exportado:** promove o helper local de `main.js` para `storage.js` (leitura tipada que degrada a `null`), reutilizado por todos os módulos de leitura.
- **`createId`:** `crypto.randomUUID?.() ?? (\`${Date.now()}-${Math.random().toString(36).slice(2,8)}\`)` — hex seguro para chave.
- **Dedupe:** agrupar por `id`, mantero de maior `updatedAt`.

## Verification

**Commands:**
- `npm test` -- expected: todos os testes verdes (incl. novos `documents.test.js` e casos `storage.test.js`).
- `npm run quality` -- expected: format + lint + lint:md + test verdes (pre-push gate).

## Suggested Review Order

**Entry point — schema e fronteira**

- `safeGetIndex` materializa o índice versionado com dedupe e reparo de activeId órfão; comece aqui.
  [`documents.js:38`](../../src/documents.js#L38)

**Atomicidade das gravações**

- `atomicWrite` garante que índice+conteúdo sejam aplicados juntos, revertendo a 1ª chave se a 2ª falhar; erro tipado `.code` na falha.
  [`documents.js:98`](../../src/documents.js#L98)

- A gravação incondicionada do índice (`saveIndex`) classifica quota/security em todas as mutações.
  [`documents.js:96`](../../src/documents.js#L96)

**Mutações do índice**

- `createDocument` insere no índice e torna ativo o novo documento, com conteúdo inicial.
  [`documents.js:124`](../../src/documents.js#L124)

- `setContent` grava o corpo e atualiza `updatedAt`; manutenção de metadata não quebra o round-trip do conteúdo.
  [`documents.js:186`](../../src/documents.js#L186)

- `deleteDocument` promove o próximo documento quando o ativo é removido e tolera conteúdo órfão.
  [`documents.js:158`](../../src/documents.js#L158)

**Validação de tipo no storage**

- `validateValue` ganhou `type: 'object'` (rejeita null/array).
  [`storage.js:40`](../../src/storage.js#L40)

- `safeGet` exportado degrada a `defaultValue` em vez de propagar `StorageError`.
  [`storage.js:124`](../../src/storage.js#L124)

**Suporte (i18n + config)**

- Chaves de aviso `quotaExceeded`/`storageDisabled` (pt-BR + en).
  [`index.js:39`](../../src/i18n/index.js#L39)

**Testes e qualidade**

- 17 casos cobrindo happy path, atomicidade, quota/security e dedupe da camada.
  [`documents.test.js:32`](../../tests/unit/documents.test.js#L32)

- 20 casos do wrapper, incluindo `type: 'object'` e `safeGet`.
  [`storage.test.js:118`](../../tests/unit/storage.test.js#L118)
