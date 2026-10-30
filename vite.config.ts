import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Public base path: '/' locally and in E2E; '/<repo>/' on GitHub Pages (set by the deploy workflow).
const base = process.env.VITE_BASE ?? '/';

/** GitHub Pages has no SPA rewrites: serve index.html for unknown paths via 404.html. */
function spaFallback404(): Plugin {
  let outDir = 'dist';
  return {
    name: 'falae-spa-404',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const index = join(outDir, 'index.html');
      if (existsSync(index)) copyFileSync(index, join(outDir, '404.html'));
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    react(),
    spaFallback404(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Falaê — inglês todo dia',
        short_name: 'Falaê',
        description: 'Aprenda inglês em poucos minutos por dia, do jeito brasileiro.',
        lang: 'pt-BR',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFF8EF',
        theme_color: '#FF8A1F',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/\/404\.html$/],
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Vendors in their own long-cached chunks (ADR-012 / Phase 7 bundle budget).
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'router', test: /node_modules[\\/]react-router[\\/]/ },
            {
              name: 'motion',
              test: /node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/,
            },
            { name: 'dexie', test: /node_modules[\\/]dexie[\\/]/ },
            { name: 'zod', test: /node_modules[\\/]zod[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    css: false,
    // Fixed zone with DST so day-boundary tests are meaningful on any machine.
    env: { TZ: 'America/New_York' },
  },
});
