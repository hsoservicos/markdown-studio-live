# Changelog

All notable changes to this project are documented in this file.
The format is "Keep a Changelog" (modified per BMAD) and this project adheres to SemVer.

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [1.4.0] — 2026-10-03

### Added

- **Avisos de restauração no boot (AC-P2-10-4)**: id ativo órfão, índice com ids duplicados,
  schema de versão mais nova e conteúdo corrompido agora degradam com aviso i18n (`bootWarn*`)
  em `#sidebar-status` — antes o fallback acontecia em silêncio e o envelope corrompido
  restaurava lixo no editor.
- **Guarda de composição do bundle no quality**: `scripts/check-bundle.mjs` falha se o mermaid
  (lazy, ~5 MB) vazar para o entry ou sumir como chunk — a regressão que o comentário do
  `vite.config.js` documenta voltaria verde no gate.
- **Guarda de quota nos snapshots, sem evicção silenciosa (D4)**: `pushSnapshot` projeta o
  tamanho do anel (UTF-16, mesma conta do `measureStorageUsage`) e **recusa** antes de
  escrever quando sobra menos que a margem de 256KB — o snapshot é backup e nunca pode comer
  a última fatia do storage e empurrar o rascunho primário para `QuotaExceededError`. O motivo
  sai em `pushSnapshotDetailed`/`maybeAutoSnapshot` (`quota`/`dedup`/`empty`/`throttled`) e o
  caminho automático anuncia `snapshotQuota` (nova chave i18n) uma vez por sessão. O anel de
  `MAX_SNAPSHOTS` permanece; nada é descartado em silêncio para dar lugar.

- **Auditoria da cadeia de deploy**: `npm run deploy:audit` (`scripts/deploy-audit.sh`)
  prova que o push em `main` vira release sozinho — webhook ativo nos dois lados, branch
  protegida, último deploy origem=`webhook` igual ao HEAD, fila vazia, API do Coolify
  desabilitada, container healthy e produção servindo o mesmo bundle do build local.
  Sai com código ≠ 0 na primeira falha; a URL do webhook é mascarada no output (o domínio
  do painel não vai para o repositório).
- **Deploy automático via webhook**: GitHub → Coolify (`push` em `main`) publica sozinho —
  antes o último deploy era manual e produção ficava defasada em 15 commits. Webhook criado
  com assinatura `X-Hub-Signature-256`, e o guia de deploy deixa de descrever um workflow de
  deploy inexistente (o `docker.yml` só publica no GHCR) e documenta o mecanismo real.
- **Dispatch manual no Docker Build**: `.github/workflows/docker.yml` ganha `workflow_dispatch`
  para republicar a imagem GHCR sob demanda.
- **Teste de boot do aplicativo**: `tests/unit/main-boot.test.js` dispara o `load` real e valida
  `init()` — editor alimentado, preview renderizado, barra de status montada, sidebar ligada,
  restauração de `last_state` e tema anti-FOUC. Era o único caminho de boot sem cobertura.
- **Testes de KaTeX no PDF, dos guards do mermaid e da quota na escrita**: `resolveKatexPlaceholders`
  é exercitado de verdade (antes só era mockado), o single-flight do mermaid ganha casos de
  isolamento de falha e de liberação de lock, e a costura `storage → classifyError → i18n` ganha
  casos de `QuotaExceededError`/`SecurityError`.
- **Auditoria Docker com 21 verificações**: `scripts/docker-audit.sh` passa a validar herança de
  headers no asset, `Cache-Control` único, `no-store` no `index.html` e root filesystem read-only.
- **Dependabot para imagens Docker**: ecossistema `docker` semanal — `nginx:1.27-alpine` e
  `node:22-alpine` ficariam congelados para sempre (o Dependabot cobria só npm e Actions).
  `node` tem `ignore` para major: a tag `22-alpine` já flutua dentro de 22.x (patch entra no
  build) e o salto 22 → 26 exige alinhar `.nvmrc`, CI e `engines` juntos — decisão humana.
