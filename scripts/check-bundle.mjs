#!/usr/bin/env node
/**
 * H4: guarda de composição do bundle.
 *
 * O mermaid (~5 MB, 1,4 MB gzip) precisa continuar FORA do caminho crítico de
 * boot: o import é dinâmico (`src/render/mermaid.js`) e o Vite o emite como
 * chunk lazy. Uma regressão que puxasse a lib de volta para o entry — um
 * `manualChunks` infeliz, um import estático esquecido — voltaria verde no
 * quality gate e puniria todo primeiro load em rede lenta (exatamente o
 * incidente registrado no comentário do `vite.config.js`).
 *
 * Roda depois do `npm run build` (encadeado no `npm run quality`).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = resolve(root, 'dist');
const assets = readdirSync(resolve(dist, 'assets'));

const mermaidChunks = assets.filter((f) => f.includes('mermaid'));
if (mermaidChunks.length === 0) {
  console.error('✗ chunk lazy do mermaid ausente em dist/assets/ — o import dinâmico regrediu?');
  process.exit(1);
}

const indexHtml = readFileSync(resolve(dist, 'index.html'), 'utf8');
const entryFiles = [...indexHtml.matchAll(/src="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
if (entryFiles.length === 0) {
  console.error('✗ nenhum script de entrada encontrado em dist/index.html');
  process.exit(1);
}

// Marcadores de CÓDIGO que só existem dentro do bundle do mermaid. O nome do
// chunk ('mermaid.core') aparece legítimamente no entry como referência do
// import dinâmico — não serve como marcador.
const MARKERS = ['flowchart-v2', 'graphlib'];
for (const file of entryFiles) {
  const content = readFileSync(resolve(dist, file), 'utf8');
  for (const marker of MARKERS) {
    if (content.includes(marker)) {
      console.error(`✗ ${file} contém o marcador '${marker}' — o mermaid vazou para o entry`);
      process.exit(1);
    }
  }
}

console.log(
  `✓ bundle ok: ${entryFiles.length} entrada(s) sem mermaid; chunks lazy: ${mermaidChunks.join(', ')}`,
);
