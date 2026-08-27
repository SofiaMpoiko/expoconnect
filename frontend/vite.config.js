import os from 'node:os';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const DEV_PORT = 5173;

/** First non-internal IPv4 address, for phone/LAN QR testing. */
function lanOrigin(port = DEV_PORT) {
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      const family = String(net.family);
      if ((family === 'IPv4' || family === '4') && !net.internal) {
        return `http://${net.address}:${port}`;
      }
    }
  }
  return '';
}

const DEV_LAN_ORIGIN = lanOrigin();

export default defineConfig({
  define: {
    __DEV_LAN_ORIGIN__: JSON.stringify(DEV_LAN_ORIGIN),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'cz-icon.png', 'carbon-zapp-text.png', 'carbon-zapp-logo.png', 'carbon-zapp-logo@2x.png'],
      manifest: {
        name: 'Carbon Zapp Leads',
        short_name: 'CZ Leads',
        description: 'Carbon Zapp exhibition lead capture',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/uploads'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'uploads-cache',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: DEV_PORT,
    proxy: {
      '/api': 'http://127.0.0.1:3001',
      '/uploads': 'http://127.0.0.1:3001',
    },
  },
  preview: {
    host: true,
    port: DEV_PORT,
  },
});
