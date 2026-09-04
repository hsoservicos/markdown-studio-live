---
title: Markdown-Studio v2 Spec (P2)
created: 2026-09-04
updated: 2026-09-04
module: Markdown-Studio
status: draft
---

# Spec v2 — Markdown-Studio (features P2)

Objetivo: **duas remodelagens coesas** — (P2-9) PDF com texto vetorial pesquisável e (P2-10)
múltiplos documentos locais — derivadas das propostas P2 em
`_bmad-output/verifications/features-proposals.md` e detalhadas em
`_bmad-output/planning-artifacts/epics-p2.md`.

Princípios preservados (PRODUCT.md): offline, sem backend, sem rastreamento, localStorage,
deps npm sem CDN, pt-BR primeiro, design "The Quiet Studio", quality gate verde.

## Ready for Development

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
- **Then** os diagramas aparecem como SVG embutido (reaproveitando a renderização do
  preview) e as fórmulas KaTeX — hoje renderizadas com `output: 'html'` — são convertidas
  para SVG na rota vetorial ou embutidas em alta resolução quando a conversão não for
  suportada
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
- **And** a flag só é habilitada após critérios de estabilidade: CI/e2e verdes por pelo
  menos 2 releases consecutivas e fidelidade validada nos navegadores suportados
- **And** testes unitários cobrem sucesso e erro (mock da lib, sem rede)

### AC-P2-10-1 — Índice e isolamento de documentos

- **Given** um documento ativo com conteúdo editado
- **When** um segundo documento é criado/aberto
- **Then** cada documento persiste sob `com.markdownstudio.documents.*` com leitura tipada
  (`StorageError`/`safeGet`)
- **And** o índice tem schema versionado
  (`{ version, activeId, documents: [{ id, title, updatedAt }] }`) e o conteúdo de cada
  documento fica em chave própria por `id`
- **And** ids são gerados por `crypto.randomUUID()` (com fallback), nunca derivados do
  título — evita colisão e caracteres inválidos em chave de storage
- **And** `last_state`/`backup` continuam funcionando: em modo multi-documento, `last_state`
  espelha o documento ativo e `documents.*` é a fonte de verdade no boot
- **And** `QuotaExceededError` no salvamento dispara aviso i18n e mantém a última versão
  salva intacta (sem perda silenciosa)

### AC-P2-10-2 — Gerenciador de documentos

- **Given** o editor aberto com a sidebar
- **When** o usuário cria/renomeia/alterna/fecha documentos
- **Then** a UI reflete o documento ativo e persiste o documento corrente
- **And** nomes são normalizados (trim), não vazios, com limite de tamanho e únicos —
  duplicatas recebem sufixo numérico automático; validação com feedback i18n
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
- **And** snapshots preservam a origem (id/etiqueta)
- **And** snapshots legados sem origem (pré-P2) são atribuídos ao documento ativo na
  migração ou mantidos em raiz "legado" — nunca perdidos silenciosamente

### AC-P2-10-4 — Boot com restauração

- **Given** documentos abertos e um documento ativo na sessão anterior
- **When** a página recarrega
- **Then** a lista é restaurada e o documento ativo reabre
- **And** índice vazio/corrompido degrada para o template do idioma corrente sem crash
- **And** id ativo ausente do índice → fallback para o primeiro documento ou template, com
  aviso
- **And** conteúdo individual corrompido → documento ignorado com aviso i18n, sem quebrar o
  restante da lista

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

## Non-goals (v2)

- Backend, sync remoto, colaboração, contas.
- Multi-abas simultâneas do mesmo navegador (última escrita vence; comportamento
  documentado, não suportado).
- PDF com layout pixel-perfect idêntico ao navegador em todos os casos (rota avalia
  fidelidade vs pesquisabilidade).

## Reference

- Epics/stories: `_bmad-output/planning-artifacts/epics-p2.md`
- Propostas: `_bmad-output/verifications/features-proposals.md`
- PRD: `specs/prd.md`
