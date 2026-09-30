# Changelog

All notable changes to this project are documented in this file.
The format is "Keep a Changelog" (modified per BMAD) and this project adheres to SemVer.

## [Unreleased]

### Added

- **Deploy automático via webhook**: GitHub → Coolify (`push` em `main`) publica sozinho —
  antes o último deploy era manual e produção ficava defasada em 15 commits. Webhook criado
  com assinatura `X-Hub-Signature-256`, e o guia de deploy deixa de descrever um workflow de
  deploy inexistente (o `docker.yml` só publica no GHCR) e documenta o mecanismo real.
- **Dispatch manual no Docker Build**: `.github/workflows/docker.yml` ganha `workflow_dispatch`
  para republicar a imagem GHCR sob demanda, e o push em `main` publica também a tag `:<versão>`
  lida de `package.json` (antes apenas `latest` e `<sha>`).

### Changed

### Deprecated

### Removed

### Fixed

- **Release aprova os runs do `pull_request`**: o PR aberto pelo workflow `Release` nascia em
  `action_required` (0 jobs, nunca executava) e era o único check contado pela proteção de `main` —
  o do `workflow_dispatch` não entrava no rollup do PR, então o auto-merge estourava o timeout.
  O workflow agora aprova esses runs via API antes de aguardar o merge e falha alto se o
  `quality` não passar.

### Security

## [1.3.0] — 2026-09-30

### Added

- **Manual do Markdown aprimorado**: reescrito do básico ao avançado com 4 partes
  (Básico, Intermediário, Avançado, Referência), KaTeX completo (símbolos, exemplos reais),
  Mermaid completo (flowchart, sequence, gantt, class, ER, state), cheatsheet integrado.
- **Deploy no Coolify**: documentação completa (`docs/how-to/coolify-deploy.md`) para deploy
  via GitHub, Docker Image ou local, com Cloudflare Tunnel em `mkdeditor.appservice.tec.br`.
- **Coolify CLI**: documentação de configuração e uso (`docs/how-to/coolify-cli.md`) para
  deploy direto do terminal via API.
- **Camada de storage de múltiplos documentos (Story 2.1)**: `src/documents.js` é um índice
  versionado puro (`{ version: 1, activeId, documents[] }` em `com.markdownstudio.documents`)
  com conteúdo por `com.markdownstudio.documents.content.<id>`, ids `crypto.randomUUID()`/
  fallback, gravação atômica, dedupe, reparo de `activeId` órfão e erros tipados.
- **ADR: Rota de PDF vetorial (Story 1.1 Spike)**: pdfmake escolhido (layout declarativo,
  page breaks automáticos, tabelas built-in, ~1 MB via dynamic import).
- **Camada de layout vetorial (Story 1.2)**: conversor markdown→pdfmake, adapter lazy-load,
  entry point `exportPdfVector.js`, feature-flag `com.markdownstudio.pdf.vector`.
- **Diagramas e matemática no PDF vetorial (Story 1.3)**: helpers SVG, KaTeX html→png via
  html2canvas, mermaid SVG capture, `resolveKatexPlaceholders`.
- **Fallback e paridade de contrato (Story 1.4)**: `exportRasterFallback` exportado, fallback
  transparente vector→raster.
- **Gerenciador de documentos na sidebar (Story 2.2)**: a lista de documentos existe de fato no app
  — `#document-list` + `#doc-new-btn` no painel, CSS dedicado e `setupDocumentManager` ligado ao boot.
  Criar/renomear/alternar/fechar, nome único com sufixo `(2)`, `aria-current`, operável por teclado
  (Enter alterna, Delete fecha), e o documento inicial semeado com o conteúdo já carregado no editor.
- **Ações no documento ativo (Story 2.3)**: snapshots com `docId`, handlers usam doc ativo,
  `exportHtml` usa nome do doc ativo para filename.
- **Boot com restauração (Story 2.4)**: boot restaura docs do índice, migra `last_state`
  legado para "Documento restaurado".
- **Dependabot**: `.github/dependabot.yml` para atualizações semanais automáticas.
- **Release workflow**: `.github/workflows/release.yml` — dispatch manual, bump, build,
  Docker push GHCR, GitHub Release com release notes automáticas.
- **Docker scripts**: `scripts/docker.sh`, `docker-audit.sh`, `docker-clean.sh` para
  gerenciamento completo de containers.
