# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

O próprio criador (usuário primário), em uso **pessoal e profissional**: escrever notas, rascunhos e artefatos Markdown — relatórios, documentos e materiais que serão impressos ou entregues. Uso individual, sem times.

## Product Purpose

Editor Markdown com preview em tempo real, 100% no navegador, sem backend e sem rastreadores. Evolui o fluxo do `tanabe/markdown-live-preview` para **operações com artefatos Markdown**: edição, inserção de imagens e formatação de saída para padrões de página de impressão (A4, margens, quebras), preservando todas as informações contidas no artefato aberto na área de texto, formatadas de acordo com a saída estabelecida.

## Positioning

Ferramenta local, segura e duradoura: escrever, ver o resultado instantaneamente e exportar em padrão de página, com os dados sempre na própria máquina — sem nuvem obrigatória, sem conta e sem rastreamento.

## Operating Context

- Escrita contínua com feedback imediato no preview (painel direito).
- Editor (Monaco) à esquerda, preview renderizado à direita.
- Persistência automática no `localStorage` (chaves `com.markdownstudio.*`), mesmo entre sessões.
- Copiar o conteúdo, exportar de acordo com padrão de página (A4/margens/quebras).
- Uso em desktop (fluxo principal, lado a lado) e mobile funcional (empilhamento/ajustes).
- Idioma padrão pt-BR, com suporte a en.

## Capabilities and Constraints

- Capacidades confirmadas (v1): editor+preview em tempo real; persistência local; reset com confirmação; tema claro/escuro com anti-FOUC; sync de scroll editor→preview; copiar via clipboard; exportação para impressão em padrão de página (A4/margens/quebras preservando o conteúdo); interface pt-BR por padrão.
- Capacidades adicionais implementadas (pós-v1.1.0): configuração de impressão (margem, papel A4/Letter, orientação, cabeçalho/rodapé com `{page}`); quebras de página conscientes (`<!-- page-break -->` + `break-inside: avoid`); barra de status com estatísticas (palavras/linhas/tempo de leitura); sumário (TOC) bidirecional; suporte a matemática KaTeX (`$...$`/`$$...$$`, sem CDN); copiar como HTML rico; exportar HTML standalone; snapshots locais com recuperação.
- Capacidades v1.2 (P2): PDF com texto vetorial pesquisável (pdfmake, feature-flag `com.markdownstudio.pdf.vector`, fallback transparente); múltiplos documentos com gerenciamento na sidebar (criar/renomear/alternar/fechar); boot com restauração e migração de dados legados.
- Restrições técnicas: 100% client-side (Monaco/marked/mermaid/DOMPurify/KaTeX/pdfmake via npm, sem CDN em runtime); HTML sempre passa por `DOMPurify.sanitize`; sem backend; sem rastreadores; dados apenas no navegador da máquina do usuário.
- Open decisions resolvidas: impressão (P0-1) e PDF vetorial (P2-9) fechadas. Decisão aberta: melhoria de performance com web workers para Mermaid/KaTeX.

## Brand Commitments

- Nome: **Markdown-Studio**.
- idioma padrão pt-BR.
- Sem rastreadores, sem coleta de dados.
- Sem dependência de serviços externos (CDN) para funcionar.

## Evidence on Hand

- Repo de referência (upstream): `tanabe/markdown-live-preview` — auditoria registrada como estudo base (ver `docs/explanation/primeira-intencao.md`).
- Implementação atual do Markdown-Studio publicada em `https://github.com/hsoservicos/markdown-studio-live` (branch `main`, tag `v1.2.0`).
- Progresso do projeto registrado em `CHANGELOG.md`, `specs/sprint-status.yaml` e `_bmad-output/verifications/` (análises BMAD pós-release).
- Features P2 (PDF vetorial + multi-documentos) completas e validadas (287 testes, 0 vulnerabilidades).
- Docker configurado com multi-stage build, scripts de gerenciamento e CI/CD automatizado.

## Product Principles

1. **Privacidade primeiro** — sem analytics, sem nuvem obrigatória, dados no `localStorage`.
2. **Funciona offline** — sem chamadas externas em runtime após o build.
3. **Segurança por padrão** — HTML sanitizado pelo DOMPurify antes do DOM.
4. **Testável e durável** — qualidade gate (`npm run quality`) antes de qualquer push.
5. **Fidelidade do artefato** — a saída (impressão/exportação) preserva todas as informações do conteúdo do artefato, adequando-se aos padrões de página estabelecidos.

## Accessibility & Inclusion

- Foco visível (anti-FOUC e `:focus-visible`), rótulos acessíveis nos controles, idioma pt-BR no documento.
