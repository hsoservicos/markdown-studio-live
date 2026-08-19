# Reference: Contrato de storage — `src/storage.js`

Wrapper determinístico de `localStorage` que substitui o `storehouse-js` do upstream, preservando as **mesmas chaves**, para haver continência de dados de quem já usava o tool original.

## Chaves

| Chave                                    | Tipo           | Uso                      |
| ---------------------------------------- | -------------- | ------------------------ |
| `com.markdownstudio.last_state`          | string         | conteúdo salvo do editor |
| `com.markdownstudio.scroll_bar_settings` | string/bool    | sync de scroll           |
| `com.markdownstudio.theme_settings`      | string/bool    | tema dark/light          |
| `com.markdownstudio_theme` (raw, boot)   | 'dark'/'light' | anti-FOUC no `<head>`    |

Expiração padrão: **2099-02-01**.

## API

| Método                                       | Comportamento                                             |
| -------------------------------------------- | --------------------------------------------------------- |
| `getItem(namespace, key)`                    | retorna valor (ou `null`/`undefined` se ausente/expirado) |
| `setItem(namespace, key, value, expiresAt?)` | grava com expiração (default 2099)                        |
| `removeItem(namespace, key)`                 | remove                                                    |

## Uso recomendado

- Todo acesso via `src/storage.js`; `localStorage` bruto **apenas** no script de boot do tema.
- Namespace de Markdown-Studio: `com.markdownstudio`.

## Testes

`tests/unit/storage.test.js` valida: write/read round-trip, expiração futura, chaves ausentes, comportamento com booleans.
