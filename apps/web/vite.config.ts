import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// portas configuráveis para rodar várias instâncias em paralelo (agentes do despachante; ver docs/AUTOMATION.md)
const webPort = Number(process.env.TABLEHUB_WEB_PORT ?? 5173);
const workerPort = Number(process.env.TABLEHUB_WORKER_PORT ?? 8787);

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'TableHub — jogos de mesa online',
        short_name: 'TableHub',
        description: 'Crie uma sala e jogue dominó, truco e Catan com os amigos.',
        lang: 'pt-BR',
        theme_color: '#1f6f54',
        background_color: '#f6f3ec',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // o jogo depende do servidor; cacheia só o "shell" do app
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/ws\//],
        // clique na notificação de vez (lib/turnAlert.ts)
        importScripts: ['sw-notify.js'],
      },
    }),
  ],
  server: {
    port: webPort,
    // porta ocupada é erro: nunca cair em outra porta e servir/testar o app de outra instância
    strictPort: true,
    proxy: {
      '/api': `http://127.0.0.1:${workerPort}`,
      '/ws': { target: `ws://127.0.0.1:${workerPort}`, ws: true },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