- **Cobertura da segunda auditoria**: 24 casos novos para o hardening de boot (catch da
  cadeia do Monaco, guard da quota no primeiro boot, `pagehide` do autosave, timeout do
  pdfmake), para o sanitizador de CSS e a CSP do export, para o rollback do `atomicWrite`,
  para o dirty flag do mermaid e para o handle de arquivo amarrado ao documento ativo.
  Cada caso de regressão foi validado por mutação: falha quando a correção é removida.
- **Gaps de cobertura fechados**: `main.js` sobe de 71% para 90% com os handlers de
  `setupSidebarActions` (reset, new, copy, copyHtml, exportHtml, printSettings/toc/snapshots e a
  propagação do scroll ligado/desligado); a sidebar ganha casos para `print` (sucesso e
  exceção), o diálogo `manual` (render e falha do fetch), o `saveError` do picker e os retornos
  nulos de `setupSidebar`; `monacoSetup.js` sai de 0% verificando o `getWorker` no-op sem
  importar o Monaco de verdade. Todos os casos novos foram validados por mutação.
- **Auditoria a11y automatizada com axe-core**: `tests/unit/a11y-axe.test.js` roda o axe sobre o
  `index.html` real com o CSS real injetado (o jsdom não busca `<link href>`) em três estados da
  UI — shell inicial, diálogos abertos e sidebar recolhida — e quebra o gate em qualquer
  violação nova, listando regra, impacto e seletores. `color-contrast` fica fora do contrato por
  limitação do jsdom (só alcança "incomplete"); qualquer outra regra "incomplete" sinaliza
  perda de cobertura do setup. Validado por mutação (`<img>` sem `alt` reprova).

### Changed

- **Export vetorial corrigido de ponta a ponta (A1–A7)**: código na fonte base (o `Courier`
  apontava para TTFs inexistentes no vfs e todo codespan abortava o export); mermaid vira o
  content type `svg` (string capturada) em vez de `image` com `data:image/svg+xml`, que o
  pdfmake recusa; `pageSize`/`pageOrientation` chegam ao docDefinition (Letter/paisagem não
  caem mais no A4 retrato); tabelas, listas aninhadas e `del` convertem inline em vez de
  vazar markdown cru; placeholders KaTeX resolvem em blockquote, listas e runs aninhados;
  imagens relativas são buscadas via fetch → data URL PNG/JPEG e o não embutível degrada
  para o alt.
- **Atalhos globais respeitam campos de formulário (C1)**: Ctrl+S/P/B/E não sequestram mais
  inputs de diálogo/contenteditable — o editor Monaco continua recebendo (salvar enquanto
  escreve é o caso de uso principal).
- **Formulário de impressão sem texto duplicado nem pt vazando no en (C4)**: labels perdem o
  sufixo dos `.print-form-hint` (aparecia em dobro) e hints/placeholders ganham `data-i18n*`.
- **Decisão do bundle do Monaco documentada (D5)**: importar `monaco-editor` completo (e não
  a entry `editor.api`) é deliberado — o módulo é carregado sob demanda (chunk lazy fora do
  boot, cache imutável de 1 ano) e os tokenizers das linguagens embutidas destacam os blocos
  ` ```python ` etc. no modo markdown. Trade-off e caminho de evolução documentados em
  `monacoSetup.js`.
- **Caminho de impressão honesto (D9)**: o CSS morto `.print-page-header`/`.print-page-footer`
  do `getPrintStylesheetCss` saiu — prometia cabeçalho/rodapé por página em `window.print()`,
  que o browser não entrega em CSS (o `{page}` impresso é do diálogo do navegador); header/
  rodapé com `{page}` são exclusivos dos PDFs (jsPDF raster e pdfmake). O `@media print` do
  `style.css` ganha `.skip-link` e `dialog` no grupo escondido e o contrato de impressão
  (chrome oculta, preview em largura total, texto legível no papel) agora é travado por teste.
- **HTML exportado ganha CSS empacotado no build e acompanha o tema ativo (D7)**: o export
  buscava `/css/github-markdown-light.css` em runtime (404 em deploy em subpath, `file://` e
  offline) e saía sempre light. As duas variantes do preview (`light`, `dark_dimmed`) entram
  no bundle via `?inline` e `exportStandaloneHtml` aceita `theme`/`cssByTheme` — o export sai
  no tema corrente, com o body CSS coerente; `loadCssText`/`cssUrls`/`fetchImpl` saíram.
