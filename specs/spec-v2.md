---
title: Markdown-Studio v2 Spec (P2)
created: 2026-09-04
updated: 2026-09-04
module: Markdown-Studio
status: approved
---

# Spec v2 — Markdown-Studio (features P2)

Objetivo: **duas remodelagens coesas** — (P2-9) PDF com texto vetorial pesquisável e (P2-10)
múltiplos documentos locais — derivadas das propostas P2 em
`_bmad-output/verifications/features-proposals.md` e detalhadas em
`_bmad-output/planning-artifacts/epics-p2.md`.

Princípios preservados (PRODUCT.md): offline, sem backend, sem rastreamento, localStorage,
deps npm sem CDN, pt-BR primeiro, design "The Quiet Studio", quality gate verde.

## Pronto para Desenvolvimento

- **Actionable** ✅ — epics/stories com caminhos em `_bmad-output/planning-artifacts/epics-p2.md`.
- **Testable** ✅ — ACs Given/When/Then abaixo (canônicas; cada story referencia a sua por id).
- **Complete** ✅ — escopo aprovado; ACs de compatibilidade, fallback e quota incluídas.
- **Coherent** ✅ — sem contradições com PRD/spec-v1/PRODUCT.md.

## Escopo

### Epic P2-A — PDF com texto vetorial pesquisável (story 1.1–1.4)

### Epic P2-B — Múltiplos documentos locais (story 2.1–2.4)

## ACs (Given/When/Then)

> As ACs abaixo são **canônicas**. As stories em `_bmad-output/planning-artifacts/epics-p2.md`
> referenciam os ACs por id e só acrescentam critérios de implementação — nenhum AC é
> duplicado textualmente entre os dois documentos.

### AC-P2-9-1 — PDF pesquisável

- **Given** um documento Markdown renderizado no preview
- **When** o usuário exporta o PDF
- **Then** títulos, parágrafos, listas, tabelas, citações (`blockquote`), código (inline e
  fenced) e o texto de links são texto vetorial pesquisável (Ctrl+F e seleção funcionam no
  leitor)
- **And** margem, papel (A4/Letter), orientação e cabeçalho/rodapé com `{page}` (P0-1)
  continuam aplicados

### AC-P2-9-2 — Diagramas e matemática no PDF vetorial

- **Given** documento com blocos `mermaid` e fórmulas KaTeX `$…$`/`$$…$$`
- **When** o PDF vetorial é gerado
- **Then** os diagramas aparecem como SVG embutido (reutilizando o SVG do mermaid já
  renderizado no preview) e as fórmulas KaTeX são embutidas como rasterização de **alta
  resolução** (PNG 3× via `html2canvas`, contrato de 2026-10-03: o KaTeX não oferece saída
  `svg` — o enum é `htmlAndMathml|html|mathml` — então a rota vetorial usa raster 3× como
  limite de fidelidade; migração a MathJax/SVG só se pesquisabilidade de fórmulas virar
  requisito)
- **And** quebras de página conscientes (P0-2) permanecem respeitadas
- **And** o formato suportado por tipo de conteúdo (texto/SVG/imagem) fica registrado no
  mapeamento da rota (Story 1.1 → ADR)

### AC-P2-9-3 — Fallback e erro claro

- **Given** a lib de PDF vetorial indisponível ou falha na geração
- **When** o usuário clica em Exportar PDF
- **Then** o status reporta `pdfUnavailable`/`exportError` no canal `aria-live` (sem prompt
  duplo — B5)
- **And** o fallback rasterizado atual permanece como default enquanto a feature-flag
  `com.markdownstudio.pdf.vector` estiver desabilitada
- **And** a flag é habilitada via `localStorage` com chave
  `com.markdownstudio.pdf.vector` (default `false`); o flip é registrado em
  `docs/explanation/architecture.md` (ADR) com critérios de estabilidade: CI verdes por
  pelo menos 2 releases consecutivas e fidelidade validada nos navegadores suportados
- **And** testes unitários cobrem sucesso e erro (mock da lib, sem rede)

### AC-P2-10-1 — Índice e isolamento de documentos

- **Given** um documento ativo com conteúdo editado
- **When** um segundo documento é criado/aberto
- **Then** cada documento persiste sob chaves estruturadas: índice em
  `com.markdownstudio.documents` (objeto com `version`, `activeId`, `documents[]`) e
  conteúdo em `com.markdownstudio.documents.content.<id>` (string Markdown)
- **And** o índice tem schema versionado
  (`{ version: 1, activeId: string, documents: [{ id, title, updatedAt }] }`) e o
  conteúdo de cada documento fica em chave própria por `id`
