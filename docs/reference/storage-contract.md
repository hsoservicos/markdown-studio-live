# Reference: Contrato de storage — `src/storage.js`

Wrapper determinístico de `localStorage` que substitui o `storehouse-js` do upstream,
preservando as **mesmas chaves legadas**, para haver continência de dados de quem já usava
o tool original.

Nem toda persistência passa pelo wrapper: a tabela abaixo marca se a chave é gerida pelo
`src/storage.js` (envelope JSON + expiração) ou gravada/lida **crua** por módulos
específicos (valor simples, sem envelope).

## Chaves

| Chave                                    | Tipo                 | Acesso        | Uso                                     |
| ---------------------------------------- | -------------------- | ------------- | --------------------------------------- |
| `com.markdownstudio.last_state`          | string               | wrapper       | conteúdo salvo do editor                |
| `com.markdownstudio.scroll_bar_settings` | boolean              | wrapper       | sync de scroll (editor → preview)       |
| `com.markdownstudio.theme_settings`      | boolean              | wrapper       | tema dark/light (fonte de verdade)      |
| `com.markdownstudio.backup`              | `Snapshot[]` (máx 5) | wrapper       | anel de snapshots locais (P1-8)         |
| `com.markdownstudio.locale`              | `'pt-BR'` / `'en'`   | crua (módulo) | idioma da interface                     |
| `com.markdownstudio.print_settings`      | JSON string          | crua (módulo) | configuração de impressão/PDF (P0-1)    |
| `com.markdownstudio.sidebar_collapsed`   | `'1'` / `'0'`        | crua (módulo) | estado recolhido do drawer/sidebar      |
| `com.markdownstudio_theme` (raw, boot)   | `'dark'` / `'light'` | crua (boot)   | anti-FOUC no `<head>` (espelho de tema) |

Expiração padrão (wrapper): **2099-02-01** (padrão herdado do upstream).

## API do wrapper

| Método                                       | Comportamento                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| `getItem(namespace, key, { type })`          | lê com validação de tipo; `null` se ausente/expirado; `StorageError` em schema |
| `setItem(namespace, key, value, expiresAt?)` | grava envelope `{ value, expiresAt }` (default 2099)                           |
| `removeItem(namespace, key)`                 | remove a chave                                                                 |
| `getRaw(key)` / `setRaw(key, value)`         | acesso cru (sem envelope) — usado pelo script de boot do tema                  |

### Regras de leitura

- O wrapper serializa como `{ value, expiresAt }`; leituras de **valores legados não-JSON**
  são devolvidas cruas (compatibilidade com o upstream).
- `getItem(..., { type: 'boolean' })` normaliza legado `true/false/1/0`; fragmentos com
  schema inesperado lançam `StorageError` em vez de restaurar silenciosamente.
- No boot, `safeGet` (em `src/main.js`) envolve a leitura e degrada para `null` (fallback
  ao padrão) se o storage lançar.

## Uso recomendado

- Conteúdo, tema e scroll **sempre** via wrapper (`src/storage.js`).
- Módulos com necessidades específicas (idioma, impressão, sidebar) leem/gravam a chave
  crua completa com fallback para o padrão em caso de erro.
- `localStorage` bruto **apenas** no script de boot do tema (`com.markdownstudio_theme`).

## Testes

`tests/unit/storage.test.js` valida: round-trip write/read, expiração, chaves ausentes,
normalização de booleanos legados, erro de tipo na fronteira (`StorageError`) e helpers
`getRaw`/`setRaw`.