- **"Novo arquivo" cria um novo documento em vez de limpar o ativo (D3)**: a ação da sidebar
  era destrutiva (limpava o editor e o autosave gravava `''` no mesmo título/índice) e
  divergia de "Novo documento". Agora é alias do gerenciador (`documentManager.create()`):
  entrada isolada, conteúdo atual salvo antes de trocar, sem confirmação (nada é descartado).
- **Imagens remotas degradam para alt/placeholder em vez de quebrar (D6)**: a CSP
  (`img-src 'self' data: blob:`) nunca carregou origens de rede — offline, sem rastreamento —
  mas o preview mostrava ícone de imagem quebrada e o PDF vetorial abortava o export com
  `Invalid image` para qualquer imagem que não fosse `data:image/(png|jpe?g);base64`. Agora o
  preview renderiza `<span class="img-unavailable">` com o alt (e `[imagem]` quando vazio) e o
  PDF cai para o alt; imagem relativa e `data:image/svg+xml` seguem a mesma degradação — href
  cru nunca chega ao pdfmake. README/api-convert documentam a política.
- **Contrato do KaTeX no PDF vetorial corrigido para raster 3×**: a AC-P2-9-2 e o ADR pediam
  re-render com `output: 'svg'`, premissa falsa — o enum do KaTeX é `htmlAndMathml|html|mathml`,
  sem saída SVG. `katexHtmlToDataUrl` passa a rasterizar em `scale: 3` (antes 2) como limite de
  fidelidade da rota vetorial, e spec/ADR passam a descrever o contrato real; migração a
  MathJax/SVG fica condicionada a pesquisabilidade de fórmulas virar requisito.
- **`npm run quality` roda o mesmo gate do CI**: agora
  `format:check && lint && lint:md && test:coverage && build` — antes o `pre-push` não cobria
  coverage nem build, então um push podia passar local e falhar no CI.
- **Procedimento de release reescrito**: `docs/how-to/re-edit-overview.md` apontava para
  `master` (branch morta), `git push origin master --tags` e `firebase deploy`. Passa a
  descrever o workflow `Release`, `main` e o deploy automático via webhook do Coolify.
- **Runbook do webhook ganha gotchas e recuperação**: `coolify-deploy.md` agora registra
  que `Last delivery: OK` no GitHub **não** significa deploy (o Coolify responde 200 até
  para `Invalid signature`), que o segredo é criptografado no banco e a tabela de
  sintoma → causa → ação para quando a cadeia quebrar.
- **`deploy:audit` pega falha silenciosa**: além do último deploy, agora **falha** quando
  nenhum canal de alerta de falha está ativo e expõe com warn os deploys antigos já
  registrados como `failed` (o script só olhava o deploy mais recente).
- **Runbook do webhook ganha dois enganos**: o `Content-Type` registrado na entrega
  (`form-urlencoded`) não bate com a config do hook (`application/json`) e a validação
  passa mesmo assim; e notificação de falha habilitada **sem transporte configurado** não
  envia — dois casos que enganam quem confia na superfície.
- **Gate único no CI e no local**: `quality.yml` roda `npm run quality` em vez de cinco steps
  soltos, e `quality.yml`/`release.yml` leem `node-version-file: .nvmrc` (antes fixavam `22`
  e podiam divergir do `.nvmrc`).
- **Prettier e lint-staged cobrem YAML**: globs de `format:check`/`format:fix` ganham
  `*.yml`/`*.yaml`, e o `dependabot.yml` passa a ser formatado como os demais arquivos.
- **`npm run docker:audit` documentado** em `AGENTS.md`, `README.md` e no guia Docker, junto
  com a saída real (21 verificações) e a razão de os headers serem declarados duas vezes.
