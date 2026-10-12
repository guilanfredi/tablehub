import { expect, test, type Page } from '@playwright/test';
import { chooseGame, createRoom, failOnConsoleErrors, joinRoom, newPlayer, startGame } from './helpers';

const BOT_NAMES = ['Paula', 'Jacinto', 'Benjamin', 'Cuca', 'Kelly', 'Oscar', 'Simas', 'Giuseppe', 'Sujiro', 'Tati', 'Kevin'];

/** Nome (aria-label) do avatar principal dentro de um elemento. */
const avatarOf = (page: Page, selector: string) => page.locator(`${selector} .avatar > svg:first-child`).first().getAttribute('aria-label');

async function pickAvatar(page: Page, label: string) {
  await page.getByRole('button', { name: 'Trocar avatar' }).first().click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await expect(page.getByRole('listbox', { name: 'Escolha seu avatar' })).toHaveCount(0);
}

test('perfil: avatar sugerido, escolha e apelido persistem; ?perfil=2 é outro perfil', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  const errors = failOnConsoleErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Seu perfil' })).toBeVisible();
  const suggested = await avatarOf(page, '.profile-row');
  expect(suggested).toBeTruthy();
  await page.reload();
  expect(await avatarOf(page, '.profile-row')).toBe(suggested); // sugerido persiste

  const target = suggested === 'Capivara' ? 'Panda' : 'Capivara';
  await page.getByRole('button', { name: 'Trocar avatar' }).first().click();
  await expect(page.getByRole('option')).toHaveCount(20);
  await page.getByRole('option', { name: target, exact: true }).click();
  await page.getByLabel('Seu apelido').fill('Rita');
  await page.reload();
  expect(await avatarOf(page, '.profile-row')).toBe(target);
  await expect(page.getByLabel('Seu apelido')).toHaveValue('Rita');

  await page.goto('/?perfil=2');
  await expect(page.getByLabel('Seu apelido')).toHaveValue('');
  expect(errors).toEqual([]);
});

test('perfil: entrar por link escolhe avatar; troca no lobby aparece para todos; outro avatar não abre seletor', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const errors = failOnConsoleErrors(ana);
  const code = await createRoom(ana);

  const beto = await (await browser.newContext()).newPage();
  await beto.goto(`/sala/${code}`);
  await expect(beto.getByLabel('Seu apelido')).toBeVisible();
  await beto.getByLabel('Seu apelido').fill('Beto');
  await pickAvatar(beto, 'Tucano');
  await beto.getByRole('button', { name: 'Entrar' }).click();
  await expect(beto.getByRole('heading', { name: /Jogadores/ })).toBeVisible();
  await expect.poll(() => avatarOf(ana, '.player-item:has-text("Beto")')).toBe('Tucano');

  // só o próprio avatar é botão
  await expect(ana.locator('.player-item:has-text("Beto") .avatar-button')).toHaveCount(0);
  await expect(beto.locator('.player-item:has-text("Ana") .avatar-button')).toHaveCount(0);

  await beto.locator('.player-item:has-text("Beto") .avatar-button').click();
  await beto.getByRole('option', { name: 'Sapo', exact: true }).click();
  // 1 s no servidor local; folga para rodar contra o preview remoto
  await expect.poll(() => avatarOf(ana, '.player-item:has-text("Beto")'), { timeout: 3000 }).toBe('Sapo');
  await beto.reload();
  await expect.poll(() => avatarOf(beto, '.player-item:has-text("Beto")')).toBe('Sapo');
  expect(errors).toEqual([]);
});