- **Testes scrollSync**: 2 novos testes para `scrollPreviewTo` (287 total).
- **Quota warning**: `checkStorageQuota()` + i18n `storageQuotaWarning` para aviso de
  armazenamento quase cheio.
- **Allowlist de schemes compartilhada (`src/render/urlPolicy.js`)**: preview (DOMPurify) e PDF
  vetorial passam a ler a mesma política de URLs — `isSafeLinkHref` / `isSafeImageSrc`.
- **Teste de CSP (`tests/unit/csp.test.js`)**: trava o hash sha256 do script inline de boot
  contra a diretiva `script-src` do `nginx.conf`; se um dos dois mudar sem o outro, o teste falha.
- **Regressão de segurança do PDF vetorial (`tests/unit/pdf-vector-link-safety.test.js`)**:
  varre a árvore inteira do `docDefinition` (parágrafo, heading, lista, blockquote, dentro de
  `strong`/`em` e o payload final) em busca de qualquer `link` com scheme fora da allowlist.
  Verificado: falha em 6 de 7 casos sem a guarda `isSafeLinkHref`.
- **Teste de integração do mermaid (`tests/unit/mermaid-integration.test.js`)**: exercita a lib
  real (sem `vi.mock`) cobrindo `initialize`, `render` → `{svg, bindFunctions}`, diagrama com erro
  e a superfície usada pelo app — trava a compatibilidade em upgrades major do mermaid.

### Fixed

- **`scripts/bump-version.js` não reabria `## [Unreleased]`**: o `replace` só renomeava a
  seção, então o release seguinte abortava na guarda "não contém seção ## [Unreleased]".
  O 1.2.0 foi seguido do commit manual `07e8c6c` exatamente para consertar isso; o script
  agora promove a seção e reabre um `[Unreleased]` vazio com as seis subseções.
- **`release.yml` não publicava o commit de release**: o workflow criava commit e tag no
  runner e só a tag ia para o GitHub (via `action-gh-release`) — o version bump em `main`
  dependia de um `git push` manual. Passo de push adicionado após o bump.
- **Boot pré-carregava 9,4 MB de JavaScript**: `import('mermaid')` estava lazy, mas o
  `manualChunks` do `vite.config.js` casava por substring `id.includes('mermaid')` e pegava
  também `src/render/mermaid.js` — importado estaticamente pelo `main.js` — religando os ~5 MB
  da lib ao grafo do entry; o Monaco acabava arrastado junto. **Boot agora é 377 KB (−96%)**.
- **`renderMermaidDiagramsIn` lançava exceção síncrona**: sem `async`, uma falha no default
  parameter `theme = getMermaidTheme()` estourava antes de existir promise, e o `.catch()` em
  `sidebar.js` deixava de engolir — quebrava o teste `sidebar` e o carregamento do manual.
- **Documentação do Coolify Tunnel apontava para a porta errada**: `coolify-deploy.md` e
  `coolify-deploy-step-by-step.md` instruíam `Service URL: http://localhost:80`, mas a
  aplicação é exposta em `5002:80` — seguir o doc derrubava o acesso externo com 502.
- **Perda de dados no caminho multi-documento**: as edições eram gravadas apenas em `last_state`,
  enquanto o boot lê o conteúdo do documento ativo — que ficava congelado no momento da migração.
  Da 3ª sessão em diante o editor reabria com conteúdo antigo e um novo `last_state` o sobrescrevia
  com o dado velho. `scheduleSave` passa a persistir no documento ativo via `persistDraft`, e
  `resolveDocumentBootInput` recupera o rascunho mais recente no legado de documento único.
- **Reset ressuscitava o conteúdo descartado**: `reset()` passa a gravar o template do idioma corrente
  no documento ativo, então um reload não traz de volta o conteúdo que o usuário mandou apagar.
- **Nome de documento em loop infinito**: `uniqueName` comparava o candidato contra o nome original,
  então a condição do `while` nunca mudava — criar o 2º documento com o nome padrão travava a aba.
  O sufixo agora é comparado contra o conjunto de nomes em uso.
- **Alternar documento carregava o conteúdo errado**: `loadDocument` chamava o getter do editor
  (parâmetro também chamado `getContent`) no lugar do `getContent(id)` de `documents.js`. O parâmetro
  do editor virou `getEditorContent`, eliminando o shadowing que quebrava a troca de documento.
- **Troca de documento vs. debounce de salvamento**: o id do documento é capturado no momento da
  edição, evitando que um save pendente grave no documento recém-selecionado.