- **Docs de referência alcançaram o código**: `api-convert.md` não citava `FORBID_TAGS`,
  a remoção de `style` perigoso, o `katexHtmlToDataUrl` nem o dirty flag do `resume` do
  mermaid; `storage-contract.md` não listava a chave do PDF vetorial, descrevia
  `getRaw`/`setRaw` como "usado pelo script de boot" (ele lê `localStorage` direto — os
  helpers não têm chamador em produção), falava da reversão do `atomicWrite` como
  incondicional e não dizia que `guardStorage` reflete a **exceção** de `fn`, não o valor que
  `fn` devolveu. Ganha o exemplo do capture em `handleSwitch`/`handleRename`.

### Deprecated

### Removed

- **`firebase.json` removido**: nunca houve projeto vinculado (sem `.firebaserc`, sem
  `firebase-tools`, nenhum workflow de deploy em todo o histórico) — era o último
  resquício de um segundo caminho de hosting ao lado do Coolify.
- **`newMarkdownEditor` e a chave i18n `newFileConfirm`**: "Novo arquivo" deixou de limpar o
  documento ativo (D3) e o helper sem chamador saiu junto com a mensagem de confirmação —
  "limpar atual" não é mais um caminho da UI.
- **Exports mortos e duplicação (G1–G3)**: `isPdfMakeAvailable`, `hasHeadersOrFooter` e
  `extractTocFromHtml` (sem chamador em produção) saíram com os testes que só inflavam
  cobertura; `escapeTocText` virou o `escapeHtml` único do projeto; as extensões de matemática
  do `marked` são registradas uma única vez por instância (`registerMathExtensions`).
- **Código morto**: `svgToPngDataUrl` (nunca chamado), `getDefaultTheme` (idêntico a
  `getMermaidTheme` e citado só num doc), `getLocale` (só `getLocaleCode` era importado) e as
  chaves de i18n `previewLabel`/`tocHeading` (nenhuma `data-i18n` nem `t('…')` as referenciava;
  o rótulo de snapshot é uma função local em `snapshotsDialog.js`). `PDF_VECTOR_FLAG` deixou de
  estar declarada em dois arquivos: a definição é única em `src/ui/pdfVectorFlag.js`, e
  `exportPdfVector.js` re-exporta para manter a API pública. `api-convert.md` perde a linha do
  `getDefaultTheme`.

### Fixed

- **Contaminação entre documentos no boot (B1, P0)**: com 1 documento, o `draft` de
  `last_state` vencia o conteúdo persistido — o texto de um documento FECHADO era injetado no
  remanescente e persistido lá. `documents.content.*` é a fonte da verdade (AC-P2-10-1); o
  rascunho só entra na migração legada, quando não existe conteúdo.
- **`setContent` voltou a ser atômica (B2, AC-P2-10-1)**: falha na gravação do índice reverte
  o conteúdo ao valor anterior e expõe `err.reverted`, o mesmo contrato do `atomicWrite`.
- **Renomear documento existe na UI (B3, AC-P2-10-2)**: botão por linha na lista — antes
  `handleRename` só vivia no retorno descartado do setup.
- **Fechar o último documento abre o template do idioma (B4, AC-P2-10-2)**: o guard `<= 1`
  recusava em silêncio e o ramo de lista vazia era inalcançável.
- **Snapshots sem origem pendurada (B6, AC-P2-10-3)**: os legados ganham o documento ativo na
  migração e os de um documento fechado migram para o ativo seguinte (ou raiz "legado").
- **`handleClose` não mente mais (B7)**: `deleteDocument() === false` (documento sumiu em
  outra aba) reporta `docOpRefused`; a mensagem de recusa não pede mais "recarregue a lista"
  sem affordance (B8).
- **Abrir arquivo com edição não salva pede confirmação (C2)** — o mesmo aviso de Reset/Novo.
- **Lista de documentos com semântica real (C6)**: `ul`/`li` (o container era `div` com `li`
  soltos), nome como botão e sem `role="button"` com controles interativos aninhados;
  skip-link ganha alvo focável (`tabindex="-1"`) e o editor `aria-multiline="true"` (C7).
- **`t()` cai no pt-BR antes de expor a chave crua (C5)** para o usuário.
- **Mermaid resiliente a falha de chunk (D1/D2)**: o guarda do import é liberado após rejeição
  (o próximo render tenta de novo) e a rejeição agendada no timer não vira `unhandled`;
  import do Monaco no toggle de tema ganha `.catch` (D3).
