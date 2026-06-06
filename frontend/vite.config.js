import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
