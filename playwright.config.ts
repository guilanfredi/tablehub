import { defineConfig, devices } from '@playwright/test';

/**
 * Testes ponta a ponta no navegador. Por padrão compilam o app e sobem só o worker (`wrangler dev`), que
 * serve o build e a API como em produção: o app pronto carrega rápido, sem a compilação sob demanda do
 * `vite dev`, que estourava o tempo do primeiro teste com a máquina ocupada. Com BASE_URL apontam para outro
 * ambiente (ex.: preview de PR). A suíte completa roda no CI (job `e2e` do pr.yml), dividida em partes.
 */
const workerPort = process.env.TABLEHUB_WORKER_PORT ?? '8787';
const baseURL = process.env.BASE_URL ?? `http://localhost:${workerPort}`;
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // fixo: vários agentes rodam testes na mesma máquina
  workers: 2,
  // no CI, uma nova tentativa separa teste instável de quebra real (o relatório marca "flaky")
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['list']] : [['list']],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        // TABLEHUB_E2E: build sem service worker, como no `vite dev`
        command: 'npm run build && npm run dev -w @tablehub/worker',
        env: { TABLEHUB_E2E: '1' },
        url: `${baseURL}/api/health`,
        // nunca reaproveitar: um servidor já rodando ali teria outro build (ou seria de outra instância)
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
