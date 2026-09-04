import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('monaco-editor')) {
            return 'editor';
          }
          if (id.includes('mermaid')) {
            return 'mermaid';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