test('bots: nome da lista, selo de robô e "pensando…" na vez do bot', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const errors = failOnConsoleErrors(ana);
  await createRoom(ana);
  await chooseGame(ana, 'Truco');
  for (let i = 0; i < 3; i++) await ana.getByRole('button', { name: 'Adicionar bot' }).click();
  await expect(ana.locator('.player-item.is-bot')).toHaveCount(3);
  const names = (await ana.locator('.player-item.is-bot .name').allInnerTexts()).map((n) => n.trim());
  for (const n of names) expect(BOT_NAMES).toContain(n);
  expect(new Set(names).size).toBe(3);
  const avatars = await ana.locator('.player-item .avatar > svg:first-child').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  expect(new Set(avatars).size).toBe(4);
  await expect(ana.locator('.player-item.is-bot .avatar-bot')).toHaveCount(3);

  await startGame(ana);
  await expect(ana.locator('.truco-seat .avatar-bot')).toHaveCount(3);
  const thinking = ana.locator('.truco-seat .thinking');
  await expect(thinking.or(ana.locator('.status-pill.my-turn'))).toBeVisible({ timeout: 15_000 });
  if (!(await thinking.isVisible())) await ana.locator('.truco-hand .pcard-btn:enabled').first().click();
  await expect(thinking).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('aviso de vez: com a aba em segundo plano, título pisca e notificação sai só com o sino ligado', async ({ browser }) => {
  test.setTimeout(120_000);
  const ana = await newPlayer(browser, 'Ana');
  const errors = failOnConsoleErrors(ana);
  await ana.addInitScript(() => {
    const w = window as unknown as { __hidden: boolean; __notes: string[]; __asked: number };
    w.__hidden = false;
    w.__notes = [];
    w.__asked = 0;
    Object.defineProperty(document, 'visibilityState', { get: () => (w.__hidden ? 'hidden' : 'visible') });
    class FakeNotification {
      static permission: NotificationPermission = 'default';
      static async requestPermission() {
        w.__asked++;
        FakeNotification.permission = 'granted';
        return 'granted' as NotificationPermission;
      }
      onclick: (() => void) | null = null;
      constructor(_title: string, opts?: NotificationOptions) {
        w.__notes.push(opts?.body ?? '');
      }
      close() {}
    }
    (window as unknown as { Notification: unknown }).Notification = FakeNotification;
    // no build de produção há service worker; força o caminho da API direta para observar a notificação
    if (navigator.serviceWorker) navigator.serviceWorker.getRegistration = async () => undefined;
  });
  await createRoom(ana);
  await chooseGame(ana, 'Dominó');
  await ana.getByRole('button', { name: 'Adicionar bot' }).click();
  expect(await ana.evaluate(() => (window as unknown as { __asked: number }).__asked)).toBe(0); // nunca pedimos sozinhos
  await ana.getByRole('button', { name: 'Avisar quando for minha vez' }).click();
  await expect(ana.getByRole('button', { name: 'Desativar aviso de vez' })).toBeVisible();
  expect(await ana.evaluate(() => (window as unknown as { __asked: number }).__asked)).toBe(1);

  await startGame(ana);
  await ana.evaluate(() => ((window as unknown as { __hidden: boolean }).__hidden = true));
  const myTurn = ana.locator('.status-pill.my-turn');
  // se a partida começa com a Ana, ela joga para a vez passar ao bot e voltar
  if (await myTurn.isVisible().catch(() => false)) await playOne(ana);
  await expect(myTurn).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => ana.evaluate(() => (window as unknown as { __notes: string[] }).__notes)).toContain('Sua vez em Dominó');
  const titles = new Set<string>();
  for (let i = 0; i < 12; i++) {
    titles.add(await ana.title());
    await ana.waitForTimeout(200);
  }
  expect(titles).toContain('● Sua vez! — TableHub');

  await ana.evaluate(() => {
    (window as unknown as { __hidden: boolean }).__hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await ana.waitForTimeout(1200);
  expect(await ana.title()).not.toContain('Sua vez');
  expect(errors).toEqual([]);
});

async function playOne(page: Page) {
  const tile = page.locator('.domino-hand-tile.playable').first();
  if (await tile.isVisible().catch(() => false)) {
    await tile.click();
    const side = page.getByRole('button', { name: /Esquerda/ });
    if (await side.isVisible().catch(() => false)) await side.click();
    return;
  }
  for (const name of ['Comprar do monte', 'Passar a vez']) {
    const b = page.getByRole('button', { name });
    if (await b.isVisible().catch(() => false)) return b.click();
  }
}

test('cliente antigo (hello sem avatar) entra com avatar padrão estável', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const code = await createRoom(ana);
  const old = await (await browser.newContext()).newPage();
  await old.goto('/');
  const avatarFor = () =>
    old.evaluate(
      (c) =>
        new Promise<string>((resolve, reject) => {
          const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/${c}`);
          ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', token: 'token-antigo-0123456789', name: 'Velho' }));
          ws.onmessage = (ev) => {
            const msg = JSON.parse(ev.data);
            if (msg.t !== 'room') return;
            ws.close();
            resolve(msg.room.players.find((p: { name: string }) => p.name === 'Velho').avatar);
          };
          ws.onerror = () => reject(new Error('ws'));
        }),
      code,
    );
  const first = await avatarFor();
  expect(first).toBeTruthy();
  expect(await avatarFor()).toBe(first);
  await joinRoom(ana, code);
  await expect(ana.locator('.player-item:has-text("Velho") .avatar')).toBeVisible();
});
