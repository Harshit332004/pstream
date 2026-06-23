import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  server: {
    port: 5173,
    strictPort: false,
    // In dev, proxy /proxy/* and /sources/* to the local backend
    // so the frontend and API are same-origin even during development
    proxy: {
      '/proxy': 'http://localhost:3000',
      '/sources': 'http://localhost:3000',
      '/discover': 'http://localhost:3000',
      '/meta': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
      '/users': 'http://localhost:3000',
      '/sessions': 'http://localhost:3000',
      '/letterboxd': 'http://localhost:3000',
      '/lists': 'http://localhost:3000',
      '/metrics': 'http://localhost:3000',
      '/healthcheck': 'http://localhost:3000',
    },
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
}));
