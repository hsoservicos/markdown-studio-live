# Tutorial: Primeiros passos com o Markdown-Studio

Objetivo: executar a aplicação pela primeira vez, entender a tela e o comportamento de um recurso básico — tudo validado com testes locais.

## Pré-requisitos

| Requisito | Versão                       | Verificação      |
| --------- | ---------------------------- | ---------------- |
| Node.js   | ≥ 20.12 (22 LTS recomendada) | `node --version` |
| npm       | ≥ 10                         | `npm --version`  |
| Git       | qualquer recente             | `git --version`  |

## Passo 1 — Instalar dependências

```bash
npm ci
```

## Passo 2 — Rodar o dev server

```bash
npm run dev
```

Abra `http://localhost:5173/`. Deve aparecer o editor com o **template padrão em pt-BR** à esquerda e o preview renderizado à direita.

## Passo 3 — Digite algum Markdown

No painel esquerdo (Monaco), overwrite o template ou adicione:

```markdown
# Título

**negrito** e _itálico_.

- item 1
- item 2

> citação

| A   | B   |
| --- | --- |
| 1   | 2   |
```

O preview atualiza a cada tecla (renderização síncrona + diagramas com debounce de 150 ms).

## Passo 4 — Teste os recursos da barra

| Controle    | O que faz                                                       |
| ----------- | --------------------------------------------------------------- |
| Reset       | Restaura o template padrão (confirma se você editou o conteúdo) |
| Copy        | Copia todo o Markdown atual para a área de transferência        |
| Export PDF  | Baixa o preview como PDF (recomendado em docs curtas)           |
| Sync scroll | Sincroniza a rolagem do editor com o preview                    |
| Dark mode   | Alterna tema claro/escuro (persistido)                          |

## Passo 5 — Rode os testes

```bash
npm test       # suíte unitária (Vitest)
npm run quality  # gate completo: format+lint+test
```

## Próximos passos

- Veja como **planejar e executar** uma alteração: `docs/how-to/re-edit-overview.md`.
- Entenda o **porquê** da arquitetura: `docs/explanation/architecture.md`.
- Consulte a **API** de `convert()` e o **contrato de storage**: `docs/reference/`.
