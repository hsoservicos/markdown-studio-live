# Reference: Contrato de storage — `src/storage.js`

Wrapper determinístico de `localStorage` que substitui o `storehouse-js` do upstream,
preservando as **mesmas chaves legadas**, para haver continência de dados de quem já usava
o tool original.

Nem toda persistência passa pelo wrapper: a tabela abaixo marca se a chave é gerida pelo
`src/storage.js` (envelope JSON + expiração) ou gravada/lida **crua** por módulos
específicos (valor simples, sem envelope).

## Chaves

| Chave                                       | Tipo                                 | Acesso        | Uso                                     |
| ------------------------------------------- | ------------------------------------ | ------------- | --------------------------------------- |
| `com.markdownstudio.last_state`             | string                               | wrapper       | conteúdo salvo do editor                |
| `com.markdownstudio.scroll_bar_settings`    | boolean                              | wrapper       | sync de scroll (editor → preview)       |
| `com.markdownstudio.theme_settings`         | boolean                              | wrapper       | tema dark/light (fonte de verdade)      |
| `com.markdownstudio.backup`                 | `Snapshot[]` (máx 5)                 | wrapper       | anel de snapshots locais (P1-8)         |
| `com.markdownstudio.locale`                 | `'pt-BR'` / `'en'`                   | crua (módulo) | idioma da interface                     |
| `com.markdownstudio.print_settings`         | JSON string                          | crua (módulo) | configuração de impressão/PDF (P0-1)    |
| `com.markdownstudio.sidebar_collapsed`      | `'1'` / `'0'`                        | crua (módulo) | estado recolhido do drawer/sidebar      |
| `com.markdownstudio_theme` (raw, boot)      | `'dark'` / `'light'`                 | crua (boot)   | anti-FOUC no `<head>` (espelho de tema) |
| `com.markdownstudio.documents`              | `{ version, activeId, documents[] }` | wrapper       | índice de documentos (P2-10)            |
| `com.markdownstudio.documents.content.<id>` | string                               | wrapper       | conteúdo Markdown por documento (P2-10) |
| `com.markdownstudio.pdf.vector`             | `'true'` / ausente                   | crua (módulo) | flag de PDF vetorial (pdfmake)          |

Expiração padrão (wrapper): **2099-02-01** (padrão herdado do upstream).

## API do wrapper

| Método                                             | Comportamento                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `getItem(namespace, key, { type })`                | lê com validação de tipo; `null` se ausente/expirado; `StorageError` em schema                                                        |
| `setItem(namespace, key, value, expiresAt?)`       | grava envelope `{ value, expiresAt }` (default 2099)                                                                                  |
| `removeItem(namespace, key)`                       | remove a chave                                                                                                                        |
| `getRaw(key)` / `setRaw(key, value)`               | acesso cru (sem envelope), com o mesmo embrulho de erro do `setItem`                                                                  |
| `safeGet(namespace, key, { type, defaultValue? })` | leitura tipada que degrada a `defaultValue` (padrão `null`) em vez de propagar `StorageError` — usado no boot e em camadas tolerantes |

### Regras de leitura

- O wrapper serializa como `{ value, expiresAt }`; leituras de **valores legados não-JSON**
  são devolvidas cruas (compatibilidade com o upstream). Envelope JSON **sem o campo `value`**
  é corrupção (B5): devolve `null` — devolver a string crua restauraria lixo no editor.
- `getItem(..., { type: 'boolean' })` normaliza legado `true/false/1/0`; `{ type: 'object' }`
  valida objeto não-nulo/não-array; fragmentos com schema inesperado lançam `StorageError`
  em vez de restaurar silenciosamente.
- No boot e em camadas tolerantes, `safeGet` envolve a leitura e degrada para `null`
  (ou `defaultValue`) se o storage lançar, sem propagar `StorageError`.
- O índice de documentos tem leitura **memoizada pela string crua** (D12): `getActiveDocument`
  roda em toda tecla (captura do doc no autosave) e o `JSON.parse` do índice inteiro era o
  custo dominante. Mudanças — inclusive de outra aba — invalidam naturalmente, porque a
  comparação é pelo valor bruto.
- Schema versionado (E1): `raw.version` maior que `INDEX_VERSION` degrada para índice vazio
  com o aviso `indexVersion` — interpretar campos de um app mais novo é chute.
- `getRaw`/`setRaw` **não têm chamador em produção**. O script de boot do tema lê
  `localStorage` direto (ele roda no `<head>`, antes de qualquer módulo existir) e os demais
  módulos de chave crua (`locale`, `print_settings`, `sidebar_collapsed`, `pdf.vector`) usam
  `localStorage` com `try`/`catch` próprio. Os helpers ficam como API do wrapper — e são
  exercitados por `tests/unit/storage.test.js`.

### Regras de gravação (M13)

