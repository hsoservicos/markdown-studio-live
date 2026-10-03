# Deferred Work

## Deferred from: code review of spec-v2.md (2026-10-03)

- KaTeX inline sem heurística de moeda ("custo $5 … total $10" vira math) — [src/render/katexExt.js]
- i18n sem paridade de chaves, plural ou negociação de `navigator.language` na primeira carga — [src/i18n/index.js]
- Quota medida só no boot (sem rechecagem em sessão longa) — [src/main.js:581]
