# Primeira Intenção — Markdown-Studio

> Documento fundacional. Registra a **intenção original** por trás da criação do Markdown-Studio.
> Criado: 2026-08-18.

## A ideia original

A primeira intenção do Markdown-Studio é oferecer um **editor Markdown com preview em tempo real**, 100% no navegador, sem backend, sem contas e sem rastreadores — para uso **pessoal e profissional**.

Ferramenta pequena, confiável e duradoura: escrever, ver o resultado instantaneamente, copiar e exportar — com os dados sempre na própria máquina do usuário.

## Por que nascer

O projeto **não começa do zero**: parte da reconstrução do `tanabe/markdown-live-preview`, uma ferramenta excelente mas limitada nos seguintes pontos que inspiraram a criação de uma versão própria:

- dependências em CDN instáveis (Monaco, html2pdf) e rastreador do Google embutido;
- código concentrado em um único `main.js` de 672 linhas, sem testes;
- sem testes, sem gate de qualidade, sem estrutura para evoluir;
- interface apenas em inglês.

Markdown-Studio **re-constrói** esse legado com engenharia:

- **testável** (Vitest) e com funções puras isoladas;
- **100% local** (Monaco/marked/mermaid/DOMPurify via npm, sem CDN em runtime);
- **sem rastreamento**;
- **pt-BR** por padrão;
- **governada pela metodologia BMAD** (Conventional Commits, qualidade gate, docs Diataxis, spec com ACs).

## O que a primeira intenção promete (princípios)

1. **Privacidade primeiro** — sem analytics, sem nuvem obrigatória, dados no `localStorage` do usuário.
2. **Funciona offline** — após o build, nenhuma chamada externa em runtime.
3. **Segurança por padrão** — todo HTML passa por `DOMPurify.sanitize` antes de entrar no DOM.
4. **Testável e durável** — cada feature nasce com teste Vitest; o `npm run quality` é o portão antes de qualquer push.
5. **Simplicidade intencional** — escopo claro no v1 (editor, preview, persistência, tema, scroll sync, copy, export PDF), sem "feature creep".
6. **Uso pessoal e profissional** — a ferramenta é para o próprio criador, mas construída com padrões de software profissional.

## Não-intenções (para não nos perdermos)

- Não é um sistema colaborativo (sem multiusuário, sem backend).
- Não é uma plataforma de CMS.
- Não rastreia usuários.
- Não depende de serviços externos para funcionar.

## Linha do tempo do nascimento (até o momento)

| Passo                                         | Data           | Resultado                                               |
| --------------------------------------------- | -------------- | ------------------------------------------------------- |
| Auditoria do upstream `markdown-live-preview` | 18/08/2026     | Artefato de auditoria completo                          |
| Verificação de requisitos/ambiente            | 18/08/2026     | Node 24 ok, rede ok, build/install validados            |
| Exploração da organização BMAD                | 18/08/2026     | 15 repos clonados p/ consulta                           |
| Plano de re-edição guiado por BMAD            | 18/08/2026     | Roadmap Fase 0–3                                        |
| **Nascimento do Markdown-Studio**             | **18/08/2026** | Scaffold BMAD completo em `D:\projetos\Markdown-Studio` |

## Signatário

Esta é a primeira intenção registrada do projeto, e o compromisso que guia cada decisão a partir de agora: **uma ferramenta própria, local, segura, testável e profissional** para escrever e apresentar Markdown.

_Voltar a este documento sempre que uma decisão ameaçar fugir dos princípios acima._