- **And** `safeGet` é estendido para suportar `type: 'object'` na validação de leitura
  (o índice é objeto, não primitivo)
- **And** ids são gerados por `crypto.randomUUID()` (com fallback para `Date.now()` +
  `Math.random()`), nunca derivados do título — evita colisão e caracteres inválidos em
  chave de storage
- **And** `last_state`/`backup` continuam funcionando: em modo multi-documento, `last_state`
  espelha o documento ativo e `documents.*` é a fonte de verdade no boot
- **And** `QuotaExceededError` no salvamento dispara aviso i18n e mantém a última versão
  salva intacta (sem perda silenciosa)
- **And** gravação do índice + conteúdo é atômica: se uma falhar, nenhuma é aplicada
- **And** `SecurityError` (storage desabilitado em modo privado) é capturado e reportado
  via `aria-live` com aviso i18n, sem crash

### AC-P2-10-2 — Gerenciador de documentos

- **Given** o editor aberto com a sidebar
- **When** o usuário cria/renomeia/alterna/fecha documentos
- **Then** a UI reflete o documento ativo e persiste o documento corrente
- **And** nomes são normalizados (trim), não vazios, com limite de 128 caracteres e
  únicos — duplicatas recebem sufixo numérico automático (ex.: `Documento`,
  `Documento (2)`, `Documento (3)`); validação com feedback i18n
- **And** fechar o documento ativo promove o próximo da lista (ou abre o template se a
  lista esvaziar)
- **And** há confirmação antes de descartar conteúdo não salvo (`newFileConfirm`)
- **And** a lista é operável por teclado, com `aria-current` no documento ativo e foco
  visível (NFR-5)

### AC-P2-10-3 — Ações operando no documento ativo

- **Given** múltiplos documentos abertos
- **When** o usuário usa Copy/Export PDF/Export HTML/Snapshots
- **Then** a ação usa o conteúdo e o nome do documento ativo, com nome de arquivo
  sanitizado para download (PDF/HTML)
- **And** snapshots preservam a origem (id do documento + etiqueta)
- **And** snapshots legados sem origem (pré-P2) são atribuídos ao documento ativo na
  migração ou mantidos em raiz "legado" — nunca perdidos silenciosamente
- **And** ao deletar um documento, seus snapshots são migrados para o documento ativo ou
  removidos com confirmação — sem origem pendurada
- **And** backup legado (chave `com.markdownstudio.backup`) é atribuído ao documento
  ativo na primeira carga P2 ou mantido em raiz "legado" — sem backup órfão

### AC-P2-10-4 — Boot com restauração

- **Given** documentos abertos e um documento ativo na sessão anterior
- **When** a página recarrega
- **Then** a lista é restaurada e o documento ativo reabre
- **And** índice vazio/corrompido degrada para o template do idioma corrente sem crash
- **And** id ativo ausente do índice → fallback para o primeiro documento ou template, com
  aviso
- **And** conteúdo individual corrompido → documento ignorado com aviso i18n, sem quebrar o
  restante da lista
- **And** `last_state` legado (pré-P2, não-template) é convertido em documento na primeira
  carga P2: cria documento com título "Documento restaurado", conteúdo de `last_state`, e
  persiste no índice — `last_state` original não é removido até migração confirmada
- **And** índice com ids duplicados (corrompido) é deduplicado mantendo a versão mais
  recente (`updatedAt`); aviso i18n informa limpeza

## Rastreabilidade AC → Story

| AC         | Story                                       |
| ---------- | ------------------------------------------- |
| AC-P2-9-1  | Story 1.2 (camada de layout vetorial)       |
| AC-P2-9-2  | Story 1.3 (diagramas e matemática)          |
| AC-P2-9-3  | Story 1.4 (paridade de contrato e fallback) |
| AC-P2-10-1 | Story 2.1 (índice no storage)               |
| AC-P2-10-2 | Story 2.2 (gerenciador de documentos)       |
| AC-P2-10-3 | Story 2.3 (ações no documento ativo)        |
| AC-P2-10-4 | Story 2.4 (persistência no boot)            |

## Fora de escopo (v2)

- Backend, sync remoto, colaboração, contas.
- Multi-abas simultâneas do mesmo navegador (última escrita vence; comportamento
  documentado, não suportado).
- PDF com layout pixel-perfect idêntico ao navegador em todos os casos (rota avalia
  fidelidade vs pesquisabilidade).

## Referências

