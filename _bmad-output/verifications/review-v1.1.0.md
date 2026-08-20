# Análise BMAD — Markdown-Studio v1.1.0 (2026-08-19)

Verify/Analyse conduzido após release v1.1.0, com módulo **BMAD Method (bmm) v6.11.0**,
tool opencode. Método: revisão adversarial em camadas paralelas
(`bmad-code-review` step-architecture) — código, testes e produto.

## Achados (triagem)

| ID | Sev | Onde | Problema | Ação |
| -- | --- | ---- | -------- | ---- |
| A1 | Alta | `src/render/mermaid.js:40-67` | `render()` não reentrante: nova passagem pode rodar concorrente com a em voo (apenas version-guard, sem single-flight) → erro intermitente em digitação rápida/export | Single-flight da promise do render — **RESOLVIDO** |
| A2 | Alta | `src/main.js:109-122,239-243` | "Redefinir" não remove `last_state`: reload restaura o rascunho antigo (semântica de reset quebrada) | `removeItem(last_state)` no reset — **RESOLVIDO** |
| A3 | Alta | `.prettierignore`/`.markdownlint-cli2.yaml` | **JÁ CORRIGIDO**: `.agents/`, `_bmad/` e `snapshot` quebravam o quality gate (187 files) | Ignorets adicionados; gate verde |
| M1 | Média | `src/ui/exportPdf.js:58-71` | Race entre o re-render default (claro) e o debounce do tema escuro durante o `save()` do html2pdf | Estado "capturando" cancela debounce do mermaid — **RESOLVIDO** |
| M2 | Média | `src/main.js:64-89` | `convertAndRender` síncrono a cada tecla + recria nós `.mermaid` (jank em docs longas) | Debounce ~60-100ms mantendo save em 300ms — **RESOLVIDO** |
| M3 | Média | `index.html:13-35` vs `main.js:185-251` | Boot key do tema diverge da persistência (`theme_settings` vs `_theme`); anti-FOUC pode falhar em storage legado | Re-sincronizar boot key no init — **RESOLVIDO** |
| M4 | Média | `src/storage.js:19-44` | `getItem` sem validação de tipo na fronteira; `last_state` corrompido restaura em silêncio | Validar schema e lançar `StorageError` — **RESOLVIDO** |
| B1–B5 | Baixa | divider/files/sidebar | Acessibilidade do divisor, aria-label estático, perfil DOMPurify p/ recursos externos, input picker, duplo prompt em erro | **RESOLVIDO** — ver seção abaixo |

Positivos confirmados: nenhum XSS na cadeia `marked → DOMPurify`; mermaid em
`securityLevel:'strict'`; botões semânticos; `aria-live`; i18n com fallback segura.

## Lacunas de teste (prioridade)

