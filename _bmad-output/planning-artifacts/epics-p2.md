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

As a developer,
I want to avaliar tecnicamente a melhor rota (pdfmake/jsPDF-text vs camada de texto sobre
layout atual vs renderer dedicado),
So that a decisão de arquitetura seja baseada em evidência e caiba nas restrições offline.

**Acceptance Criteria:**

- **Given** as features P0-1/P0-2 (config de impressão + quebras) e o layout HTML atual
- **When** eu pesquiso e prototipo as rotas candidatas (pdfmake, jsPDF.text, overlay de
  texto sobre o PDF atual)
- **Then** o resultado documenta, para cada rota: fidelidade do layout, suporte a
  tabelas/mermaid/KaTeX, custo de migração e tamanho de bundle
- **And** a rota escolhida é registrada em `docs/explanation/architecture.md` (decisão ADR)
  sem exigir CDN ou backend

## Story 1.2: Camada de layout vetorial (markdown → definição do documento)

As a user,
I want a saída PDF cujos títulos, parágrafos, listas e tabelas sejam texto real,
So that eu possa selecionar e buscar conteúdo no PDF exportado.

**Acceptance Criteria:**

- **Given** um documento Markdown renderizado no preview
- **When** o export produz o PDF
- **Then** títulos, parágrafos, listas e tabelas aparecem como texto vetorial pesquisável
- **And** `Ctrl+F` e seleção de texto funcionam no leitor de PDF
- **And** a configuração de impressão (margem, papel, orientação, cabeçalho/rodapé com
  `{page}`) continua valendo

## Story 1.3: Diagramas e matemática no PDF vetorial

As a user,
I want os diagramas Mermaid e as fórmulas KaTeX preservados no PDF,
So that o artefato exportado não perca conteúdo não-textual.

**Acceptance Criteria:**

- **Given** documento com blocos `mermaid` e fórmulas `$…$`/`$$…$$`
- **When** o PDF vetorial é gerado
- **Then** diagramas e fórmulas aparecem no PDF (como SVG/imagem embutida de alta
  resolução, se a rota não os suportar como texto)
- **And** quebras de página conscientes (P0-2) continuam respeitadas

## Story 1.4: Paridade de contrato e fallback

As a user,
I want que o fluxo degrade com clareza quando o navegador/lib não suportar a rota nova,
So that nenhuma regressão silencie o erro.

**Acceptance Criteria:**

- **Given** a lib de PDF vetorial indisponível ou falha na geração
- **When** o usuário clica em Exportar PDF
- **Then** o status reporta `pdfUnavailable`/`exportError` no canal `aria-live` (sem prompt
  duplo — B5)
- **And** o fallback rasterizado atual permanece disponível até a rota nova ser estável
- **And** testes unitários cobrem sucesso e erro (mock da lib, sem rede)

---

# Epic 2: Múltiplos documentos locais (P2-10)

**Objetivo:** permitir abrir/criar/alternar entre vários artefatos Markdown na mesma sessão,
todos persistidos localmente com a mesma privacidade, sem colidir com os contratos atuais.

## Story 2.1: Índice de documentos no storage

As a user,
I want que cada documento tenha identidade e conteúdo próprios no localStorage,
So that abrir outro documento não destrua o rascunho atual.

**Acceptance Criteria:**

- **Given** um documento ativo com conteúdo editado
- **When** um segundo documento é criado/aberto
- **Then** cada um persiste sob `com.markdownstudio.documents.*` (índice + conteúdos), com o
  contrato de storage tipado (validação/`StorageError`/`safeGet`)
- **And** `last_state`/`backup` existentes continuam funcionando (compatibilidade)

## Story 2.2: Gerenciador de documentos (`src/ui/documents.js`)

As a user,
I want uma lista/abas de documentos para criar, renomear, alternar e fechar,
So that eu organize vários artefatos sem sair do editor.

**Acceptance Criteria:**

- **Given** o editor aberto com a sidebar
- **When** eu uso a ação de documentos (novo/abrir/alternar/fechar)
- **Then** a UI reflete o documento ativo e persiste o estado (documento corrente) no storage
- **And** confirmação protege conteúdo não salvo ao fechar/descartar (padrão
  `newFileConfirm`)
- **And** o nome do arquivo aparece na barra de status (P0-3) e no fluxo de salvar/abrir
  atual

## Story 2.3: Ações do editor operando no documento ativo

As a user,
I want que copiar, exportar PDF/HTML e snapshots operem no documento ativo,
So that cada artefato seja tratado individualmente.

**Acceptance Criteria:**

- **Given** múltiplos documentos abertos
- **When** eu disparo Copy/Export PDF/Export HTML/Snapshots
- **Then** a ação usa o conteúdo e o nome do documento ativo (ex.: título do HTML standalone,
  nome do arquivo no PDF)
- **And** snapshots locais preservam o documento de origem (id/etiqueta)

## Story 2.4: Persistência do documento corrente no boot

As a user,
I want reabrir o app e voltar ao conjunto de documentos da sessão anterior,
So that meu fluxo de trabalho não se perde entre sessões.

**Acceptance Criteria:**

- **Given** documentos abertos e um documento ativo
- **When** a página recarrega
- **Then** o app restaura a lista e reabre o documento ativo (com fallback ao template do
  idioma corrente se o índice estiver vazio/corrompido)
- **And** o comportamento em storage corrompido degrada para o padrão sem crash
  (`safeGet`/`StorageError`)

---

## Notas de implementação (próximos passos, fora deste documento)

- Atualizar `specs/prd.md` (glossário/capabilities) e `specs/spec-v2.md` (ACs
  Given/When/Then) quando o escopo for aprovado.
- Rodar o fluxo BMAD (`bmad-build`) por story, com qualidade gate verde e CHANGELOG sob
  `[Unreleased]`.