- `setItem`, `setRaw` e `removeItem` **embrulham** qualquer exceção do `localStorage` em
  `StorageError`, preservando o erro original em `cause` — é `cause.name`, e não
  `StorageError.name` (sempre `'StorageError'`), que a classificação lê.
- `classifyError` (`src/documents.js`) olha `cause.name` antes de `name`:
  `QuotaExceededError` → `'quota'`, `SecurityError` → `'security'`, resto → `'generic'`.
- `atomicWrite` (índice + conteúdo) reverte o índice quando a segunda gravação falha, então
  uma quota estourada não deixa o índice apontando para um documento sem conteúdo. A reversão
  é _best-effort_ e pode falhar junto (quota já cheia): `err.reverted` diz o que aconteceu, e
  a mensagem distingue `"…alteração revertida."` de `"…e a reversão do índice também
falhou."` — antes, a UI declarava a reversão incondicionalmente e escondia o caso pior.
- `setContent` segue o mesmo contrato (B2, AC-P2-10-1): índice + conteúdo é atômico — falha
  no índice reverte o conteúdo ao valor anterior (best-effort) e expõe `err.reverted`.
- Os avisos de restauração do boot (B5, AC-P2-10-4) saem de `safeGetIndexDetailed`/
  `getContentDetailed` (`activeIdFallback`, `indexCleaned`, `indexVersion`, `corruptContent`)
  e são anunciados uma vez em `#sidebar-status`.
- Snapshots (`com.markdownstudio.backup`): o anel de `MAX_SNAPSHOTS` tem guarda de quota (D4)
  — o snapshot é backup e recusa a escrita antes de comer a margem do rascunho primário; os
  legados sem `docId` migram para o documento ativo e os de um documento fechado migram para
  o ativo seguinte (B6, AC-P2-10-3).

## Uso recomendado

- Conteúdo, tema e scroll **sempre** via wrapper (`src/storage.js`).
- Módulos com necessidades específicas (idioma, impressão, sidebar, flag de PDF vetorial)
  leem/gravam a chave crua completa com fallback para o padrão em caso de erro.
- `localStorage` bruto **apenas** para a chave `com.markdownstudio_theme` (anti-FOUC) — uma
  vez no script do `<head>` e de novo no toggle de tema. Os dois acessos são diretos (o do
  `<head>` não poderia usar os módulos: ele roda antes deles existirem) e ambos vivem dentro
  de um `try`/`catch` próprio.

## Falha de gravação visível ao usuário (F2)

Os pontos de gravação (timer do autosave, seed do constructor, criar/renomear/alternar/fechar
documento, `reset` **e** a virada dos toggles de tema e de sync de scroll) passam por
`guardStorage(fn, { onFail })` em `src/ui/storageFeedback.js`:

| Função                     | Papel                                                                       |
| -------------------------- | --------------------------------------------------------------------------- |
| `storageFailureMessage(e)` | `classifyError` → `t('quotaExceeded' \| 'storageDisabled' \| 'saveFailed')` |
| `guardStorage(fn, …)`      | executa `fn`, loga em `console.error`, chama `onFail` e devolve `bool`      |
| retorno `false`            | o chamador **aborta** a operação seguinte (ex.: trocar de documento)        |

Sem o guard, uma `StorageError` virava erro silencioso no console e a perda só aparecia no
próximo reload. `saveCurrentContent` devolve `boolean`, e `handleSwitch` só troca de documento
se a gravação anterior foi bem-sucedida.

### O retorno é sobre a exceção, não sobre o valor de `fn`

`guardStorage` devolve `true` quando `fn` **não lançou** — ele não reflete o booleano que `fn`
devolveu, porque há domínios em que `false` significa sucesso (`deleteDocument` de um id que
já não existe) e outros em que significa recusa (`setActive`/`updateTitle` de um documento
apagado em outra aba). Quem precisa do booleano do domínio captura **dentro** do callback:

```js
let activated = false;
if (
  !guardStorage(() => {
    activated = setActive(id);
  })
)
  return;
if (!activated) return onStatus?.(t('docOpRefused'));
```

É o que `handleSwitch` e `handleRename` fazem: sem esse capture, o `false` do domínio passava
direto e a UI anunciava a troca/rename como gravado.

## Testes

`tests/unit/storage.test.js` valida round-trip write/read, expiração, chaves ausentes,
normalização de booleanos legados, erro de tipo na fronteira (`StorageError`), helpers
`getRaw`/`setRaw` e — em **M13** — a costura de gravação: `setItem`/`setRaw`/`removeItem` com
`QuotaExceededError`/`SecurityError` preservam `cause.name`, e `classifyError` +
`storageFailureMessage` escolhem a mensagem i18n correta a partir dele.

Complementos: `tests/unit/storageFeedback.test.js` (mensagem i18n e `guardStorage`) e
`tests/unit/documents-ui.test.js` (cada ponto de gravação reporta quota sem lançar).
