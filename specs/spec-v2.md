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
  renderizado no preview) e as fórmulas KaTeX — hoje renderizadas com `output: 'html'` —
  são re-renderizadas com `output: 'svg'` na rota vetorial ou embutidas em alta resolução
  quando a conversão não for suportada
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
