import { defineConfig } from 'vite';

// Sem `build.rollupOptions.output.manualChunks`: no Vite 8 o bundler é o
// Rolldown, que faz o code-splitting sozinho a partir do grafo real de imports.
// Um manualChunks por substring (`id.includes('mermaid')`) casava também com
// `src/render/mermaid.js` — importado estaticamente pelo main.js — e religava
// os ~5 MB da lib ao entry, derrotando o `import('mermaid')` lazy.
export default defineConfig({
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
  },
  server: {
    port: 5173,
    open: false,
  },
});
