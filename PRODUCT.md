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
- Restrições técnicas: 100% client-side (Monaco/marked/mermaid/DOMPurify via npm, sem CDN em runtime); HTML sempre passa por `DOMPurify.sanitize`; sem backend; sem rastreadores; dados apenas no navegador da máquina do usuário.
- Open decision: detalhes finais de paginação/impressão (margens exatas, cabeçalho/rodapé de página) — registrados a partir da entrevista inicial como "documento paginado A4".

## Brand Commitments

- Nome: **Markdown-Studio**.
- idioma padrão pt-BR.
- Sem rastreadores, sem coleta de dados.
- Sem dependência de serviços externos (CDN) para funcionar.

## Evidence on Hand

- Repo de referência (upstream): `tanabe/markdown-live-preview` — auditoria registrada em `D:\curso ia\estudo\Auditoria-Analise-Markdown-Live-Preview.md`.
- Artefatos de estudo: `D:\curso ia\estudo\` (necessidades/aplicações/ferramentas, plano de re-edição BMAD).
- Implementação atual do Markdown-Studio em `D:\projetos\Markdown-Studio` (scaffold BMAD completo, testes Vitest passando).

## Product Principles

1. **Privacidade primeiro** — sem analytics, sem nuvem obrigatória, dados no `localStorage`.
2. **Funciona offline** — sem chamadas externas em runtime após o build.
3. **Segurança por padrão** — HTML sanitizado pelo DOMPurify antes do DOM.
4. **Testável e durável** — qualidade gate (`npm run quality`) antes de qualquer push.
5. **Fidelidade do artefato** — a saída (impressão/exportação) preserva todas as informações do conteúdo do artefato, adequando-se aos padrões de página estabelecidos.

## Accessibility & Inclusion

- Foco visível (anti-FOUC e `:focus-visible`), rótulos acessíveis nos controles, idioma pt-BR no documento.
