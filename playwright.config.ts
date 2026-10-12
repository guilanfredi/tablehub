import { defineConfig, devices } from '@playwright/test';

/**
 * Testes ponta a ponta no navegador. Por padrão sobem o app local (`npm run dev`);
 * com BASE_URL apontam para outro ambiente (ex.: preview de PR).
 */
const webPort = process.env.TABLEHUB_WEB_PORT ?? '5173';
const baseURL = process.env.BASE_URL ?? `http://localhost:${webPort}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: `http://localhost:${webPort}`,
        // com porta própria (agentes em paralelo), nunca reaproveitar: um servidor ali seria de outra instância
        reuseExistingServer: !process.env.TABLEHUB_WEB_PORT,
        timeout: 120_000,
      },
});
