export const NAMESPACE = 'com.markdownstudio';

export const KEYS = {
  lastState: 'last_state',
  scrollBar: 'scroll_bar_settings',
  theme: 'theme_settings',
  themeBoot: 'com.markdownstudio_theme',
  locale: 'locale',
};

const ptBR = {
  appTitle: 'Markdown-Studio',
  reset: 'Redefinir',
  copy: 'Copiar',
  copied: 'Copiado!',
  copyHtml: 'Copiar HTML',
  copyHtmlTitle: 'Copiar como HTML rico',
  copiedHtml: 'HTML copiado!',
  copyError: 'Não foi possível copiar.',
  exportHtml: 'Exportar HTML',
  exportHtmlTitle: 'Exportar HTML standalone',
  htmlExported: 'HTML exportado: {name}',
  exportHtmlError: 'Falha ao exportar o HTML.',
  snapshots: 'Snapshots',
  snapshotsTitle: 'Snapshots locais',
  snapshotsEmpty: 'Nenhum snapshot ainda. Eles são criados automaticamente ao editar.',
  snapshotRestore: 'Restaurar',
  snapshotRemove: 'Remover',
  snapshotRestored: 'Snapshot restaurado!',
  snapshotRemoved: 'Snapshot removido.',
  snapshotUntitled: '(sem título)',
  snapshotQuota: 'Espaço cheio: snapshot automático pausado — exporte ou remova snapshots antigos.',
  exportPdf: 'Exportar PDF',
  syncScroll: 'Sincronizar rolagem',
  darkMode: 'Modo escuro',
  resetConfirm: 'Tem certeza que deseja redefinir? O conteúdo atual será perdido.',
  pdfUnavailable: 'A exportação de PDF ainda não está disponível. Tente novamente em instantes.',
  pdfExported: 'PDF exportado!',
  pdfGenerating: 'Gerando PDF...',
  exportError: 'Falha ao exportar o PDF.',
  quotaExceeded: 'Espaço de armazenamento cheio. A última versão salva foi mantida.',
  storageDisabled: 'O armazenamento local está desabilitado neste navegador.',
  saveFailed: 'Não foi possível salvar a alteração. Tente novamente.',
  bootFailed: 'Não foi possível iniciar o editor. Recarregue a página.',
  renderFailed: 'Falha ao renderizar a pré-visualização. A versão anterior foi mantida.',
  docOpRefused: 'Operação recusada: o documento não está mais no índice.',
  bootWarnActiveId:
    'Aviso: o documento ativo da última sessão não está mais no índice — aberto o primeiro da lista.',
  bootWarnIndexCleaned: 'Aviso: o índice de documentos tinha entradas inválidas e foi limpo.',
  bootWarnIndexVersion:
    'Aviso: o índice de documentos é de uma versão mais nova do app — iniciado vazio.',
  bootWarnCorruptContent:
    'Aviso: o conteúdo do documento estava corrompido — carregado o template.',
  mermaidError: 'Erro do Mermaid: ',
  mermaidRenderFailed: 'Falha ao renderizar o diagrama.',
  editorLabel: 'Editor de Markdown',
  syncLabel: 'Sincronizar rolagem',
  themeLabel: 'Modo escuro',
  githubAlt: 'Repositório no GitHub',
  sidebarTitle: 'Navegação',
  metaDescription:
    'Markdown-Studio: editor Markdown com preview em tempo real — sem backend e sem rastreadores.',
  sidebarOpen: 'Expandir barra lateral',
  sidebarClose: 'Recolher barra lateral',
  dividerLabel: 'Divisor de painéis',
  openManual: 'Manual do Markdown',
  openFile: 'Abrir arquivo',
  openFileConfirm: 'Abrir um arquivo substitui o conteúdo atual. Continuar?',
  newFile: 'Novo arquivo',
  saveFile: 'Salvar arquivo',
  print: 'Imprimir',
  closeDialog: 'Fechar',
  cancel: 'Cancelar',
  languageLabel: 'Idioma',
  filePickerFallback: 'Usando seletor de arquivos padrão do navegador.',
  fileOpened: 'Arquivo aberto: {name}',
  docCreated: 'Documento criado: {name}',
  fileSaved: 'Arquivo salvo: {name}',
  fileSaveDenied: 'Salvamento cancelado.',
  fileError: 'Não foi possível abrir o arquivo.',
  saveError: 'Não foi possível salvar o arquivo.',
  printError: 'Não foi possível iniciar a impressão.',
  printSettings: 'Configurar impressão',
  printSettingsTitle: 'Configurar impressão',
  printSettingsSaved: 'Configurações de impressão salvas!',
  printMarginLabel: 'Margem',
  printPaperLabel: 'Papel',
  printOrientationLabel: 'Orientação',
  printPortrait: 'Retrato',
  printLandscape: 'Paisagem',
  printHeaderLabel: 'Cabeçalho',
  printFooterLabel: 'Rodapé',
  printHintPage: '{page} = nº da página',
  printHeaderPlaceholder: 'Ex: Documento confidencial',
  printFooterPlaceholder: 'Ex: Página {page}',
  printSave: 'Salvar',
  words: '{n} palavras',
  chars: '{n} caracteres',
  lines: '{n} linhas',
  readingTime: '~{n} min de leitura',
  statsLabel: 'Estatísticas do documento',
  skipToContent: 'Pular para o conteúdo',
  toc: 'Sumário',
  tocTitle: 'Sumário',
  tocEmpty: 'Sem títulos para listar.',
  documents: 'Documentos',
  docListLabel: 'Documentos abertos',
  docNew: 'Novo documento',
  docRename: 'Renomear',
  docClose: 'Fechar documento',
  docCloseConfirm: 'Fechar este documento? O conteúdo dele será removido.',
  docDefaultName: 'Documento',
  docNameConflict: 'Já existe um documento com esse nome.',
  docEmpty: 'O nome do documento não pode ficar em branco.',
  docUntitled: '(sem título)',
  docRestored: 'Documento restaurado',
  storageQuotaWarning:
    'Atenção: armazenamento local quase cheio ({percent}%). Considere exportar seus documentos.',
};

