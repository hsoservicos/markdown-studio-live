# How-to: Re-editar e evoluir o Markdown-Studio

Guia operacional para qualquer mudança no projeto — do planejamento ao merge — seguindo o workflow BMAD (`bmad-build`): **Clarify → Plan → Implement → Review → Present**.

## Fluxo de trabalho

### 1. Clarify (esclarecer)

- Leia `docs/how-to/re-edit-overview.md` (este arquivo) e o PRD (`specs/prd.md`).
- Responda: o que o usuário precisa, qual o objetivo do usuário (uma feature coesa).
- **Não inicie** mais de um deliverable independente por vez.

### 2. Plan (planejar)

- Para features novas, crie/atualize a spec em `specs/` com **ACs testáveis Given/When/Then**.
- Defina o caminho de arquivo exato de cada tarefa.

### 3. Implement (implementar)

- Escreva código + **teste Vitest** na menor camada que capture a regressão.
- Rode os testes localmente: `npm test`.
- Commits em Conventional Commits (`feat:`, `fix:`, `etc.`).

### 4. Review (revisar)

- `npm run quality` (format + lint + lint:md + test) — **obrigatório antes de push**.
- Revisão adversarial: procure bordas de erro, falsos positivos, regressões de contrato.

### 5. Present (apresentar)

- Atualize `CHANGELOG.md` sob `## [Unreleased]`.
- Faça o release quando pronto (ver "Publicar").

## Como adicionar uma nova função pura (exemplo rápido)

1. Add a função em `src/render/` (ex.: `srRenderMermaid`).
2. Escreva o teste em `tests/unit/render.test.js` cobrindo: normal, erro, edge case.
3. Registre a string de UI (se houver) em `src/i18n/index.js`.
4. Expõe o comportamento no `main.js` apenas como _glue_.
5. Rode `npm test` e `npm run lint`.

## Como adicionar uma nova string de UI

1. Vá em `src/i18n/index.js` e adicione a chave no objeto do locale.
2. NUNCA hardcode texto em `main.js` ou `index.html` — use `t('chave')`.
3. Para placeholders, use `data-i18n-placeholder="chave"` no elemento; o `applyI18n` aplica.
4. Atualize o template padrão pt-BR se a mudança for de exemplos.

## Como adicionar um novo idioma (locale)

1. Crie o objeto de strings (pt-BR como referência) e registre-o em `locales` em `src/i18n/index.js`.
2. Adicione o código em `SUPPORTED_LOCALES` em `src/ui/language.js` (usado por `normalizeLocale` e pelo seletor).
3. Adicione a `<option>` correspondente em `#lang-select` no `index.html` (texto no idioma nativo).
4. A persistência e o reload são automáticos: `setupLanguageSelector` grava em `com.markdownstudio.locale` e recarrega a página; `applyStoredLocale` aplica a tradução no boot.

## Como extender a sidebar e o drawer mobile

1. O recolhimento é controlado por `src/ui/sidebar.js` (`setupSidebar`): o handler **inverte** o estado atual (`is-collapsed`), sincroniza `aria-expanded`/`aria-label`/`title` em todos os toggles e persiste em `com.markdownstudio.sidebar.collapsed` (string `"1"`/`"0"`).
2. Toggles: o do painel usa `id="sidebar-toggle"`; qualquer botão extra deve ter `data-sidebar-toggle` e `aria-controls="sidebar-nav"` — ambos são registrados no array `toggles`.
3. Responsivo: em ≤720px a sidebar vira **drawer overlay fixo** (`translateX(-100%)` colapsado / `translateX(0)` aberto, `width: min(280px, 84vw)`), o editor ocupa a coluna cheia (`grid-template-columns: minmax(0,1fr)`) e o toggle aparece no header do painel (`#menu-items [data-sidebar-toggle]`). Sem preferência salva, o boot em viewport compacto colapsa.
4. Breakpoints/posicionamento ficam em `public/css/style.css` (bloco `Responsive (mobile)`). Nada de `box-shadow` em overlays (no-shadow per DESIGN.md) — use camadas/hairlines.
5. Testes em `tests/unit/sidebar.test.js` (jsdom, com stub de `globalThis.matchMedia`); validação em navegador real via puppeteer contra o container Docker (ver `docker-workflow.md`), conferindo classes, `translateX`, larguras de coluna e ausência de overflow horizontal em 375/768/1024/1280.

## Como adicionar uma ação na sidebar

1. Adicione o `<button class="sidebar-item" data-sidebar-action="<nome>" data-i18n-title="<key>" title="<pt>">` em `index.html` (ícone SVG + `<span class="sidebar-item-label" data-i18n="<key>">`), seguindo o padrão dos botões existentes.
2. Registre `<key>` e, se houver confirmação de perda de conteúdo, `<key>Confirm` em `src/i18n/index.js` (pt-BR e en).
3. Defina o handler em `src/main.js` dentro de `handlers` (`{ <nome>: () => ... }`); o `setupSidebar` despacha a action automaticamente. Para desfazer o conteúdo, use `editor.setValue('')` + `editor.focus()` (ver a feature **Novo arquivo**).