1. Boot/`applyI18n`/restauração (`main.js:20-46,236-258`) — **RESOLVIDO** (`i18nElements.test.js`, `resolveBootInput` testado em `editorActions.test.js`).
2. Mermaid: `scheduleMermaidRender` e guard de versão com 0 cobertura — **PARCIAL** (`mermaid.test.js` novo cobre single-flight e pause/resume; guard de versão coberto indiretamente no 2º teste).
3. `setupDivider` (`src/ui/divider.js`) — **RESOLVIDO** (`divider.test.js`, 7 testes).
4. Sanitização do conteúdo ` ```mermaid ` (`convert.js:44`, escapeHtml) — **RESOLVIDO** (`convert.test.js` estendido com injeção `<script>`/`<img`).
5. Fallbacks de arquivo Safari/Firefox (`files.js`, `fileInputPicker`, erro createWritable) — **RESOLVIDO** (`files.test.js`, `sidebar.test.js`).

Risco de falso positivo: mock de `html2pdf.js` (vi.hoisted) valida só ordem/args;
coberto na prática pelo probe e2e `pdf_probe.js` (header `%PDF-` real).

## Correções aplicadas (A1/A2/M1/M2)

Commit de robustez pós-release, 2026-08-19, 10 arquivos alterados, 86 testes verdes:

- **A1 — single-flight mermaid** (`src/render/mermaid.js`): `renderMermaidDiagramsIn` aguarda a passagem em voo (`renderInFlight`) antes de iniciar a próxima; o version-guard continua impedindo escrita de SVG obsoleto. Testes em `tests/unit/mermaid.test.js`: serialização de chamadas concorrentes, version-guard com SVG stale e root nulo.
- **A2 — reset durável** (`src/ui/editorActions.js` + `src/main.js`): `resetMarkdownEditor` faz `removeItem(NAMESPACE, KEYS.lastState)` após limpar — reload volta ao template do idioma corrente. O reset/novo arquivo foi extraído do boot para módulo testável. Testes em `tests/unit/editorActions.test.js` (5): remove/cancela preserva/no-confirm/alvo do novo arquivo.
- **M1 — export PDF estável** (`src/ui/exportPdf.js` + `mermaid.js`): `pauseMermaidScheduling`/`resumeMermaidScheduling` cancelam o debounce do mermaid durante a captura; restauração do tema dark só após `resume`. Testes em `exportPdf.test.js` (pause/resume em sucesso e erro) e `mermaid.test.js` (pausado cancela pendente; resume reativa).
- **M2 — digitação fluida** (`src/main.js`): `scheduleConvertAndRender` (debounce 80ms) no `onDidChangeModelContent`; `scheduleSave` continua 300ms.
- **Infra**: `_bmad-output/` adicionado a `.prettierignore` e `.markdownlint-cli2.yaml` (artefatos BMAD fora do gate).

## Correções aplicadas (M3/M4 + lacunas de teste)

Commit subsequente, 2026-08-19, 115 testes verdes em 12 arquivos:

- **M3 — boot key de tema re-sincronizada** (`src/main.js`): `initThemeToggle` grava `com.markdownstudio_theme` a partir da persistência (`theme_settings`) a cada init — storage legado com boot key ausente/incoerente deixa de causar double-flip de tema no próximo load. Validado por probe e2e (`theme_boot_probe.js`): boot key divergente, `theme_settings` corrompido, legado raw `'1'`, `last_state` objeto e storage vazio — todos com boot limpo e re-sync correto.
- **M4 — leitura tipada na fronteira** (`src/storage.js`): `getItem(namespace, key, { type })` valida o schema ao ler; booleano legado (`true/false/1/0`) é normalizado; tipo inesperado lança `StorageError` (sem restauração silenciosa). O boot usa `safeGet` (null → fallback). Testes adicionados em `tests/unit/storage.test.js` (14).
- **Lacuna 1 — boot/i18n/restauração**: `applyI18n` extraído para `src/ui/i18nElements.js` (testável) e o cliente boot `resolveBootInput` adicionado a `editorActions.js` — 8 testes novos (`i18nElements.test.js`, `editorActions.test.js`).
- **Lacuna 2 — divisor**: `tests/unit/divider.test.js` novo (7 testes) cobrindo drag, dblclick, resize proporcional e ausência de elementos.
- **Lacuna 4 — sanitização de bloco mermaid**: `convert.test.js` estendido com escape de conteúdo injetado dentro de ```mermaid``` (`<script>`, `<img`), incluindo re-serialização literal após DOMPurify.
- **Lacuna 5 — fallbacks de arquivo**: `files.test.js` (14) cobre `supportsOpenPicker`/`supportsWriteOn`; `sidebar.test.js` (22) cobre input legado Safari/Firefox e erro de `createWritable`.

## Propostas de novas features

Ver `features-proposals.md` no mesmo diretório (P0: configuração de página, quebras
conscientes, estatísticas, TOC, KaTeX — todas usam o que já existe no repo; v2: PDF
vetorial, múltiplos documentos, snapshots locais).

## Correções aplicadas (B1–B5)

Bloco de refinamentos baixa-severidade, 2026-08-20, 187 testes verdes:

- **B1 — divisor acessível por teclado** (`src/ui/divider.js`): `tabindex`, setas
  ±2%, Home/End nos limites, `aria-valuenow` (0–100) e `aria-orientation`
  sincronizado no resize (vertical/horizontal conforme `isStacked()`). Testes em
  `divider.test.js` (12 total, 5 novos).
- **B2 — aria-label estático** (`index.html`, `src/i18n`): toggles da sidebar e
  divisor com fallback `aria-label` no HTML + `data-i18n-aria-label`
  (`sidebarOpen`/`dividerLabel`, pt/en).
- **B3 — perfil DOMPurify** (`src/render/convert.js`): `ALLOWED_URI_REGEXP` +
  hook `afterSanitizeAttributes` (links http(s) ganham `target="_blank"` +
  `rel="noopener noreferrer"`). Testes em `convert.test.js` (21 total, 4 novos).
- **B4 — input picker** (`src/ui/sidebar.js`): `fileInputPicker` remove o input
  só após `change`/`cancel` (remoção imediata pós-`click()` cancelava o diálogo
  em alguns navegadores). Teste de cancel/cleanup em `sidebar.test.js`.
- **B5 — prompt único em erro** (`src/ui/exportPdf.js`, `sidebar.js`):
  `pdfUnavailable` sai do `window.alert` para o canal de status `aria-live`;
  `AbortError` no openFileDialog segue silencioso. Testes atualizados/novos em
  `exportPdf.test.js` e `sidebar.test.js` (24 total).