const enUS = {
  appTitle: 'Markdown-Studio',
  reset: 'Reset',
  copy: 'Copy',
  copied: 'Copied!',
  copyHtml: 'Copy HTML',
  copyHtmlTitle: 'Copy as rich HTML',
  copiedHtml: 'HTML copied!',
  copyError: 'Could not copy.',
  exportHtml: 'Export HTML',
  exportHtmlTitle: 'Export standalone HTML',
  htmlExported: 'HTML exported: {name}',
  exportHtmlError: 'Failed to export HTML.',
  snapshots: 'Snapshots',
  snapshotsTitle: 'Local snapshots',
  snapshotsEmpty: 'No snapshots yet. They are created automatically while you edit.',
  snapshotRestore: 'Restore',
  snapshotRemove: 'Remove',
  snapshotRestored: 'Snapshot restored!',
  snapshotRemoved: 'Snapshot removed.',
  snapshotUntitled: '(untitled)',
  snapshotQuota: 'Storage full: automatic snapshots paused — export or remove old snapshots.',
  exportPdf: 'Export PDF',
  syncScroll: 'Sync scroll',
  darkMode: 'Dark mode',
  resetConfirm: 'Are you sure you want to reset? Your changes will be lost.',
  pdfUnavailable: 'PDF export is not available yet. Please try again in a moment.',
  pdfExported: 'PDF exported!',
  pdfGenerating: 'Generating PDF...',
  exportError: 'Failed to export PDF.',
  quotaExceeded: 'Storage is full. The last saved version was kept.',
  storageDisabled: 'Local storage is disabled in this browser.',
  saveFailed: 'Could not save the change. Please try again.',
  bootFailed: 'Could not start the editor. Reload the page.',
  renderFailed: 'Failed to render the preview. The previous version was kept.',
  docOpRefused: 'Operation refused: the document is no longer in the index.',
  bootWarnActiveId:
    'Warning: last session active document is no longer in the index — opened the first one.',
  bootWarnIndexCleaned: 'Warning: the document index had invalid entries and was cleaned.',
  bootWarnIndexVersion: 'Warning: the document index is from a newer app version — started empty.',
  bootWarnCorruptContent: 'Warning: the document content was corrupt — the template was loaded.',
  mermaidError: 'Mermaid error: ',
  mermaidRenderFailed: 'Failed to render the diagram.',
  editorLabel: 'Markdown editor',
  syncLabel: 'Sync scroll',
  themeLabel: 'Dark mode',
  githubAlt: 'GitHub repository',
  sidebarTitle: 'Navigation',
  metaDescription: 'Markdown-Studio: real-time preview markdown editor — no backend, no trackers.',
  sidebarOpen: 'Expand sidebar',
  sidebarClose: 'Collapse sidebar',
  dividerLabel: 'Pane divider',
  openManual: 'Markdown manual',
  openFile: 'Open file',
  openFileConfirm: 'Opening a file replaces the current content. Continue?',
  newFile: 'New file',
  saveFile: 'Save file',
  print: 'Print',
  closeDialog: 'Close',
  cancel: 'Cancel',
  languageLabel: 'Language',
  filePickerFallback: 'Using the standard browser file picker.',
  fileOpened: 'Opened file: {name}',
  docCreated: 'Document created: {name}',
  fileSaved: 'Saved file: {name}',
  fileSaveDenied: 'Save cancelled.',
  fileError: 'Could not open the file.',
  saveError: 'Could not save the file.',
  printError: 'Could not start printing.',
  printSettings: 'Print settings',
  printSettingsTitle: 'Print settings',
  printSettingsSaved: 'Print settings saved!',
  printMarginLabel: 'Margin',
  printPaperLabel: 'Paper',
  printOrientationLabel: 'Orientation',
  printPortrait: 'Portrait',
  printLandscape: 'Landscape',
  printHeaderLabel: 'Header',
  printFooterLabel: 'Footer',
  printHintPage: '{page} = page number',
  printHeaderPlaceholder: 'Ex: Confidential document',
  printFooterPlaceholder: 'Ex: Page {page}',
  printSave: 'Save',
  words: '{n} words',
  chars: '{n} characters',
  lines: '{n} lines',
  readingTime: '~{n} min read',
  statsLabel: 'Document statistics',
  skipToContent: 'Skip to content',
  toc: 'Table of contents',
  tocTitle: 'Table of contents',
  tocEmpty: 'No headings to list.',
  documents: 'Documents',
  docListLabel: 'Open documents',
  docNew: 'New document',
  docRename: 'Rename',
  docClose: 'Close document',
  docCloseConfirm: 'Close this document? Its content will be removed.',
  docDefaultName: 'Document',
  docNameConflict: 'A document with that name already exists.',
  docEmpty: 'Document name cannot be empty.',
  docUntitled: '(untitled)',
  docRestored: 'Restored document',
  storageQuotaWarning:
    'Warning: local storage almost full ({percent}%). Consider exporting your documents.',
};

