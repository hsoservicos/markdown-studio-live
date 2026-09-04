---
stepsCompleted: []
inputDocuments:
  - _bmad-output/verifications/features-proposals.md
  - specs/prd.md
  - PRODUCT.md
---

# Markdown-Studio — Epic Breakdown P2

Decomposição das features P2 (9 e 10) em epics e stories implementáveis, derivada das
propostas em `_bmad-output/verifications/features-proposals.md` e dos princípios do produto
(PRODUCT.md): offline, sem backend, sem rastreamento, localStorage, deps via npm (sem CDN),
pt-BR primeiro, design "The Quiet Studio".

> **Relação com a spec:** os Acceptance Criteria canônicos (Given/When/Then) vivem em
> `specs/spec-v2.md` e são referenciados aqui por id (ex.: `AC-P2-9-1`). As stories só
> acrescentam critérios de implementação — sem duplicar os ACs da spec.

## Requirements Inventory

### Functional Requirements

- FR-P2-9: o usuário exporta um PDF com **texto vetorial pesquisável** (Ctrl+F e seleção
  funcionam), em vez da imagem rasterizada atual (html2canvas).
- FR-P2-10: o usuário gerencia **múltiplos documentos** Markdown locais (abas e/ou lista),
  com a mesma privacidade local do documento único atual.

### NonFunctional Requirements

- NFR-1: 100% client-side; nenhuma chamada externa em runtime (offline após build).
- NFR-2: persistência apenas em `localStorage` (chaves `com.markdownstudio.*`).
- NFR-3: deps npm locais, sem CDN; dynamic import para não inchar o bundle inicial.
- NFR-4: qualidade gate verde (`npm run quality`) e testes na menor camada que capture a
  regressão.
- NFR-5: acessibilidade (teclado, `aria-live`, foco visível) e i18n pt-BR/en.

### Additional Requirements

- Preservar todos os contratos atuais (`last_state`, `backup`, `print_settings`, `locale`,
  `theme_settings` etc.) — compatibilidade com dados existentes.
- Layout/impressão atuais (P0-1/P0-2) continuam funcionando durante e após a migração.

### FR Coverage Map

| Epic   | FRs cobertas |
| ------ | ------------ |
| P2-A   | FR-P2-9      |
| P2-B   | FR-P2-10     |

## Epic List

| #   | Key              | Título                                        | Estimativa (stories) |
| --- | ---------------- | --------------------------------------------- | -------------------- |
| 1   | p2-pdf-vetorial  | PDF com texto vetorial pesquisável            | 4                    |
| 2   | p2-documentos    | Múltiplos documentos locais (abas/lista)      | 4                    |

---

# Epic 1: PDF com texto vetorial pesquisável (P2-9)

**Objetivo:** substituir a rasterização (html2canvas → imagem) por um PDF com camada de
texto real, permitindo Ctrl+F, seleção e acessibilidade — sem quebrar as features de
impressão P0-1/P0-2 e sem introduzir CDN.

## Story 1.1: Spike — avaliar a rota de PDF vetorial

Como desenvolvedor,
quero avaliar tecnicamente a melhor rota (pdfmake/jsPDF-text vs camada de texto sobre o
layout atual vs renderer dedicado),
para que a decisão de arquitetura seja baseada em evidência e caiba nas restrições offline.

**Acceptance Criteria** (spike — sem AC canônico na spec):

- **Given** as features P0-1/P0-2 (config de impressão + quebras) e o layout HTML atual
- **When** eu pesquiso e prototipo as rotas candidatas (pdfmake, jsPDF.text, overlay de
  texto sobre o PDF atual)
- **Then** o resultado documenta, para cada rota: fidelidade do layout, suporte a
  tabelas/mermaid/KaTeX (formato: texto/SVG/imagem), custo de migração e tamanho de bundle
  (com dynamic import)
- **And** a rota escolhida é registrada em `docs/explanation/architecture.md` (decisão ADR)
  sem exigir CDN ou backend
- **And** o ADR registra o formato suportado por tipo de conteúdo (texto/SVG/imagem) e a
  estratégia de conversão KaTeX html→SVG para a rota vetorial

## Story 1.2: Camada de layout vetorial (markdown → definição do documento)

Como usuário,
quero que a saída PDF tenha títulos, parágrafos, listas, tabelas, citações, código e links
como texto real,
para que eu possa selecionar e buscar conteúdo no PDF exportado.

**Acceptance Criteria:** canônico em `AC-P2-9-1` (specs/spec-v2.md). Critérios de
implementação:

- mapear cada bloco Markdown para a definição do documento vetorial (ex.: pdfmake `content`
  ou jsPDF texto) preservando a hierarquia de títulos
- `blockquote`, código inline/fenced e texto de links entram como texto vetorial, não como
  imagem