- **Fechar documento usava a mensagem de confirmação errada** (`newFileConfirm` → `docCloseConfirm`).
- **PDF vetorial ignorava a allowlist de schemes**: `[x](javascript:alert(1))` gerava anotação de
  link ativa no PDF. Agora `href` não seguro (`javascript:`, `tel:`, …) vira só o rótulo.
- **PDF vetorial despejava imagens como markdown cru**: `![alt](url)` não tinha tratamento e caía
  no fallback textual (`token.raw`). Imagens viram bloco `image` quando a origem é segura
  (data URL, http(s) ou relativa) e degradam para o alt quando não é.
- **Botões de fechar dos diálogos não traduziam**: `aria-label="Fechar"` estava hardcoded e o
  atributo `data-i18n-close` era inerte. Os quatro botões passam a usar
  `data-i18n-aria-label="closeDialog"`; o botão "Cancelar" do print-settings exibia "Fechar"
  (chave `closeManual`) e agora tem chave própria (`cancel`).
- **`checkStorageQuota` gravava 1 MB em cada boot**: o teste de espaço fazia
  `setItem('__quota_test__', 'x'.repeat(1MB))` + `removeItem` para descobrir se cabia mais alguma
  coisa — em toda inicialização, e só avisava quando já era impossível salvar (podendo ainda
  deixar a chave de teste para trás). Passa a medir por leitura (`measureStorageUsage`, UTF-16) e
  avisar cedo, a partir de 90% de 5 MB; a falha de leitura degrada para `ok: true`.
- **Atalhos Ctrl+S/P/B/E sem guarda de modificadores**: checava só `ctrlKey || metaKey`, então
  Ctrl+Shift+S exportava PDF e o AltGr (que no Windows reporta `ctrlKey + altKey`) dispara
  exportação de HTML ao digitar `€`. `resolveShortcutAction` agora exige a combinação exata —
  recusa `altKey`, `shiftKey`, `repeat` e teclas que não são de um caractere — e devolve a
  função de limpeza para não acumular listeners.
- **CSP estrita gerava erro de console em produção**: o Cloudflare injeta o JavaScript Detections
  (`/cdn-cgi/challenge-platform/scripts/jsd/`) como `<script>` inline com hash dinâmico por request,
  impossível de autorizar no `script-src`. `nginx.conf` passa a emitir
  `Cache-Control: no-transform`, diretiva que — segundo a doc do Cloudflare — suspende a injeção;
  travada por `tests/unit/csp.test.js`.

### Changed

- `mermaid` 11.17.2 → **12.0.0** (major). Smoke test real cobre a superfície usada pelo app
  (`initialize({startOnLoad,securityLevel,theme})` + `render(id, src)` → `{svg, bindFunctions}`);
  `tests/unit/mermaid.test.js` só exercita o mock, não a lib. **Chunk 3,4 MB → 5,1 MB (+52%)**.
- `dompurify` 3.4.14 → **3.4.16**, `marked` 18.0.11 → **18.0.14**, `katex` 0.18.5 → **0.18.9** (patches).
- `html2canvas` passa a ser **declarada** em `dependencies` — era importada diretamente
  por `src/render/katexExt.js` sem constar no manifesto, sobrevivendo só como dependência
  transitiva de `html2pdf.js`.
- `github-markdown-css` **removida** de `dependencies`: nenhum import em JS/CSS/HTML;
  os estilos usados são as cópias versionadas em `public/css/`.
- `markdownlint-cli2` 0.23.2 → **0.23.3** (corrige `smol-toml` ≤1.7.0, DoS — GHSA-7w5x-hrqm-74c2);
  `npm audit` volta a 0 vulnerabilidades (dev incluído).
- `.github/workflows/docker.yml`: condição de publicação em `refs/heads/master` → **`main`** — o login
  e o push para o GHCR nunca executavam depois do rename da branch.
