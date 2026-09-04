# Epic 1 Context: PDF com texto vetorial pesquisável

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Substituir a rasterização atual (html2canvas → imagem) por um PDF com camada de texto real, permitindo Ctrl+F, seleção e acessibilidade — sem quebrar as features de impressão P0-1/P0-2 e sem introduzir CDN. O spike (Story 1.1) avalia as rotas candidatas e registra a decisão de arquitetura.

## Stories

- Story 1.1: Spike — avaliar a rota de PDF vetorial
- Story 1.2: Camada de layout vetorial (markdown → definição do documento)
- Story 1.3: Diagramas e matemática no PDF vetorial
- Story 1.4: Paridade de contrato e fallback

## Requirements & Constraints

- 100% client-side; nenhuma chamada externa em runtime (offline após build)
- Persistência apenas em `localStorage`
- Deps npm locais, sem CDN; dynamic import para não inchar o bundle inicial
- Quality gate verde (`npm run quality`) e testes na menor camada que capture a regressão
- Preservar features P0-1 (config de impressão) e P0-2 (quebras de página)
- Feature-flag `com.markdownstudio.pdf.vector` (default off) com detecção de suporte em runtime
- Fallback rasterizado atual permanece como default

## Technical Decisions

- O bundle atual já inclui `html2pdf.js` (935 kB) que usa html2canvas → rasteriza tudo
- Dynamic import já é usado para html2pdf.js (carregado sob demanda)
- Candidatos para rota vetorial: pdfmake, jsPDF com camada de texto, overlay de texto sobre PDF
- KaTeX hoje usa `output: 'html'`; rota vetorial pode precisar de `output: 'svg'`
- Mermaid SVG já está disponível no DOM após render; reutilizável sem re-renderização

## UX & Interaction Patterns

- Fluxo de export PDF permanece o mesmo (botão na sidebar → status no aria-live)
- Sucesso reporta `pdfExported`; falha reporta `pdfUnavailable`/`exportError`
- Sem prompt duplo (B5) — erros usam canal único de status

## Cross-Story Dependencies

- Story 1.1 (spike) alimenta ADR em `docs/explanation/architecture.md`
- Story 1.2 depende da decisão do spike (rota escolhida)
- Story 1.3 (mermaid/KaTeX) depende da Story 1.2
- Story 1.4 (fallback) fecha o contrato com testes unitários
