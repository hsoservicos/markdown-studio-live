---
title: Markdown-Studio
created: 2026-08-18
updated: 2026-08-18
---

# PRD: Markdown-Studio

## 0. Document Purpose

Este PRD define o Markdown-Studio para o próprio autor (projeto pessoal/profissional) e para os agentes/flowdownstream que evoluirão o produto. Estrutura: vocabulário ancorado no Glossário, features agrupadas com FRs aninhadas, suposições marcadas inline. Ele não duplica `docs/` — qualquer implementação consulta `docs/reference/` e `docs/explanation/`.

## 1. Vision

Markdown-Studio é um editor Markdown com preview em tempo real, 100% no navegador, sem backend e sem rastreadores. Reconstrói o fluxo do `tanabe/markdown-live-preview` com arquitetura testável, sem dependências CDN instáveis, interface em português e foco em privacidade e acessibilidade. Vai de "escrever e ver" a "escrever, ver, exportar e levar consigo".

## 2. Target User

### 2.1 Jobs To Be Done

- Escrever notas e rascunhos em Markdown e ver o resultado instantaneamente (funcional).
- Manter dados localmente, sem conta nem nuvem (emocional — privacidade).
- Produzir artefatos (PDF/render) para trabalho (funcional/profissional).
- Aprender Markdown com feedback imediato (funcional/educacional).

### 2.2 Non-Users (v1)

- Times colaborativos (sem multiusuário).
- Corporações que exigem SSO/backup central (sem backend).

### 2.3 Key User Journeys

- **UJ-1. Brenda escreve uma nota de reunião e copia o resultado.**
  - Persona: profissional em reuniões, sem conta.
  - Entry: abre o app local, editor + preview já carregados com template pt-BR.
  - Path: digita tópicos → vê o preview atualizar → clica Copy.
  - Climax: `navigator.clipboard` devolve todo o Markdown.
  - Resolution: pasta no e-mail; app mantém o conteúdo salvo no localStorage.
  - Edge case: negativa ao clipboard → nada acontece silenciosamente (fallback).

- **UJ-2. Brenda exporta a nota para PDF.**
  - Path: clica Export PDF → html2pdf gera A4 → download.
  - Climax: arquivo `markdown-preview.pdf` abre correto.
  - Edge case: CSS muito moderno no preview → aviso "não disponível ainda".

## 3. Glossary

- **Markdown** — linguagem de marcação leve; vocabulário-chave do produto.
- **Preview** — painel direito renderizado do conteúdo.
- **Editor** — painel esquerdo (Monaco).
- **Sync Scroll** — alinhamento de rolagem editor→preview.
- **Tema** — claro/escuro, persistido.
- **Reset** — restaura template padrão (com confirmação se editado).
- **Render API** — `src/render/convert()` (fronteira entre pipeline e UI).
- **FR** — Functional Requirement.
- **AC** — Acceptance Criteria (Given/When/Then).

## 4. Features

### 4.1 Editor + Preview em tempo real

**Description:** dois painéis lado a lado, redimensionáveis; qualquer tecla no editor atualiza o preview via `convert()`. Realiza UJ-1, UJ-2.

**Functional Requirements:**

#### FR-1: Renderização ao digitar

O usuário pode editar o Markdown no editor e ver o preview atualizado a cada mudança de conteúdo.

**Consequences (testable):**

- Sistema atualiza `#output.innerHTML` após qualquer `onDidChangeModelContent`.
- HTML de saída passa por `DOMPurify.sanitize` antes da injeção.
- Blocos `mermaid` viram `<pre class="mermaid">` e renderizam com debounce ≤ 300 ms.

#### FR-2: Persistência automática

O conteúdo é salvo no `localStorage` a cada alteração (com debounce).

**Consequences (testable):**

- Após recarregar a página, o último conteúdo é restaurado.
- Chave `com.markdownstudio.last_state` contém o Markdown salvo.

#### FR-3: Reset com confirmação

Reset restaura o template padrão; se o conteúdo foi editado, confirma antes.

**Out of Scope:**

- Undo/redo do reset.

### 4.2 Tema claro/escuro com anti-FOUC

**Description:** checkbox Dark mode; botão de boot no `<head>` lê o tema antes do paint. Realiza UJ-1.

**FR-4: Troca de tema persistida**

- Troca `data-theme` no `<html>`, `monaco.editor.setTheme('vs'/'vs-dark')`, CSS do preview e re-render de mermaid.
- Persistido em `theme_settings` e espelho `com.markdownstudio_theme`.

### 4.3 Sync de scroll (editor → preview)

**FR-5: Sync proporcional**

- Quando ativo, `onDidScrollChange` mapeia `scrollTop/scrollHeight` para o preview por proporção.

### 4.4 Copy e Export PDF

**FR-6: Copy** — copia todo o conteúdo atual via `navigator.clipboard`; feedback "Copiado!" temporário.
**FR-7: Export PDF** — baixa `#preview-wrapper` como PDF A4 retrato (`markdown-preview.pdf`) via `html2pdf.js` (npm dep, dynamic import, sem CDN); força tema light e `190mm` no clone. Sucesso reporta "PDF exportado!" no rodapé; indisponibilidade da lib alerta "não disponível" e erro de save reporta falha no rodapé (tema Mermaid dark restaurado ao final).

## 5. Non-Goals (v1)

- Autenticação, backend, multiusuário, sincronização remota.
- Rastreamento/analytics.
- Integrações externas (Google Files, etc.).
- Plugin-módulo BMAD no v1 (viável depois).

## 6. Acceptance Summary

- Toda FR tem AC Given/When/Then na `specs/spec-v1.md`.
- `npm run quality` verde em cada release.

## 7. Reference Links

- Spec: `specs/spec-v1.md`
- Arquitetura: `docs/explanation/architecture.md`
- Tutorial: `docs/tutorials/getting-started.md`