- **Impressão**: margem `0` não vira mais `10` (D4); o rodapé é posicionado pela altura real
  da página — Letter/paisagem não saem mais do papel (D5); jsPDF indisponível avisa em vez de
  perder o carimbo em silêncio (D6).
- **TOC (D9)**: fence de 4+ crases não libera falsos headings, setext (`===`/`---`) é
  reconhecido e heading sem slug não vira âncora quebrada; o clique no preview usa itens
  frescos (memo por conteúdo — G4).
- **Divisor (D10)**: o inline size do eixo anterior é limpo ao cruzar o breakpoint de 720px e
  `setupDivider` devolve `dispose` do listener de resize.
- **Falha de clipboard no Copiar é anunciada (D11)**, como no Copiar HTML.
- **Contratos de storage (E1–E3)**: schema de versão mais nova degrada com aviso; o título do
  documento não é mais fixado em `'Documento'` na camada pura; o `safeGet` duplicado do
  `main.js` saiu (contrato único do `storage.js`); sidebar sem o nome fantasma
  `documento.md` (E4).
- **`removeSnapshot` passa pelo guard de storage (D7)** — StorageError não escapa mais do
  handler do diálogo; `printDialog`/`tocDialog` nulos não derrubam o clique (D8).
- **CSS do app não é mais rebaixado a cada load (F1)**: `/css/` ganha `expires 30d` — caía no
  `no-store` do shell e os `?v=` não ajudavam.
- **`deploy:audit` não aborta sem docker (F4)**: contrato warn-and-skip até o resumo, e os
  identificadores do Coolify viram env vars; `release` não gera mais tag `vNaN` e o `git add`
  do CHANGELOG é condicional (F5).
- **Cancelamento/segurança do `saveFileDialog` reportam `fileSaveDenied` (H7)** — as mensagens
  existiam e não saíam; o `printSettingsDialog` com margem vazia/não-numérica cai no default.
- **Ids de heading unificados entre preview e TOC (D8)**: `convert.js` slugificava o HTML
  renderizado (sobrava `&amp;`) e `toc.js` o markdown cru — `## Veja [docs](url)` gerava
  `veja-docs` no DOM e `veja-docshttpsexcom` no TOC, `## Imagem ![alt](/x.png)` divergia idem,
  e a navegação bidirecional TOC↔preview falhava em silêncio. `visibleHeadingText`
  (`src/render/convert.js` — imagem→alt, link→texto, ênfases e escapes resolvidos, com stash
  de escapes) é a fonte única para os dois lados; contrato pinado por teste cruzado.
- **Downloads PDF/HTML ganham o nome do documento ativo sanitizado (AC-P2-10-3)**: os dois
  caminhos fixavam `markdown-preview.pdf` e o HTML concatenava o título cru —
  `sanitizeDownloadName` (`src/ui/files.js`) remove extensão antiga, caracteres inválidos de
  arquivo, control (tab/newline viram espaço) e nomes reservados do Windows, corta em 80
  chars e cai no fallback legado (`markdown-preview.pdf`/`document.html`) quando o título não
  serve. Usado por `exportPdfVector`, `exportRasterFallback` e `exportStandaloneHtml`.
- **Release aprova os runs do `pull_request`**: o PR aberto pelo workflow `Release` nascia em
  `action_required` (0 jobs, nunca executava) e era o único check contado pela proteção de `main` —
  o do `workflow_dispatch` não entrava no rollup do PR, então o auto-merge estourava o timeout.
  O workflow agora aprova esses runs via API antes de aguardar o merge e falha alto se o
  `quality` não passar.
- **`AGENTS.md` deixava de guiar**: documentava `npm run changelog` (script inexistente) e
  dizia que o deploy era Firebase Hosting; agora descreve o workflow `Release` e o webhook do Coolify.
- **`quality.yml` com comentário falso e permissão ampla**: afirmava que o `workflow_dispatch`
  fazia o check aparecer no PR de release (não faz — quem aprova é o `release.yml`); ganha
  `permissions: contents: read`.