- Epics/stories: `_bmad-output/planning-artifacts/epics-p2.md`
- Propostas: `_bmad-output/verifications/features-proposals.md`
- PRD: `specs/prd.md`

## Review Findings (code review 2026-10-03)

Auditoria adversarial da base completa (main @ 2fbc349) — camadas Blind Hunter, Edge Case
Hunter, Verification Gap e Acceptance Auditor (vs ACs v2). Achados normalizados e triados.

<!-- markdownlint-disable MD052 -- bullets usam o formato [Review][Tipo] do fluxo de review -->

### Decision

- [x] [Review][Decision] KaTeX no PDF vetorial — RESOLVIDO (b): raster 3× é contrato (KaTeX não tem saída `svg`); ADR/AC corrigidos, `katexHtmlToDataUrl` em `scale: 3` [src/render/katexExt.js:3, docs/explanation/architecture.md]
- [x] [Review][Decision] Nome do PDF exportado — RESOLVIDO (c): nome do documento sanitizado + fallback `markdown-preview.pdf` (v2 vence, v1 vira fallback) [src/ui/files.js (sanitizeDownloadName)]
- [x] [Review][Decision] "Novo arquivo" da sidebar — RESOLVIDO (a): cria novo documento (alias de `#doc-new-btn`); `newMarkdownEditor`/`newFileConfirm` removidos [src/main.js (newFile)]
- [x] [Review][Decision] Snapshots sem cap — RESOLVIDO (b)+: guarda de quota explícita (recusa com mensagem `snapshotQuota`, margem de 256KB para o rascunho primário); ring `MAX_SNAPSHOTS` permanece; sem evicção oculta [src/ui/snapshots.js]
- [x] [Review][Decision] CSP `connect-src 'self'` × imagens remotas — RESOLVIDO (a)+: CSP intacta; remota degrada para `img-unavailable`/alt no preview e alt no PDF; documentado em README/api-convert [src/render/convert.js, src/pdf/markdown-to-pdfmake.js]
- [x] [Review][Decision] HTML exportado tema/path — RESOLVIDO (a): CSS `?inline` no build (light+dark_dimmed) + export segue o tema ativo [src/ui/exportHtml.js]
- [x] [Review][Decision] Monaco entry — RESOLVIDO (b): manter pacote completo (lazy + highlighting de fenced blocks); decisão e trade-offs documentados em `monacoSetup.js` [src/ui/workers/monacoSetup.js]
- [x] [Review][Decision] Escopo do `Imprimir` — RESOLVIDO (b): chrome já era escondida pelo `@media print` do style.css (premissa do achado estava errada); CSS morto de header/footer removido, gap de `.skip-link`/`dialog` fechado, contrato travado por teste; `{page}` documentado como exclusivo do PDF [src/ui/printSettings.js, public/css/style.css]
- [x] [Review][Decision] Contrato de heading-id — RESOLVIDO (c): `visibleHeadingText` + `slugify` compartilhados entre `convert.js` e `toc.js` (fonte única = texto visível do markdown); teste cruzado pina a igualdade dos ids [src/render/convert.js, src/render/toc.js]

### Patch

