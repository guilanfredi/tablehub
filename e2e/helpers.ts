import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

type ContextOptions = Parameters<Browser['newContext']>[0];

// O `browser` é compartilhado por todos os testes do worker e não fecha os contextos criados à mão. Abertos, eles
// seguem conectados às salas (bots jogando, animações) e deixam os testes seguintes lentos até estourarem o tempo.
// Por isso os contextos são criados só por aqui, marcados com o teste que os abriu, e os de testes anteriores são
// fechados ao criar o primeiro do teste atual. A marca fica no contexto (não num estado deste módulo), porque cada
// arquivo de teste pode carregar a própria cópia dos helpers.
const OWNER = '__tablehubTestId'; // texto, não Symbol: um Symbol também seria diferente em cada cópia
type Owned = BrowserContext & { [OWNER]?: string };

async function newContext(browser: Browser, options: ContextOptions = {}): Promise<BrowserContext> {
  const { testId } = test.info();
  const stale = (browser.contexts() as Owned[]).filter((c) => c[OWNER] !== undefined && c[OWNER] !== testId);
  await Promise.all(stale.map((c) => c.close().catch(() => undefined)));
  const ctx: Owned = await browser.newContext(options);
  ctx[OWNER] = testId;
  return ctx;
}

/** Visitante sem nome definido (contexto isolado). Use este ou `newPlayer`, nunca `browser.newContext()` direto. */
export async function newGuest(browser: Browser, contextOptions: ContextOptions = {}): Promise<Page> {
  return (await newContext(browser, contextOptions)).newPage();
}

/**
 * Cada jogador é um contexto de navegador isolado (localStorage próprio = identidade própria).
 * Herda o dispositivo do projeto (desktop/mobile) em execução.
 */
export async function newPlayer(browser: Browser, name: string, contextOptions: ContextOptions = {}): Promise<Page> {
  const page = await newGuest(browser, contextOptions);
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