- `marked` 15.0.12 → **18.0.11** (breaking: trim trailing blank lines, TS v6).
- `katex` 0.16.47 → **0.18.5**.
- `monaco-editor` 0.52.2 → **0.53.0** (dompurify vulnerability fix).
- `vite` 6.4 → **8.2** (Rolldown bundler; `manualChunks` convertido de objeto para função).
- `vitest` 3.2 → **5.0** + `@vitest/coverage-v8` 5.0.
- `eslint` 9.33 → **10.10** + `@eslint/js` 10.0.
- `jsdom` 26.1 → **30.0** (testes adaptados: `globalThis.localStorage`/`document` read-only).
- `lint-staged` 16.1 → **17.4**.
- `dompurify` 3.4.13 → **3.4.14** (patch).
- `mermaid` 11.16 → **11.17** (minor).
- CI quality.yml: usa `test:coverage` com thresholds (65/60/60/65).
- `chunkSizeWarningLimit` ajustado para 4000 (chunks lazy-loaded).
- Docker: multi-stage com 3 stages, USER app non-root, read_only, security_opt.
- `.prettierignore` e `.markdownlint-cli2.yaml` expandidos para ignorar `.claude/`.
- CSP (`nginx.conf`): `script-src` perde `'unsafe-inline'` (o boot de tema passa a ser autorizado
  por hash sha256) e `'unsafe-eval'` (o bundle não chama `eval`/`new Function`); `style-src`
  mantém `'unsafe-inline'` (Monaco/KaTeX/Mermaid injetam estilos) e entram `object-src 'none'`,
  `base-uri`/`frame-ancestors`/`form-action 'self'`.
- `tests/unit/accessibility.test.js` passa a validar o `index.html` real (via JSDOM) em vez de um
  fixture paralelo: chaves i18n nos dois idiomas, atributos `data-i18n` conhecidos, nomes
  acessíveis, rótulos e landmarks.
- Removido código morto: `src/design-system/` (376 linhas, nunca importado), o parâmetro `_opts`
  de `convert()` e o build-arg `VITE_BUILD_DATE` (Dockerfiles, compose e workflows), que nunca era
  lido pelo bundle.
- `escapeHtmlAttr` (`exportHtml.js`) era uma cópia parcial de `escapeHtml` (`convert.js`): os dois
  agora usam o mesmo helper — um único escape de HTML no projeto, agora também `null`-safe.
- Removido `data-sidebar-safe` do `index.html` (nenhum consumidor em `src/`, `tests/` ou CSS).
- **Mermaid passou a lazy-load**: `src/render/mermaid.js` carrega a lib via `import('mermaid')`
  memoizado (`loadMermaid`), `configureMermaid` ficou `async`, e o single-flight em
  `renderMermaidDiagramsIn` adquire o lock de forma síncrona — `await` antes da checagem abriria
  janela de corrida entre dois chamadores concorrentes. Sem diagrama no documento, os ~5 MB
  (1,4 MB gzip) nunca são baixados.
- **`build.rollupOptions.output.manualChunks` removido do `vite.config.js`**: o Vite 8 bundla com
  Rolldown, que faz o code-splitting sozinho a partir do grafo real de imports — uma regra por
  substring era o que derrotava o lazy-load acima. Monaco e mermaid agora viram chunks próprios
  carregados sob demanda.
- `overrides.mermaid.marked` → `^18.0.14`: deduplica o `marked` do mermaid com o do app (uma
  cópia só). `overrides.mermaid.katex` **não** é aplicável — o npm rejeita e deixa a árvore
  `invalid` (`ELSPROBLEMS`) mesmo após cache clean; o `katex` 0.16.x aninhado no mermaid é
  limitação aceita, invisível ao app (que usa o 0.18.9).
- **`release.yml` publica via PR + auto-merge**: `main` exige pull request e o check `quality`,
  e o `GITHUB_TOKEN` é recusado (`GH006`) — o bypass de proteção só existe em repos de
  organização. O bump agora viaja numa branch `release/vX.Y.Z`, abre PR, habilita auto-merge,
  aguarda a CI e então versiona o SHA do squash-merge, publica a tag e o GitHub Release.
  Repo com `allow_auto_merge` habilitado, `pull-requests: write` no workflow e
  `can_approve_pull_request_reviews` ativo — sem ele o `gh pr create` falha com "GitHub
  Actions is not permitted to create or approve pull requests". A branch de release é
  recriada do zero a cada execução para absorver restos de runs abortados no meio
  (senão o push sai como non-fast-forward). PR e push feitos com `GITHUB_TOKEN` não
  disparam workflows (anti-recursão), então o release dispara `quality` via
  `workflow_dispatch` — a exceção documentada — para o check aparecer e o auto-merge
  liberar o merge; sem isso o PR fica `BLOCKED` para sempre.

### Removed