- [x] [Review][Patch] Fonte `Courier` do pdfmake aponta para TTFs inexistentes no vfs (só há Roboto) — codespan/code block aborta o export vetorial com erro [src/pdf/pdfmake-adapter.js:19]
- [x] [Review][Patch] Mermaid é emitido como `image: data:image/svg+xml` — pdfmake só decodifica JPEG/PNG em `image` (SVG é o content type `svg`); teste unitário consolida o formato errado [src/pdf/markdown-to-pdfmake.js:106]
- [x] [Review][Patch] Imagem de bloco emite href cru (relativa/http) que o pdfmake recusa; virar data-URL ou bloco de texto/alt [src/pdf/markdown-to-pdfmake.js:168]
- [x] [Review][Patch] `buildPdfDocDefinition` ignora `paperSize`/`orientation` do print settings (AC-P2-9-1) — Letter/paisagem caem no default A4 [src/pdf/markdown-to-pdfmake.js:386]
- [x] [Review][Patch] Tabela no PDF usa `cell.text` cru — bold/link/math impressos como markdown literal [src/pdf/markdown-to-pdfmake.js:81]
- [x] [Review][Patch] Listas aninhadas/del/inline desconhecido caem em `token.raw` no PDF [src/pdf/markdown-to-pdfmake.js:57]
- [x] [Review][Patch] `resolveKatexPlaceholders` só olha `item.text` top-level — math em blockquote/listas aninhadas vaza como `__KATEX_HTML__` [src/pdf/markdown-to-pdfmake.js:299]
- [x] [Review][Patch] Regressão P0 de dados: `resolveDocumentBootInput` devolve `last_state` quando `documentCount === 1` mesmo com `documents.content` válido — rascunho de doc fechado contamina o remanescente (P2-10-1) [src/ui/editorActions.js:29]
- [x] [Review][Patch] `setContent` não é atômica (conteúdo primeiro, índice depois; falha no índice deixa estado parcial) — viola a atomicidade de AC-P2-10-1 [src/documents.js:193]
- [x] [Review][Patch] Renomear documento não existe na UI: `handleRename` só vive no retorno descartado de `setupDocumentManager` (AC-P2-10-2) [src/ui/documents-ui.js:296]
- [x] [Review][Patch] Fechar o último documento é recusado sem mensagem e o ramo `remaining.length === 0` é inalcançável; AC-P2-10-2 prevê abrir o template quando a lista esvazia [src/ui/documents-ui.js:184]
- [x] [Review][Patch] Boot silencioso: sem avisos i18n para activeId órfão, dedup de ids e conteúdo corrompido (AC-P2-10-4); envelope de conteúdo corrompido restaura a string crua em vez de ignorar [src/documents.js:19, src/storage.js:72]
- [x] [Review][Patch] `deleteDocument` tolera conteúdo órfão sem GC de `documents.content.*` e não migra snapshots do doc deletado (AC-P2-10-3); migração de snapshots/backup legados inexiste [src/documents.js:185, src/ui/snapshots.js:38]
- [x] [Review][Patch] Downloads PDF/HTML não usam o nome do documento ativo nem sanitizam caracteres inválidos de arquivo [src/ui/exportPdfVector.js:63, src/main.js:473, src/ui/files.js:19]
- [x] [Review][Patch] `handleClose` ignora `deleteDocument() === false` (doc removido em outra aba) e reporta sucesso [src/ui/documents-ui.js:196]
- [x] [Review][Patch] Mensagem `docOpRefused` pede "recarregar a lista" sem affordance de reload (multi-aba é fora de escopo, mas a mensagem engana) [src/ui/documents-ui.js]
- [x] [Review][Patch] Atalhos globais Ctrl+P/E/B/S sequestram digitação em inputs de diálogo sem guarda de foco [src/main.js:65]
- [x] [Review][Patch] "Abrir arquivo" substitui buffer sujo sem confirmação (Reset/Novo confirmam) [src/ui/sidebar.js]
- [x] [Review][Patch] `handleCreate` reporta `fileOpened` para documento novo; `handleClose` do último documento é silencioso [src/ui/documents-ui.js]
- [x] [Review][Patch] Print form: hints duplicados (label já embute o texto do `.print-form-hint`) e placeholders/hints sem `data-i18n` — pt vaza na UI en [index.html, src/i18n/index.js]
- [x] [Review][Patch] `renderList` monta `<li>` dentro de `div` sem `<ul>` e aninha `<button>` em `role="button"` [src/ui/documents-ui.js]
- [x] [Review][Patch] Skip-link aponta para `#container` sem `tabindex`; `#editor` tem `role="textbox"` sem `aria-multiline` [index.html]
- [x] [Review][Patch] `mermaidLoading` não limpa após rejeição do import dinâmico — diagramas mortos até o reload [src/render/mermaid.js:17]
- [x] [Review][Patch] `renderMermaidDiagramsNow` rejeitada dentro do timer vira unhandled rejection [src/render/mermaid.js:116]
- [x] [Review][Patch] Import dinâmico do Monaco no toggle de tema sem `.catch` [src/main.js:384]
- [x] [Review][Patch] Margem de impressão `0` vira `10` (`Number(x) || DEFAULT`) [src/ui/printSettingsDialog.js:61]
- [x] [Review][Patch] `stampPageHeaderFooter` fixa rodapé em y=287mm/cabeçalho em 5mm — sai da página em Letter/paisagem; no-op silencioso se `get('pdf')` não devolve jsPDF [src/ui/printSettings.js:91]
- [x] [Review][Patch] `removeSnapshot` sem `guardStorage` — StorageError escapa do handler [src/ui/snapshotsDialog.js:133]
- [x] [Review][Patch] `setupPrintSettingsDialog`/`setupTocDialog` nulos causam TypeError no handler do sidebar [src/main.js:487]
- [x] [Review][Patch] TOC: fences com 4+ crases, headings setext e slug vazio sem guarda [src/render/toc.js:27]
- [x] [Review][Patch] Unificar slug de heading entre `convert.js` e `toc.js` e pinar o contrato com teste cruzado [src/render/convert.js:71, src/render/toc.js:59]
- [x] [Review][Patch] `divider.js` deixa inline sizes do eixo anterior ao cruzar 720px e registra resize listener sem dispose [src/ui/divider.js]
- [x] [Review][Patch] `handlers.copy` engole erro de clipboard enquanto `copyHtml` reporta [src/main.js]
- [x] [Review][Patch] Trabalho por tecla sem debounce: `getActiveDocument()` (JSON.parse do índice) + `statusBar.update()` em cada keystroke [src/main.js:175]
- [x] [Review][Patch] `INDEX_VERSION` é gravado mas nunca lido — sem guarda de migração de schema [src/documents.js]
- [x] [Review][Patch] `createDocument` fixa título `'Documento'` em vez de `t('docDefaultName')` [src/documents.js]
- [x] [Review][Patch] Segundo `safeGet` local em `main.js` com contrato divergente do `storage.js` — unificar [src/main.js]
- [x] [Review][Patch] `/css/*` cai no `no-store` do `location /` (fora de `/assets/` e da regex de imagens) — stylesheet rebaixado a cada load [nginx.conf:93]
- [x] [Review][Patch] Falta `Permissions-Policy`/`Cross-Origin-Opener-Policy`/`Cross-Origin-Resource-Policy` no bloco de headers [nginx.conf]
- [x] [Review][Patch] `docker.yml` health-testa `:test` e publica um rebuild não testado em `:latest`/`:sha`; `release.yml` idem [workflows/docker.yml, workflows/release.yml]
- [x] [Review][Patch] `deploy-audit.sh`: IDs de infra hardcoded e aborta sem `docker` apesar do contrato warn-and-skip [scripts/deploy-audit.sh:183]
- [x] [Review][Patch] `bump-version.js`: `git add` incondicional de CHANGELOG e patch não-numérico gera tag `vNaN` [scripts/bump-version.js:18]
- [x] [Review][Patch] `marked.use()` registrada duas vezes no `marked` global (convert.js + markdown-to-pdfmake.js) [src/render/convert.js]
- [x] [Review][Patch] Lógica de escape duplicada com cobertura divergente (`escapeHtml` vs `escapeTocText`) [src/render/toc.js]
- [x] [Review][Patch] Export mortos: `isPdfMakeAvailable`, `hasHeadersOrFooter`, `extractTocFromHtml` (e CSS morto de print) — remover ou dar chamador [src/]
- [x] [Review][Patch] Sidebar semeia `currentName = 'documento.md'` — nome fantasma na status bar [src/ui/sidebar.js]
- [x] [Review][Patch] Teste: wiring real de `persistDraft` no `main.js` nunca observado (regressão P0 passaria verde) [tests/unit/main-boot.test.js]
- [x] [Review][Patch] Teste: `dataset.mermaidSource` (handoff preview→PDF) sem assert no writer [tests/unit/mermaid.test.js]
- [x] [Review][Patch] Teste: dispatch vetorial/fallback raster de `exportPreviewToPdf` sem cobertura [tests/unit/exportPdf.test.js]
- [x] [Review][Patch] Teste: composição de chunks (mermaid lazy) sem guarda pós-build — regressão documentada no vite.config.js voltaria verde [scripts/, vite.config.js]
- [x] [Review][Patch] Teste: contrato tema boot (index.html ↔ `KEYS.themeBoot`/variantes CSS) pinado só como bytes do hash [tests/unit/csp.test.js]
- [x] [Review][Patch] Teste: aviso de quota no boot (`storageQuotaWarning`) sem teste de consumidor [tests/unit/main-boot.test.js]
- [x] [Review][Patch] Teste: braço AbortError/SecurityError do `saveFileDialog` sem assert da mensagem `fileSaveDenied` [tests/unit/sidebar.test.js]
- [x] [Review][Patch] Teste: submissão do print dialog com margem `0` [tests/unit/printSettingsDialog.test.js]

### Defer

- [x] [Review][Defer] KaTeX inline sem heurística de moeda ("custo $5 … total $10" vira math) [src/render/katexExt.js] — deferred, pre-existing
- [x] [Review][Defer] i18n sem paridade de chaves, plural ou negociação de `navigator.language` na primeira carga [src/i18n/index.js] — deferred, pre-existing
- [x] [Review][Defer] Quota medida só no boot (sem rechecagem em sessão longa) [src/main.js:581] — deferred, pre-existing

<!-- markdownlint-enable MD052 -->
