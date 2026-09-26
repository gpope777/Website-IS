import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: { target: 'es2022' },
  // In dev, the client runs on Vite (5173) and the world server on `wrangler dev` (8787).
  server: {
    proxy: {
      '/ws': { target: 'ws://127.0.0.1:8787', ws: true },
      '/admin': 'http://127.0.0.1:8787',
    },
  },
});