- **`Dockerfile.coolify`** — era uma cópia divergente do `Dockerfile` e nada o referenciava:
  o Coolify usa `dockerfile_location=/Dockerfile`, o `compose.yaml` aponta `Dockerfile` e o
  workflow de CI monitora `Dockerfile`/`Dockerfile.dev`. Dois Dockerfiles para a mesma imagem
  era armadilha de manutenção.

### Security

- `overrides` para `lodash-es@^4.18.1`: o `mermaid@12` puxa `chevrotain@11.1.2`, que trava
  `lodash-es@4.17.23` em 3 cópias aninhadas — GHSA-r5fr-rjxr-66jc (code injection via
  `_.template`) e GHSA-f23m-r3pf-42rh (prototype pollution). `npm audit` volta a **0**.
- CSP de produção sem `'unsafe-inline'`/`'unsafe-eval'` em `script-src` (hash do único inline +
  `'self'`); diretivas de base/objeto/frame/form endurecidas.
- Links do PDF vetorial submetidos à mesma allowlist de schemes do preview.
- Vulnerabilidade `qs` 2.2.5–6.15.3 (moderate: DoS) resolvida.
- Vulnerabilidade `dompurify` em monaco-editor resolvida (upgrade para 0.53.0).

## [1.2.0] — 2026-09-04

### Added

- **Copiar como HTML rico** (P1-6): `src/ui/copyRich.js` copia o preview via `ClipboardItem` (`text/html` + `text/plain`) para colar formatado em e-mail/Word/Docs; fallback `writeText` plain quando o navegador não expõe ClipboardItem; botão na sidebar (`copyHtml`).
- **Exportar HTML standalone** (P1-7): `src/ui/exportHtml.js` gera um `.html` offline com CSS github-markdown embutido (`buildStandaloneHtml` + `loadCssText`) e baixa via `downloadBlob` (agora em `files.js` com mime configurável); botão na sidebar (`exportHtml`).
- **Snapshots locais com recuperação** (P1-8): anel de backup `com.markdownstudio.backup` (máx. 5) em `src/ui/snapshots.js`, snapshot automático com throttle de 60s no `scheduleSave`, diálogo `src/ui/snapshotsDialog.js` para listar/restaurar/remover.
- **Configuração de página para PDF/Imprimir** (P0-1): novo `src/ui/printSettings.js` + diálogo na sidebar (`Configurar impressão`) com margem, papel (A4/Letter), orientação e textos de cabeçalho/rodapé (`{page}` = nº da página); preferências persistem em `com.markdownstudio.print_settings` e alimentam `buildExportOptions` (jsPDF format/orientation/margin), a folha `@page` injetada no documento e o carimbo por página no PDF via hook `toPdf().get('pdf')` (`stampPageHeaderFooter`).
- **Barra de status com estatísticas** (P0-3): `src/ui/statusBar.js` conta palavras, caracteres, linhas e tempo de leitura (~200 palavras/min) no `<footer>`, atualizando a cada edição; nome do arquivo aberto aparece à frente quando há arquivo carregado.
- **Quebras de página conscientes** (P0-2): marcador `<!-- page-break -->` vira `<div class="page-break">` no preview/impressão; `break-inside: avoid` em tabelas, código, citações, figuras, itens de lista, mermaid e KaTeX display, e `break-after: avoid` em headings — no `@media print` e no clone do PDF.
- **Sumário (TOC) bidirecional** (P0-4): `src/render/toc.js` extrai headings do markdown (mesmos ids/slugify do renderer, ignorando cercas de código) e `src/ui/tocDialog.js` lista os títulos em diálogo; clicar num item posiciona o cursor do editor na linha e clicar num heading do preview revela a linha correspondente no editor.
- **Suporte a matemática (KaTeX)** (P0-5): fórmulas `$...$` (inline) e `$$...$$` (bloco) via extensões marked (`src/render/katexExt.js`), katex promovido a dependência direta (`^0.16.47`, CSS bundled — sem CDN); saída passa pelo DOMPurify com allowlist MathML; `$` dentro de código inline não vira fórmula.

### Fixed

