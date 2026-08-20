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
  exportPdf: 'Exportar PDF',
  syncScroll: 'Sincronizar rolagem',
  darkMode: 'Modo escuro',
  resetConfirm: 'Tem certeza que deseja redefinir? O conteúdo atual será perdido.',
  pdfUnavailable: 'A exportação de PDF ainda não está disponível. Tente novamente em instantes.',
  pdfExported: 'PDF exportado!',
  exportError: 'Falha ao exportar o PDF.',
  mermaidError: 'Erro do Mermaid: ',
  mermaidRenderFailed: 'Falha ao renderizar o diagrama.',
  editorLabel: 'Editor de Markdown',
  previewLabel: 'Pré-visualização',
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
  newFile: 'Novo arquivo',
  newFileConfirm: 'Tem certeza que deseja criar um novo arquivo? O conteúdo atual será perdido.',
  saveFile: 'Salvar arquivo',
  print: 'Imprimir',
  closeManual: 'Fechar',
  languageLabel: 'Idioma',
  filePickerFallback: 'Usando seletor de arquivos padrão do navegador.',
  fileOpened: 'Arquivo aberto: {name}',
  fileSaved: 'Arquivo salvo: {name}',
  fileSaveDenied: 'Salvamento cancelado.',
  fileError: 'Não foi possível abrir o arquivo.',
  saveError: 'Não foi possível salvar o arquivo.',
  printError: 'Não foi possível iniciar a impressão.',
  printSettings: 'Configurar impressão',
  printSettingsTitle: 'Configurar impressão',
  printSettingsSaved: 'Configurações de impressão salvas!',
  printMarginLabel: 'Margem (mm)',
  printPaperLabel: 'Papel',
  printOrientationLabel: 'Orientação',
  printPortrait: 'Retrato',
  printLandscape: 'Paisagem',
  printHeaderLabel: 'Cabeçalho ({page} = nº)',
  printFooterLabel: 'Rodapé ({page} = nº)',
  printSave: 'Salvar',
  words: '{n} palavras',
  chars: '{n} caracteres',
  lines: '{n} linhas',
  readingTime: '~{n} min de leitura',
  statsLabel: 'Estatísticas do documento',
  toc: 'Sumário',
  tocTitle: 'Sumário',
  tocEmpty: 'Sem títulos para listar.',
  tocHeading: 'Sumário',
};

const enUS = {
  appTitle: 'Markdown-Studio',
  reset: 'Reset',
  copy: 'Copy',
  copied: 'Copied!',
  exportPdf: 'Export PDF',
  syncScroll: 'Sync scroll',
  darkMode: 'Dark mode',
  resetConfirm: 'Are you sure you want to reset? Your changes will be lost.',
  pdfUnavailable: 'PDF export is not available yet. Please try again in a moment.',
  pdfExported: 'PDF exported!',
  exportError: 'Failed to export PDF.',
  mermaidError: 'Mermaid error: ',
  mermaidRenderFailed: 'Failed to render the diagram.',
  editorLabel: 'Markdown editor',
  previewLabel: 'Preview',
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
  newFile: 'New file',
  newFileConfirm: 'Are you sure you want to create a new file? Current content will be lost.',
  saveFile: 'Save file',
  print: 'Print',
  closeManual: 'Close',
  languageLabel: 'Language',
  filePickerFallback: 'Using the standard browser file picker.',
  fileOpened: 'Opened file: {name}',
  fileSaved: 'Saved file: {name}',
  fileSaveDenied: 'Save cancelled.',
  fileError: 'Could not open the file.',
  saveError: 'Could not save the file.',
  printError: 'Could not start printing.',
  printSettings: 'Print settings',
  printSettingsTitle: 'Print settings',
  printSettingsSaved: 'Print settings saved!',
  printMarginLabel: 'Margin (mm)',
  printPaperLabel: 'Paper',
  printOrientationLabel: 'Orientation',
  printPortrait: 'Portrait',
  printLandscape: 'Landscape',
  printHeaderLabel: 'Header ({page} = page no.)',
  printFooterLabel: 'Footer ({page} = page no.)',
  printSave: 'Save',
  words: '{n} words',
  chars: '{n} characters',
  lines: '{n} lines',
  readingTime: '~{n} min read',
  statsLabel: 'Document statistics',
  toc: 'Table of contents',
  tocTitle: 'Table of contents',
  tocEmpty: 'No headings to list.',
  tocHeading: 'Table of contents',
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

export function getLocale() {
  return current;
}

export function t(key) {
  return current[key] ?? key;
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