- **`docker.yml` com `paths` incompletos**: PR só validava `Dockerfile`/`src`/deps, então mudanças
  em `nginx.conf`, `index.html`, `public/**` ou no próprio workflow entravam sem buildar; o push
  em `main` ignorava alterações no workflow (sem autorregeneração).
- **Referências a `master` e Firebase removidas dos guias**: `coolify-deploy.md` pedia
  `git pull origin master` e descrevia um fluxo de deploy errado.
- **`docker:up` quebrado desde o `read_only`**: o `compose.yaml` subia o nginx sem tmpfs
  `mode=1777`, e o worker `app` (UID 1001) morria com
  `mkdir() "/var/cache/nginx/client_temp" (13: Permission denied)` e `exit=1`. Ganha tmpfs
  explícitos para `/var/cache/nginx` e `/var/run`, idem no `docker-audit.sh`.
- **`docker-audit.sh` saía com 1 resultado em vez de 22**: os contadores usavam `((VAR++))`,
  que em `set -e` aborta quando a expressão avalia a 0. Agora `VAR=$((VAR + 1))` e a auditoria
  roda todas as 11 seções.
- **`release.yml` publicava a tag no SHA errado**: a tag saía da ponta de `main`, não do
  merge commit do PR. Ganha `head_sha` validado contra o `headRefOid` do PR e a tag vai para
  o `merge_commit` real.
- **`docker.yml` publicava sem o gate verde**: um commit com o `quality` vermelho ainda ia
  para o GHCR. Passa a esperar o check do **mesmo commit** (poll de `head_sha`, até 10 min)
  e a usar `concurrency` que não cancela build no meio.
- **`docker.yml` re-publicava a tag de versão a todo push**: `package.json` só avança no
  release, então todo push em `main` sobrescrevia `ghcr.io/...:<versão>` — a imagem exata que
  o release acabou de promover (`1.3.0` → `d9eded766` contra `v1.3.0` → `fcebe42c`). A tag
  semântica volta a ser exclusividade do `release.yml`; o `main` publica `latest` + SHA.
- **Falha de gravação no `localStorage` era silenciosa**: quota estourada ou storage bloqueado
  dentro do timer do autosave virava erro no console e a perda só aparecia no próximo reload.
  `guardStorage` (`src/ui/storageFeedback.js`) transforma em mensagem i18n no `#sidebar-status`,
  e as ações de documento abortam a operação seguinte em vez de descartar o conteúdo do editor.
- **`resolveKatexPlaceholders` ignorava math-inline e emitia nó inválido**: o placeholder de
  `$…$` fica aninhado em `{text}` dentro de `text[]`, que a checagem só via em string — a
  fórmula saía no PDF como `__KATEX_HTML__:…`. E o math-block virava `text: {image}`, formato
  que o pdfmake mede como texto (`node.text` é testado antes de `node.image`) em vez de imagem.
  Agora os dois formatos viram `{image, fit}` no nível certo, e uma fórmula que não rasteriza
  degrada para texto sem derrubar o export inteiro.
- **Última edição perdida ao fechar a aba ou recarregar**: o autosave tem debounce de 300 ms
  e não havia `pagehide`/`beforeunload` em lugar nenhum do projeto. Ganha `pendingSave` +
  `flushSave`, chamados sincronamente no evento, que também desarmam o timer.
- **Rejeição do boot virava tela branca sem sinal**: `setupEditor()` prometia sem `.catch`;
  um chunk do Monaco que falhasse deixava `unhandledrejection` e nada na tela. Agora o
  `#sidebar-status` recebe a nova chave `bootFailed`.
- **Quota cheia no primeiro boot derrubava o `init()` inteiro**: `createDocument` do boot não
  passava por `guardStorage`, então a `StorageError` abortava o `.then` e editor, tema, barra
  de status e sidebar nunca montavam. O conteúdo segue no `last_state` e o próximo boot
  tenta criar o documento de novo.
- **PDF vetorial pendurava o mermaid**: `getBuffer` do pdfmake só tinha `resolve`; um callback
  que nunca chegasse deixava a promise eterna e o `finally` de `exportPdfVector.js` — que
  chama `resumeMermaidScheduling()` — nunca rodava. Ganha timeout de 30 s com guarda `settled`.