- manter margem, papel (A4/Letter), orientação e cabeçalho/rodapé com `{page}` (P0-1)

## Story 1.3: Diagramas e matemática no PDF vetorial

Como usuário,
quero que os diagramas Mermaid e as fórmulas KaTeX sejam preservados no PDF,
para que o artefato exportado não perca conteúdo não textual.

**Acceptance Criteria:** canônico em `AC-P2-9-2` (specs/spec-v2.md). Critérios de
implementação:

- embutir o SVG do mermaid já renderizado no preview (sem re-renderizar)
- converter o HTML do KaTeX (hoje `output: 'html'`) para SVG na rota vetorial, com fallback
  de alta resolução quando a conversão não for suportada
- integrar com as quebras de página conscientes (P0-2)

## Story 1.4: Paridade de contrato e fallback

Como usuário,
quero que o fluxo degrade com clareza quando o navegador/lib não suportar a rota nova,
para que nenhuma regressão silencie o erro.

**Acceptance Criteria:** canônico em `AC-P2-9-3` (specs/spec-v2.md). Critérios de
implementação:

- implementar a feature-flag `com.markdownstudio.pdf.vector` (default off) e a detecção de
  suporte em runtime
- manter o fallback rasterizado atual como default enquanto a flag estiver desabilitada
- testes unitários com mock da lib (sucesso e erro, sem rede)

---

# Epic 2: Múltiplos documentos locais (P2-10)

**Objetivo:** permitir abrir/criar/alternar entre vários artefatos Markdown na mesma sessão,
todos persistidos localmente com a mesma privacidade, sem colidir com os contratos atuais.

## Story 2.1: Índice de documentos no storage

Como usuário,
quero que cada documento tenha identidade e conteúdo próprios no localStorage,
para que abrir outro documento não destrua o rascunho atual.

**Acceptance Criteria:** canônico em `AC-P2-10-1` (specs/spec-v2.md). Critérios de
implementação:

- schema versionado do índice
  (`{ version, activeId, documents: [{ id, title, updatedAt }] }`) e conteúdo por `id`
- ids via `crypto.randomUUID()` (com fallback), nunca derivados do título
- `documents.*` como fonte de verdade no boot; `last_state` espelha o documento ativo
- `QuotaExceededError` → aviso i18n e última versão salva mantida intacta

## Story 2.2: Gerenciador de documentos (`src/ui/documents.js`)

Como usuário,
quero uma lista/abas de documentos para criar, renomear, alternar e fechar,
para que eu organize vários artefatos sem sair do editor.

**Acceptance Criteria:** canônico em `AC-P2-10-2` (specs/spec-v2.md). Critérios de
implementação:

- validação de nomes: trim, não vazio, limite de tamanho, unicidade com sufixo numérico
  automático e feedback i18n
- fechar o documento ativo promove o próximo da lista (ou abre o template se a lista
  esvaziar)
- confirmação antes de descartar conteúdo não salvo (padrão `newFileConfirm`)
- lista operável por teclado com `aria-current` no ativo; nome aparece na barra de status
  (P0-3) e nos fluxos de salvar/abrir atuais

## Story 2.3: Ações do editor operando no documento ativo

Como usuário,
quero que copiar, exportar PDF/HTML e snapshots operem no documento ativo,
para que cada artefato seja tratado individualmente.

**Acceptance Criteria:** canônico em `AC-P2-10-3` (specs/spec-v2.md). Critérios de
implementação:

- Copy/Export PDF/Export HTML usam o conteúdo e o nome do documento ativo (ex.: título do
  HTML standalone, nome do arquivo no PDF), com nome de arquivo sanitizado para download
- snapshots locais preservam a origem (id/etiqueta)
- migração de snapshots legados sem origem: atribuir ao documento ativo ou manter em raiz
  "legado" — sem perda silenciosa

## Story 2.4: Persistência do documento corrente no boot

Como usuário,
quero reabrir o app e voltar ao conjunto de documentos da sessão anterior,
para que meu fluxo de trabalho não se perca entre sessões.

**Acceptance Criteria:** canônico em `AC-P2-10-4` (specs/spec-v2.md). Critérios de
implementação:

- boot com `documents.*` como fonte de verdade; `last_state`/`backup` legados continuam
  restaurando sessões de documento único (pré-P2)
- índice vazio/corrompido, id ativo órfão e conteúdo individual corrompido degradam com
  aviso i18n, sem crash (`safeGet`/`StorageError`)

---

## Notas de implementação (próximos passos, fora deste documento)

- Rodar o fluxo BMAD (`bmad-build`) por story, com qualidade gate verde e CHANGELOG sob
  `[Unreleased]`.
- Registrar o ADR da rota de PDF na Story 1.1 em `docs/explanation/architecture.md`.
- Atualizar `specs/sprint-status.yaml` conforme as stories avançam para `in-progress`/`done`.