const locales = { 'pt-BR': ptBR, en: enUS };

let current = locales['pt-BR'];
let currentCode = 'pt-BR';

export function setLocale(locale) {
  currentCode = locales[locale] ? locale : 'pt-BR';
  current = locales[currentCode];
}

export function getLocaleCode() {
  return currentCode;
}

export function t(key) {
  // C5: chave ausente no idioma corrente cai no pt-BR antes de expor a chave
  // crua para o usuário.
  return current[key] ?? ptBR[key] ?? key;
}

export const DEFAULT_TEMPLATE_PT = `# Guia de sintaxe Markdown

## Cabeçalhos

# Este é um título h1
## Este é um título h2
###### Este é um título h6

## Ênfase

*Este texto será itálico*  
_Também será itálico_

**Este texto será negrito**  
__Também será negrito__

_É **possível** combiná-los_

## Listas

### Não ordenadas

* Item 1
* Item 2
* Item 2a
* Item 2b
    * Item 3a
    * Item 3b

### Ordenadas

1. Item 1
2. Item 2
3. Item 3
    1. Item 3a
    2. Item 3b

## Imagens

![Este é um texto alternativo.](/image/Markdown-mark.svg "Esta é uma imagem de exemplo.")

## Links

Você pode estar usando o [Markdown-Studio](https://example.com/).

## Citações

> Markdown é uma linguagem de marcação leve com sintaxe de formatação em texto simples, criada em 2004 por John Gruber com Aaron Swartz.
>
> >> Markdown é frequentemente usado para formatar arquivos README, escrever mensagens em fóruns de discussão online e criar rich text usando um editor de texto simples.

## Tabelas

| Coluna esquerda | Coluna direita |
| --------------- |:--------------:|
| left foo        | right foo      |
| left bar        | right bar      |
| left baz        | right baz      |

## Blocos de código

\`\`\`
let mensagem = 'Olá mundo';
alert(mensagem);
\`\`\`

## Diagramas Mermaid

\`\`\`mermaid
graph TD
  A[Início] --> B{Decisão}
  B -->|Sim| C[Fim]
  B -->|Não| D[Alternativa]
\`\`\`

## Código inline

Este site usa \`marked\`.
`;

export const DEFAULT_TEMPLATE_EN = `# Markdown syntax guide

## Headings

# This is an h1 heading
## This is an h2 heading
###### This is an h6 heading

## Emphasis

*This text will be italic*  
_This will also be italic_

**This text will be bold**  
__This will also be bold__

_You **can** combine them_

## Lists

### Unordered

* Item 1
* Item 2
* Item 2a
* Item 2b
    * Item 3a
    * Item 3b

### Ordered

1. Item 1
2. Item 2
3. Item 3
    1. Item 3a
    2. Item 3b

## Images

![This is an alt text.](/image/Markdown-mark.svg "This is an example image.")

## Links

You may be using [Markdown-Studio](https://example.com/).

## Blockquotes

> Markdown is a lightweight markup language with plain-text formatting syntax, created in 2004 by John Gruber with Aaron Swartz.
>
> >> Markdown is often used to format README files, write messages in online discussion forums, and create rich text using a plain text editor.

## Tables

| Left column | Right column |
| ------------ |:------------:|
| left foo     | right foo    |
| left bar     | right bar    |
| left baz     | right baz    |

## Code blocks

\`\`\`
let message = 'Hello world';
alert(message);
\`\`\`

## Mermaid diagrams

\`\`\`mermaid
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[End]
  B -->|No| D[Alternative]
\`\`\`

## Inline code

This site uses \`marked\`.
`;

export const DEFAULT_TEMPLATE = DEFAULT_TEMPLATE_PT;

export function getDefaultTemplate() {
  return currentCode === 'en' ? DEFAULT_TEMPLATE_EN : DEFAULT_TEMPLATE_PT;
}
