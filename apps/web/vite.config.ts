import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@grok-bot/shared': path.resolve(repoRoot, 'packages/shared/src/index.ts'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 48731,
    allowedHosts: true,
    fs: { allow: [repoRoot] },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:48732',
        changeOrigin: true,
        timeout: 0,
        proxyTimeout: 0,
      },
      '/health': { target: 'http://127.0.0.1:48732', changeOrigin: true },
      '/screenshots': { target: 'http://127.0.0.1:48732', changeOrigin: true },
      '/uploads': { target: 'http://127.0.0.1:48732', changeOrigin: true },
    },
  },
});