- **Exceção no render congelava o preview em silêncio**: `convertAndRender` roda dentro de um
  `setTimeout`; um erro de `marked`/DOMPurify subia como uncaught e a pré-visualização ficava
  na última versão boa sem aviso. Agora captura, mantém o HTML válido anterior e reporta
  `renderFailed`.
- **`atomicWrite` prometia reversão que não aconteceu**: a mensagem fixava "alteração
  revertida" mesmo quando a reversão do índice também falhou (quota já cheia), escondendo o
  estado real de índice apontando para um documento sem conteúdo. Passa a distinguir os dois
  casos e a expor `err.reverted`.
- **Render do mermaid sumia depois de exportar PDF**: `pauseMermaidScheduling` descartava o
  pedido agendado e `resumeMermaidScheduling` só religava a flag — o diagrama ficava como
  `<pre class="mermaid">` cru até a próxima tecla. Um dirty flag repõe o render no resume.
- **Booleano do domínio engolido pela UI de documentos**: `handleSwitch`/`handleRename`
  embrulhavam `setActive`/`updateTitle` no `guardStorage`, que só enxerga exceções — o
  `false` (documento sumiu do índice enquanto o `prompt` estava aberto) passava direto e a
  UI anunciava o rename como gravado. Agora captura o retorno e reporta `docOpRefused`.
- **Fechar um documento em segundo plano destruía o undo e o scroll do ativo**:
  `handleClose` recarregava o documento ativo mesmo quando ele não era o que foi fechado —
  `setValue` limpa o undo stack do Monaco e `revealPosition(1,1)` jogava o viewport para o
  topo. Passa a recarregar só quando o documento aberto muda mesmo.
- **Rascunho legado era injetado dentro de outro documento**: `resolveDocumentBootInput`
  aplicava a precedência de `last_state` com qualquer contagem de documentos, apesar de a
  docstring restringi-la ao legado de documento único. Com 2+ docs e conteúdo de template, o
  boot carregava o texto do documento anterior no ativo e o autosave o persistia lá.
- **`Ctrl+S` gravava por cima de um arquivo aberto em outro documento**: `currentHandle` era
  global ao app e nada o resetava ao trocar, criar ou fechar documento — abrir `notas.md`,
  trocar de documento e salvar sobrescrevia o arquivo no disco com o conteúdo novo e ainda
  reportava "Arquivo salvo: notas.md". O handle agora é associado ao documento que o recebeu;
  sem correspondência o save cai no caminho de "salvar como" com o nome do documento corrente.
- **Tema e rolagem gravavam fora do guard**: `setItem` do `theme_settings` e do
  `scroll_bar_settings` corriam soltos dentro dos handlers de `change`, e a chave crua
  `theme_boot` nem tinha try/catch no handler (tinha no boot). Uma quota estourada aí virava
  exceção silenciosa no listener: checkbox já virado, preferência perdida no próximo reload e
  o resto do handler — CSS, Monaco, mermaid — nem rodava. Os três pontos passam pelo guard e
  avisam no `#sidebar-status`.
- **`katexHtmlToDataUrl` deixava um nó órfão em `document.body`**: `removeChild` ficava no
  `try`, então qualquer falha do `html2canvas` ia direto pro `catch` e o container invisível
  (`left:-9999px`) ficava preso para sempre — um a cada fórmula que falhasse no rasterizador.
  A remoção foi para um `finally`.
- **`setupKeyboardShortcuts` descartava a própria limpeza**: a função devolvia o `dispose` e
  `init()` jogava fora. Um segundo `init()` (ou um teste que esquecesse o `dispose`) acumulava
  o listener de `keydown` e a mesma tecla clicava N vezes. A registration virou autorlimpeza:
  chamar de novo desfaz a anterior, e o retorno continua disponível para quem quiser desligar
  na mão.

### Security

- **Headers de endurecimento no nginx (F2)**: `Permissions-Policy`, `Cross-Origin-Opener-Policy`
  e `Cross-Origin-Resource-Policy` nos dois blocos de headers (server + `location /`, mesma
  regra de herança da CSP) — travados por teste anti-drift.
