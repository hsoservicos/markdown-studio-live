# Análise BMAD — Markdown-Studio v1.1.0 (2026-08-19)

Verify/Analyse conduzido após release v1.1.0, com módulo **BMAD Method (bmm) v6.11.0**,
tool opencode. Método: revisão adversarial em camadas paralelas
(`bmad-code-review` step-architecture) — código, testes e produto.

## Achados (triagem)

| ID | Sev | Onde | Problema | Ação |
| -- | --- | ---- | -------- | ---- |
| A1 | Alta | `src/render/mermaid.js:40-67` | `render()` não reentrante: nova passagem pode rodar concorrente com a em voo (apenas version-guard, sem single-flight) → erro intermitente em digitação rápida/export | Single-flight da promise do render |
| A2 | Alta | `src/main.js:109-122,239-243` | "Redefinir" não remove `last_state`: reload restaura o rascunho antigo (semântica de reset quebrada) | `removeItem(last_state)` no reset |
| A3 | Alta | `.prettierignore`/`.markdownlint-cli2.yaml` | **JÁ CORRIGIDO**: `.agents/`, `_bmad/` e `snapshot` quebravam o quality gate (187 files) | Ignorets adicionados; gate verde |
| M1 | Média | `src/ui/exportPdf.js:58-71` | Race entre o re-render default (claro) e o debounce do tema escuro durante o `save()` do html2pdf | Estado "capturando" cancela debounce do mermaid |
| M2 | Média | `src/main.js:64-89` | `convertAndRender` síncrono a cada tecla + recria nós `.mermaid` (jank em docs longas) | Debounce ~60-100ms mantendo save em 300ms |
| M3 | Média | `index.html:13-35` vs `main.js:185-251` | Boot key do tema diverge da persistência (`theme_settings` vs `_theme`); anti-FOUC pode falhar em storage legado | Re-sincronizar boot key no init |
| M4 | Média | `src/storage.js:19-44` | `getItem` sem validação de tipo na fronteira; `last_state` corrompido restaura em silêncio | Validar schema e lançar `StorageError` |
| B1–B5 | Baixa | divider/files/sidebar | Acessibilidade do divisor, aria-label estático, perfil DOMPurify p/ recursos externos, input picker, duplo prompt em erro | Refinamentos |

Positivos confirmados: nenhum XSS na cadeia `marked → DOMPurify`; mermaid em
`securityLevel:'strict'`; botões semânticos; `aria-live`; i18n com fallback segura.

## Lacunas de teste (prioridade)

1. Boot/`applyI18n`/restauração (`main.js:20-46,236-258`) — AC-2/AC-4 sem teste.
2. Mermaid: `scheduleMermaidRender` e guard de versão com 0 cobertura.
3. `setupDivider` (`src/ui/divider.js`) — arquivo com 0%.
4. Sanitização do conteúdo ` ```mermaid ` (`convert.js:44`, escapeHtml) sem teste.
5. Fallbacks de arquivo Safari/Firefox (`files.js`, `fileInputPicker`, erro createWritable).

Risco de falso positivo: mock de `html2pdf.js` (vi.hoisted) valida só ordem/args;
coberto na prática pelo probe e2e `pdf_probe.js` (header `%PDF-` real).

## Propostas de novas features

Ver `features-proposals.md` no mesmo diretório (P0: configuração de página, quebras
conscientes, estatísticas, TOC, KaTeX — todas usam o que já existe no repo; v2: PDF
vetorial, múltiplos documentos, snapshots locais).