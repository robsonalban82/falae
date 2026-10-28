import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
        browserName: 'chromium',
      },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  // Production build (with the service worker) so offline/PWA behaviour is real.
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    env: { VITE_E2E: '1', VITE_DEMO: '1' },
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
