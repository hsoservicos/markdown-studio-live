# How-to: Usar o Impeccable no Markdown-Studio

Guia operacional para aplicar o **Impeccable** (design guidance para agentes de IA) no Markdown-Studio. Impeccable é o "design language" que dá julgamento de design a ferramentas de coding com IA — 1 skill, 23 comandos e um detector determinístico de anti-patterns de UI.

## O que foi instalado

- **Skill** instalado em `.opencode/skills/impeccable/` (escopo de projeto, provider opencode) via `npx impeccable install --providers=opencode --scope=project`.
- **Design system** registrado em `DESIGN.md` (formato oficial spec) + sidecar `.impeccable/design.json` (tokens/tons/componentes renderizáveis).
- **Produto** registrado em `PRODUCT.md` (verdade durável do produto — usuários, propósito, restrições).
- **Detector** acessível via `npx impeccable detect <arquivos|url>` — 59 regras determinísticas de anti-patterns.
- **Imports/excludes** em `.gitignore` (bloco `# impeccable-ignore-start`), `.prettierignore`, `eslint.config.mjs` e `.markdownlint-cli2.yaml` para o skill vendored e artefatos efêmeros.

## Design System: "The Quiet Studio"

O mundo visual escolhido para o Markdown-Studio (modo **Operate** — o usuário completa uma tarefa):

- **Flat e em camadas tonais** — sem sombras, sem cards; separação por hairline de 1px e mudança de tom.
- **Um acento restrito** (petrol teal `#0f766e` dark / `#2dd4bf`) usado só para ação, foco, seleção e estado.
- **Stack de fontes de sistema** (nunca Arial/Helvetica/Inter em primeiro).
- **Escala de tipo fixa em rem** (sem clamps no chrome da UI).
- **Estados completos** em todo interativo: default, hover, focus-visible, active, disabled.
- **Breakpoint 720px**: painéis empilham (estrutura responsiva, não tipografia fluida).

Ver `DESIGN.md` para tokens normativos e do's/don'ts; `.impeccable/design.json` para tons e componentes.

## Como rodar o detector

```bash
npx impeccable detect index.html public/css/style.css src/ui/divider.js
npx impeccable detect --json .        # CI-friendly
npx impeccable detect https://...     # scan em browser (Puppeteer)
```

O detector lê `DESIGN.md` e `.impeccable/design.json` automaticamente (config local em `.impeccable/`). Disparar após **qualquer** mudança de UI editável.

### Waivers (inline)

Quando um achado é legítimo (ex.: o detector não resolve `var()`, ou CSS vendored de terceiros tem paleta própria), marque com comentário inline no arquivo:

```html
<!-- impeccable-disable design-system-color: wordmark usa token via CSS var -->
```

## Fluxo de trabalho (checklist pré-UI)

1. **Init** — `PRODUCT.md` existe (já registrado). Qualquer mudança grande de produto atualiza-o antes.
2. **Contexto** — `node .opencode/skills/impeccable/scripts/context.mjs --target <rota>` para diretivas.
3. **Mundo visual** — `DESIGN.md` é a fonte normativa; mudanças visuais só fora dele com aprovação explícita.
4. **Craft floor** — ler `reference/craft-floor.md` antes de editar UI (contraste, depth, spacing, type, motion, states).
5. **Aplicar** — tokens via CSS custom properties (`--color-*`, `--font-ui`, etc.).
6. **Validar** — `npm run quality` + `npx impeccable detect` no que tocou.

## Erros comuns já resolvidos

| Sintoma                                                             | Causa                                 | Solução                                                                              |
| ------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| `overused-font` (Helvetica/Arial)                                   | font stack legada do upstream         | trocar por stack de sistema (`--font-ui`); Helvetica/Arial/Inter banidos em primeiro |
| `design-system-color` no wordmark                                   | detector não resolve `var()` estático | waiver inline no `index.html`                                                        |
| `design-system-font-size` 12px                                      | `font-size: 12px` fora do ramp        | usar passo `1rem` do ramp do DESIGN.md                                               |
| prettier/eslint/markdownlint varrendo `.opencode/` e `.impeccable/` | skill vendored                        | excludes em `.prettierignore`, `eslint.config.mjs` e `.markdownlint-cli2.yaml`       |

## Comandos úteis (via `/impeccable <cmd>` no agente)

`audit` (a11y/perf/responsivo), `polish` (pass final de produção), `distill` (remover complexidade), `critique` (revisão UX), `typeset` (tipografia), `layout` (espaçamento/ritmo), `harden` (erros/i18n/edge cases), `adapt` (dispositivos), `optimize` (performance). Comando sem argumento mostra o menu.

## Limites e mantimento

- Não editar arquivos dentro de `.opencode/skills/impeccable/` (vendored). Atualizações: `npx impeccable update`.
- `PRODUCT.md` e `DESIGN.md` são artefatos compartilhados e **vão para o git**; `.impeccable/*.png`, `config.local.json` e sessões `live/` não (ver `.gitignore`).
- Re-rodar `/impeccable document` para reextrair tokens reais do código conforme o build evolui.