- **Redefinir** remove o rascunho persistido (`last_state`): após reset, um reload volta ao template do idioma corrente em vez de restaurar o conteúdo antigo (`src/ui/editorActions.js`). O fluxo de reset/novo arquivo foi extraído do boot para módulo testável.
- **Mermaid** reentrante (`src/render/mermaid.js`): `renderMermaidDiagramsIn` serializa passagens concorrentes (single-flight) — `mermaid.render` não é reentrante e duas passagens sobrepostas podiam corromper o preview.
- **Exportar PDF vs troca de tema**: `exportPreviewToPdf` pausa o agendamento do re-render Mermaid durante a captura (`pauseMermaidScheduling`/`resumeMermaidScheduling`), evitando que o debounce de tema mute o DOM enquanto o `html2pdf` clona o preview.
- **Jank de digitação**: conversão do preview agora é debounced (~80ms) no `onDidChangeModelContent` (`scheduleConvertAndRender`), reduzindo re-render por tecla em documentos longos.
- **Boot key de tema divergente** (`src/main.js`): `initThemeToggle` re-sincroniza `com.markdownstudio_theme` a partir da fonte de verdade (persistência), eliminando o double-flip de tema no next load em storage legado com boot key ausente/incoerente.
- **Leitura tipada na fronteira do storage** (`src/storage.js`): `getItem(namespace, key, { type })` valida o tipo do valor ao ler (boolean com mapeamento de legado `true/false/1/0`, string, number); fragmentos corrompidos lançam `StorageError` em vez de restaurar silenciosamente. O boot usa `safeGet` que degrada para o padrão (`null`) sem crash.
- **Divisor acessível por teclado** (B1): `#split-divider` ganha foco (`tabindex`), setas ajustam ±2%, Home/End vão aos limites, com `aria-valuenow` (0–100) e `aria-orientation` sincronizado com o modo empilhado/lado a lado.
- **Nomes acessíveis estáticos** (B2): toggles da sidebar (header + painel) e o divisor têm `aria-label` de fallback no HTML e localização via `data-i18n-aria-label` (`sidebarOpen`/`dividerLabel`).
- **Perfil DOMPurify para recursos externos** (B3): `ALLOWED_URI_REGEXP` restringe schemes de URL e hook `afterSanitizeAttributes` aplica `target="_blank"` + `rel="noopener noreferrer"` em links `http(s)` do preview (anti-tabnabbing); `mailto:` e relativos preservados, `tel:`/`javascript:` perdem o href.
- **Seletor de arquivo legado estável** (B4): `fileInputPicker` só remove o `<input type=file>` do DOM após `change`/`cancel` — remover logo após `click()` cancelava o diálogo em alguns navegadores.
- **Erros sem prompt duplo** (B5): indisponibilidade do PDF sai do `window.alert` bloqueante para o canal único de status (`aria-live`); cancelamento do usuário (`AbortError`) no _Abrir arquivo_ não reporta mais "não foi possível abrir o arquivo".

### Changed