## Como estender o Export PDF

1. A lib `html2pdf.js` é uma dependência **npm local** (sem CDN), carregada sob demanda em chunk próprio via `loadHtml2Pdf()` (`import('html2pdf.js')`) — o bundle inicial não incha e a ausência da lib cai em `pdfUnavailable` (alerta).
2. A saída é configurada por `buildExportOptions(filename = 'markdown-preview.pdf')` em `src/ui/exportPdf.js`: A4 retrato (`jsPDF: { unit: 'mm', format: 'a4' }`), margem 10, escala 2 e `onclone` que força `data-theme="light"` + `#preview-wrapper` com `190mm` no documento clonado (o tema dark do app nunca "vaza" para o PDF).
3. O export re-renderiza os diagramas Mermaid no tema default (`renderMermaidDiagrams('default')`) e, se o app estava em dark, restaura o tema ao final (`finally`) — necessário porque o preview é clonado durante o capture.
4. O handler da sidebar (`exportPdf` em `main.js`) passa `report` como `onStatus`: sucesso mostra `pdfExported`, erro de save mostra `exportError`. Para mudar o arquivo de saída, altere o `filename` em `buildExportOptions` ou o `DEFAULT_PDF_FILENAME`.
5. Testes: `tests/unit/exportPdf.test.js` mocka `html2pdf.js` (hopping via `vi.hoisted`) e cobre: `buildExportOptions` (A4/onclone), preview ausente (no-op), lib indisponível (alerta), sucesso (set→from→save + `pdfExported`) e erro (save rejeita → `exportError` + restaura Mermaid dark). Validação e2e real: `pdf_probe.js`/`pdf_probe_en.js` no puppeteer baixam o PDF no Docker (`Page.setDownloadBehavior`) e verificam header `%PDF-` em pt e en (ver `docker-workflow.md`).

## Como estender a troca de idiomas (pt-BR / English)

1. Toda string de UI vive em `src/i18n/index.js` (objetos `ptBR`/`enUS`) e é consumida por `t('chave')`. **Nunca hardcode** texto visível — nem erros (`mermaid.js` usa `mermaidError`/`mermaidRenderFailed`).
2. Atributos acessíveis/SEO: use `data-i18n-aria-label`, `data-i18n-alt`, `data-i18n-title` e `data-i18n-content` no elemento; o `applyI18n` (em `main.js`) aplica a tradução no boot. Elementos com `data-i18n` têm o `textContent` traduzido. Botões `.sidebar-item` devem ter `title` (tooltip) — essencial para instruir ações quando a sidebar está recolhida.
3. O conteúdo do editor segue `getDefaultTemplate()`: `DEFAULT_TEMPLATE_PT` / `DEFAULT_TEMPLATE_EN` são escolhidos pela locale corrente no boot e no **Redefinir/Reset**. `scheduleSave` **não persiste** templates não editados — assim a troca de idioma restaura o exemplo do idioma atual.
4. O Manual é bilingue: `manual/markdown-manual.md` (PT) e `manual/markdown-manual-en.md` (EN). `getManualUrl()` (em `sidebar.js`) resolve o arquivo pela locale; ambos são copiados de `public/manual/` para o `dist/` pelo Vite e servidos pelo nginx.
5. A troca é persistida em `com.markdownstudio.locale` e aplicada via `setupLanguageSelector` com reload (`onReload`) — o `<html lang>` é sincronizado por `applyStoredLocale`.
6. Testes: `tests/unit/i18n.test.js` (paridade dos templates) e `tests/unit/sidebar.test.js` (`getManualUrl`). Validação e2e real via puppeteer contra o container Docker (ver `docker-workflow.md`) cobrindo pt→en→pt: UI, aria/alt, meta, template do editor e conteúdo do Manual.

## Como publicar um release

1. Garanta `npm run quality` verde em HEAD.
2. Atualize `CHANGELOG.md`: promova `## [Unreleased]` → `## [X.Y.Z] — <AAAA-MM-DD>` e crie um novo `[Unreleased]` vazio.
3. Rode a tag: `npm run release` (padrão: patch) ou `npm run release:minor|major`.
4. Se quiser deploy: `firebase login` e `firebase deploy` (config em `firebase.json`, hosta `dist/`).

## Limites do escopo v1

- Não há autenticação, backend nem multi-usuário (fora de escopo v1).
- Monaco e mermaid são fornecidos por npm (sem CDN) — para contribuir com CDN, remover do bundle.
- Não adicionar rastreadores (GA removido do upstream).

## Checklist pré-push

- [ ] `npm test` passa
- [ ] `npm run lint` passa (sem warnings)
- [ ] `npm run lint:md` passa
- [ ] `npm run format:check` passa
- [ ] CHANGELOG atualizado sob `[Unreleased]`
- [ ] Commit em Conventional Commits
