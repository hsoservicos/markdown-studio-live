import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          editor: ['monaco-editor'],
          mermaid: ['mermaid'],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