- Docs de referência realinhados ao código: `docs/reference/storage-contract.md` (chaves reais + API tipada `getItem({type})`/`StorageError`/`getRaw`/`setRaw`/`safeGet`), `docs/explanation/architecture.md` (pipeline debounced, módulos KaTeX/TOC/impressão, contrato de storage) e `docs/reference/api-convert.md` (exports reais de convert/mermaid/katexExt/toc + arquivos de teste).
- Fim de linha normalizado para **LF**: `.gitattributes` (`* text=auto eol=lf`), `.editorconfig` (`end_of_line = lf`) e `prettier.config.mjs` (`endOfLine: 'lf'`) — o `format:check` reprovava todos os arquivos no runner Linux do GitHub Actions enquanto o editorconfig pedia CRLF.
- Husky ativado com hooks reais: `pre-commit` (`lint-staged`) e `pre-push` (`npm run quality`) em `.husky/` — antes os hooks existiam apenas na config, nenhum rodava em commit/push.
- Repositório publicado e sincronizado em `https://github.com/hsoservicos/markdown-studio-live` (branch `master`, tag `v1.1.0`); `package.json` (`repository`), link do ícone GitHub no `index.html` e referências de publicação atualizadas.
- Workflow de qualidade (`.github/workflows/quality.yml`) passa a disparar em pushes/PRs da branch `master` (era `main`) — CI volta a valer no repositório publicado.
- `README.md` ganha link para o upstream de estudo [`tanabe/markdown-live-preview`](https://github.com/tanabe/markdown-live-preview) (intro e licença).
- Artefatos de progresso atualizados: `specs/spec-v1.md` (status `implemented`, T1–T10 ✅), `specs/sprint-status.yaml` (reflete release v1.1.0 + features P0/P1 + backlog P2) e `PRODUCT.md` (open decision de impressão resolvida, capabilities e evidence atualizados).
- Novo módulo `src/ui/editorActions.js` com `resetMarkdownEditor`/`newMarkdownEditor` (lógica testável, persistência e scroll separados do boot) + `resolveBootInput` (decide entre rascunho restaurado e template do idioma corrente).
- `applyI18n` extraído para novo módulo `src/ui/i18nElements.js`, testável isoladamente.
- `buildExportOptions(filename, settings)` agora recebe configuração de impressão; `exportPreviewToPdf({ onStatus }, printSettings)` usa a cadeia `toPdf().get('pdf')` do html2pdf.
- `convert.js` exporta `slugifyHeading` para consumidores que precisam dos mesmos ids de âncora (TOC).

## [1.1.0] — 2026-08-19

### Added

- Botão toggle no header do painel (`#menu-items [data-sidebar-toggle]`) com `aria-controls="sidebar-nav"`, visível apenas em viewport ≤720px (mobile).
- Drawer responsivo mobile: `.sidebar` vira painel fixo overlay (max-width 280px / 84vw) deslizando via `translateX(-100%)` ↔ `translateX(0)`, com boot colapsado em telas compactas sem preferência salva; editor sempre em coluna cheia no mobile.
- `setupSidebar` aceita múltiplos toggles (`#sidebar-toggle` + `[data-sidebar-toggle]`) e sincroniza `aria-expanded`/`aria-label`/`title` em todos.
- Sidebar com ações: Manual, Abrir arquivo, Salvar arquivo, Imprimir, Redefinir, Copiar e Exportar PDF (Removidos da NavBar — now in Sidebar).
- Seletor de idioma (`#lang-select`) na sidebar: Português (Brasil) / English, persistido em `com.markdownstudio.locale`, com tradução aplicada automaticamente via reload.
- `src/ui/language.js` — helpers de localidade (normalizeLocale, getStoredLocale, setStoredLocale, applyStoredLocale, setupLanguageSelector).
- `setupSidebar` agora aceita `handlers` por action para ações externas (reset/copy/exportPdf).
- Botão **Novo arquivo** na sidebar (`data-sidebar-action="new"`): limpa a área de edição, volta o preview ao estado vazio e coloca o foco do cursor no editor; com confirmação (`newFileConfirm`) quando houver conteúdo editado. Rótulo/tooltip localizados (`newFile`, pt/en), seguindo o padrão dos demais `.sidebar-item`.
- i18n total: `applyI18n` também localiza `aria-label` (`data-i18n-aria-label`), `alt` (`data-i18n-alt`), `title` (`data-i18n-title`) e `<meta content>` (`data-i18n-content`) — acessibilidade, hints e metadados acompanham o idioma.
- `DEFAULT_TEMPLATE_EN` + `getDefaultTemplate()` por locale: o exemplo inicial da abertura e o **Redefinir/Reset** carregam o template no idioma corrente.
- Manual bilingue: `manual/markdown-manual-en.md` (EN) resolvido por `getManualUrl()` conforme a locale.
- **Exportar PDF funcional** (`src/ui/exportPdf.js`): `html2pdf.js@^0.14.0` como dependência npm local (dynamic import em chunk próprio, carregado só no clique — sem CDN), exporta `#preview-wrapper` em A4 retrato via `buildExportOptions()`, forçando tema light no clone e largura `190mm`; sucesso reporta `pdfExported` no rodapé e indisponibilidade/erro usam fallbacks claros (`pdfUnavailable`/`exportError`).
- Testes unitários de exportação (`tests/unit/exportPdf.test.js`): busca do preview, fallback de lib indisponível, pipeline set→from→save com callback de sucesso e caminho de erro com restauração do tema Mermaid dark.

### Changed

- **Exportar PDF**: handler da sidebar agora reporta resultado no rodapé via `onStatus` e o módulo passou a carregar `html2pdf.js` localmente (era `window.html2pdf` via CDN — sempre indisponível); `loadHtml2Pdf` exportado para testes com mock.
- Boot toggle da sidebar não publica mais status no rodapé ao recolher/expandir; cada `.sidebar-item` ganhou `title` (tooltip) localizado via `data-i18n-title` — essencial quando a sidebar está recolhida (ícones sem texto).
- Bootstrap i18n lê a locale armazenada (`applyStoredLocale`) e sincroniza `document.documentElement.lang`.
- `applyI18n` também aplica placeholders via `[data-i18n-placeholder]`.
- Erros Mermaid (`showMermaidError`) passam a usar as chaves `mermaidError`/`mermaidRenderFailed` em vez de strings hardcoded em pt.
- Persistência do editor não salva templates não editados (`isUntouchedTemplate`): ao trocar de idioma, o editor volta ao template do idioma corrente em vez de manter o outro.
- Sidebar `.sidebar-lang` com `<select>` estilizado (hairline, focus-visible, escala fixa).
- Corrigido recolhimento da sidebar: (1) `#workspace:has(.sidebar.is-collapsed)` usava seletor entre aspas (regra CSS inválida, coluna nunca reduzia); agora `:has(.sidebar.is-collapsed)` válido, com `--sidebar-width`/`--sidebar-width-collapsed` definidos no próprio `#workspace`; (2) o handler JS era idempotente (`const open = !sidebar.classList.contains('is-collapsed')`) e nunca alternava a classe — reescrito para inverter o estado (`applyState`) e persistir via `setSidebarCollapsed`.
- Responsividade ≤720px: layout colapsa para coluna única (`grid-template-columns: minmax(0,1fr)`), sidebar vira drawer overlay fixo e o botão do header aparece para abrir/fechar o painel.
- Janela do Manual alargada para `min(960px, calc(100% - 48px))` e `max-height: 86vh`, com `.visually-hidden` util.
- Correções Impeccable: remoção da transição de `width`/`flex-basis` na sidebar (layout-thrash) e fontes `0.9375rem`/`1.05rem` realinhadas à rampa (`0.875rem`/`1rem`).

### Deprecated

- Project scaffold: BMAD-structured repo (docs, specs, src, tests, tools, scripts, website).
- Docs in Diataxis layout (tutorial, how-to, explanation, reference), pt-BR.
- PRD (`specs/prd.md`) and v1 spec with testable ACs (`specs/spec-v1.md`).
- Vitest unit-test suite skeleton with fixtures (`tests/`).
- Quality gate `npm run quality` (format:check, lint, lint:md, test).
- LocalStorage wrapper (`src/storage.js`) replacing upstream `storehouse-js`.
- Impeccable skill vendored to `.opencode/skills/impeccable/` (project scope) via `npx impeccable install --providers=opencode --scope=project`.
- `PRODUCT.md` (durable product truth) and `DESIGN.md` (visual design system "The Quiet Studio") with machine-readable sidecar `.impeccable/design.json`.
- How-to `docs/how-to/impeccable-design-system.md` (workflow, detector, waivers).
- Docker local preview: multi-stage `Dockerfile` (node:22-alpine build → nginx:alpine runtime), `nginx.conf` (SPA fallback, immutable asset cache, defensive headers), `compose.yaml` (port 5001, healthcheck, restart policy) and `.dockerignore`.
- How-to `docs/how-to/docker-workflow.md` (build/up/down, nginx decisions, first-run audit).

### Changed

- Tool re-titled **Markdown-Studio**; strings upstream in English moved to `src/i18n/` (pt-BR default).
- Monaco, marked, DOMPurify, mermaid pinned as npm deps (no runtime CDN).
- All UI controls upgraded from `<a href="#">` to semantic `<button>`.
- Unified asset version strings into a single build constant.
- UI reworked under Impeccable "The Quiet Studio": tokenized CSS custom properties (colors, fonts, radii, spacing), flat/no-shadow hairline layering, §72px breakpoint stacking, complete interactive states (hover/focus-visible/active/disabled).
- `src/ui/divider.js` rewritten to support vertical (mobile, `row-resize`) and horizontal (desktop, `col-resize`) orientations while preserving min-size, dblclick recenter and resize ratio.

### Deprecated

- (none)

### Removed

- Busca incremental no Manual (barra `#manual-search`, helpers `src/ui/manualSearch.js`, chaves i18n `manualSearch*`, estilos `.manual-search*`/`mark[data-manual-hit]`) e o utilitário `.visually-hidden` que só alimentava o label da busca.
- Google Analytics tag (upstream `G-77C1GEG9C8`) — no tracking.
- `storehouse-js` git dependency and empty `.gitmodules`.

### Fixed

- (none in this release)

### Security

- Dependencies updated to resolve upstream `npm audit` findings (dompurify, mermaid, nanoid, postcss, vite).

## Baseline

Initial scaffold for **Markdown-Studio v1.0.0** — standalone reconstruction of
[`tanabe/markdown-live-preview`](https://github.com/tanabe/markdown-live-preview) (ISC license for both).
