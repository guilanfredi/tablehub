import { expect, type Browser, type Page } from '@playwright/test';

/**
 * Cada jogador é um contexto de navegador isolado (localStorage próprio = identidade própria).
 * Herda o dispositivo do projeto (desktop/mobile) em execução.
 */
export async function newPlayer(browser: Browser, name: string, contextOptions: Parameters<Browser['newContext']>[0] = {}): Promise<Page> {
  const ctx = await browser.newContext(contextOptions);
  const page = await ctx.newPage();
  await page.addInitScript((n) => localStorage.setItem('th:name', n), name);
  return page;
}

/** Cria uma sala pela tela inicial e devolve o código. */
export async function createRoom(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir uma mesa' }).click();
  await page.waitForURL(/\/sala\/[A-Z0-9]{5}/);
  const code = page.url().match(/\/sala\/([A-Z0-9]{5})/)![1];
  await expect(page.getByText(code, { exact: false }).first()).toBeVisible();
  // só depois de entrar na sala (o "Conectando à sala…" também mostra o código): garante que o criador é o dono
  await expect(page.getByRole('heading', { name: /Jogadores/ })).toBeVisible();
  return code;
}

export async function joinRoom(page: Page, code: string): Promise<void> {
  await page.goto(`/sala/${code}`);
  await expect(page.getByRole('heading', { name: /Jogadores/ })).toBeVisible();
}

export async function chooseGame(owner: Page, gameName: string): Promise<void> {
  await owner.getByRole('button', { name: new RegExp(gameName) }).click();
  await expect(owner.getByRole('heading', { name: 'Regras desta partida' })).toBeVisible();
}

export async function setReady(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Estou pronto' }).click();
  await expect(page.getByRole('button', { name: 'Não estou pronto' })).toBeVisible();
}

export async function startGame(owner: Page): Promise<void> {
  const start = owner.getByRole('button', { name: 'Iniciar partida' });
  await expect(start).toBeEnabled();
  await start.click();
  await expect(owner.locator('.status-pill')).toBeVisible();
}

/** Página do jogador cuja vez é agora (status "Sua vez!" ou que pede ação). */
export async function whoseTurn(pages: Page[]): Promise<Page> {
  for (let i = 0; i < 20; i++) {
    for (const p of pages) if (await p.locator('.status-pill.my-turn').count()) return p;
    await pages[0].waitForTimeout(250);
  }
  throw new Error('Nenhum jogador está com a vez');
}

/** Falha o teste se houver erro no console da página. */
export function failOnConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
