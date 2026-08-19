# Markdown-Studio

Editor Markdown com preview em tempo real — projeto pessoal e profissional, reconstruído a partir do `tanabe/markdown-live-preview` sob a metodologia **BMAD**.

## Objetivo

- Re-criar o editor com arquitetura testável, sem dependências CDN instáveis nem rastreadores.
- Interface em pt-BR, acessível, com tema claro/escuro.
- Persistência local via `localStorage` (sem backend), deploy estático.

## Stack

- **Build**: Vite 6 + Vitest
- **Editor**: Monaco Editor 0.52 (bundlado local)
- **Markdown**: marked 15 + DOMPurify
- **Diagrams**: Mermaid 11
- **Estilos de conteúdo**: github-markdown-css
- **Sem backend**; deploy estático (Firebase Hosting / GitHub Pages)

## Comandos principais

| Ação                 | Comando                                       |
| -------------------- | --------------------------------------------- |
| Instalar             | `npm ci`                                      |
| Dev server           | `npm run dev` (porta 5173)                    |
| Testes               | `npm test` (Vitest) / `npm run test:watch`    |
| Build                | `npm run build`                               |
| Qualidade (pre-push) | `npm run quality`                             |
| Lint JS              | `npm run lint`                                |
| Lint Markdown        | `npm run lint:md`                             |
| Formatar             | `npm run format:check` / `npm run format:fix` |
| Preview do build     | `npm run preview`                             |
| Serve do dist        | `npm run serve-dist` (porta 5001)             |

## Estrutura

```
text
Markdown-Studio/
├── docs/            # Documentação diataxis (tutorial, how-to, explanation, reference)
├── specs/           # PRD, spec (ACs Given/When/Then), RFCs
├── src/             # Código-fonte (main.js, storage, render, i18n, ui)
├── public/          # Recursos estáticos (css, images)
├── tests/           # Vitest (unit + fixtures)
├── tools/           # Utilitários de build e validação
├── scripts/         # Scripts de automação do desenv
├── website/         # (futuro) site de documentação
├── AGENTS.md        # Regras para agentes de IA
├── package.json
├── .nvmrc           # Node 22 (LTS)
└── CHANGELOG.md     # Keep a Changelog modificado
```

## Convenções

- **Commits**: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`).
- **CHANGELOG**: padrão Keep a Changelog modificado (subseções Added/Changed/Deprecated/Removed/Fixed/Security sob `## [Unreleased]`).
- **Qualidade obrigatória**: `npm run quality` deve passar antes de cada push.
- **Testes**: cada feature nova acompanha teste Vitest na menor camada que o catch uma regressão.

## Licença

ISC (herdada do projeto original) — para uso pessoal e profissional.

_Este projeto é uma reconstrução independente; o código original é de `tanabe/markdown-live-preview` (ISC)._