- **A CI publica a imagem que foi testada (F3)**: `docker.yml` e `release.yml` dão push no
  artefato que passou no health test em vez de rebuildar (mesmo com cache, base tag
  flutuante poderia sair diferente).
- **`brace-expansion` 5.0.9 → 5.0.12**: 3 advisories `high` (DoS por recursão/quadrático) via
  `eslint → minimatch`, apenas em dev — `npm audit` agora reporta 0 vulnerabilidades.
- **`dompurify` dentro do Monaco forçado para `^3.4.16`**: `monaco-editor@0.57.0` fixa
  `dompurify@3.4.15` (advisory `low`, DOM XSS via hook `afterSanitize`, afeta 3.4.13–3.4.15).
  O `overrides` dedup a cópia aninhada para a `3.4.16` que a app já usa — sem baixar o Monaco
  (a única correção sem override seria `monaco@0.56.0`, downgrade quebrando a 0.57 recém-adotada).
- **HSTS no `nginx.conf`**: `max-age=31536000; includeSubDomains`, sem `preload` de propósito
  (a lista de preload é difícil de reverter). A origem segue em HTTP atrás do tunnel
  `cloudflared` — o FQDN do Coolify fica em `http://`: trocar para `https://` faria o traefik
  exigir TLS e derrubaria o ingress do tunnel. A borda TLS é do Cloudflare.

- **Headers de segurança perdidos nas rotas certas**: um `add_header` dentro de um `location`
  cancela **toda** a herança do nível server, então `/assets/` e a regex de imagens ficavam sem
  CSP/X-Frame/etc. `location /` agora repete o bloco completo (CSP × 2, travada por teste
  anti-drift em `tests/unit/csp.test.js`) e os locations de asset usam só `expires`, que herda
  sem duplicar `Cache-Control`. `X-XSS-Protection` `1; mode=block` → `0` (o modo de bloco é
  ignorado ou prejudicial nos navegadores que ainda o respeitam).
- **Tela branca pós-deploy**: `index.html` passa a `Cache-Control: no-store, no-transform`, e
  `no-transform` sai do nível server — senão o asset ficava com dois `Cache-Control`.
- **CSS inline passava cru pelo sanitizador**: o DOMPurify mantém o atributo `style`, então
  markdown colado podia cobrir o editor inteiro (`position:fixed`/`sticky`), disparar um fetch
  a cada render vazando IP e presença (`background:url(https://…)`) ou trazer payloads
  legados de IE (`expression()`, `behavior:`, `-moz-binding`). Um hook em `convert.js` remove
  o atributo perigoso inteiro, e `FORBID_TAGS: ['style']` fecha `<svg><style>@import …`, que
  sobrevivia ao sanitizer dentro do `<svg>` e executava no documento. O KaTeX não é afetado:
  ele emite `style` com `position:absolute/relative` e alturas, nenhuma das regras o atinge.
- **HTML exportado abria sem nenhuma política**: `buildStandaloneHtml` ganha
  `<meta http-equiv="Content-Security-Policy">` com `default-src 'none'`, `script-src 'none'`
  e `connect-src 'none'`. O arquivo é estático e não tem script próprio, mas qualquer resto
  que escapasse do DOMPurify executava sem restrição alguma. `style-src 'unsafe-inline'` é
  mantido de propósito (CSS embutido, `style` do KaTeX e `<style>` dos SVGs do mermaid) e a
  meta pode ser suprimida com `csp: null` por quem hospeda com header próprio.
- **`<annotation-xml>` reabilitado contra a política do DOMPurify**: `ADD_TAGS` trazia de
  volta o único nó da MathML que o DOMPurify remove de propósito —
  `<annotation-xml encoding="text/html">` embrulha HTML arbitrário dentro de `<math>`, e é a
  classe de vetor que originou os CVEs de MathML do sanitizador. Nada desta app o emite: o
  KaTeX roda com `output: 'html'` e nem chega a produzir MathML. `annotation` e `semantics`
  seguem na allow-list (é o que o usuário escreve), agora com o comentário dizendo exatamente
  isso — o anterior afirmava que "o HTML do KaTeX usa MathML", o que `output: 'html'` contradiz.

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
