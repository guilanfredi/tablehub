import { expect, test } from '@playwright/test';
import { chooseGame, createRoom, failOnConsoleErrors, joinRoom, newPlayer, startGame } from './helpers';

test('bots: dono adiciona um bot ao Dominó e o bot joga na sua vez', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const errors = failOnConsoleErrors(ana);
  await createRoom(ana);
  await chooseGame(ana, 'Dominó');
  await ana.getByRole('button', { name: 'Adicionar bot' }).click();
  await expect(ana.locator('.player-item.is-bot')).toContainText('Bot');
  await startGame(ana);

  // quem começa varia; se for a Ana, ela joga e depois espera o bot
  const myTurn = ana.locator('.status-pill.my-turn');
  if (await myTurn.isVisible().catch(() => false)) {
    await ana.locator('.domino-hand-tile.playable').first().click();
    const side = ana.getByRole('button', { name: /Esquerda/ });
    if (await side.isVisible().catch(() => false)) await side.click();
  }
  await expect(myTurn).toBeVisible();
  await expect(ana.locator('.domino-line .domino-tile').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('bots: Truco aceita bots', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  await createRoom(ana);
  await chooseGame(ana, 'Truco');
  await ana.getByRole('button', { name: 'Adicionar bot' }).click();
  await expect(ana.locator('.player-item.is-bot')).toBeVisible();
  await startGame(ana);
});

for (const [game, bots] of [['Catan', 2], ['King of Tokyo', 1]] as const) {
  test(`bots: ${game} aceita bots e eles jogam até a vez do humano`, async ({ browser }) => {
    const ana = await newPlayer(browser, 'Ana');
    const errors = failOnConsoleErrors(ana);
    await createRoom(ana);
    await chooseGame(ana, game);
    for (let i = 0; i < bots; i++) await ana.getByRole('button', { name: 'Adicionar bot' }).click();
    await expect(ana.locator('.player-item.is-bot')).toHaveCount(bots);
    await startGame(ana);
    await expect(ana.locator('.status-pill.my-turn')).toBeVisible({ timeout: 30_000 });
    expect(errors).toEqual([]);
  });
}

// ---------- QA ----------

/** Página sem rolagem horizontal. */
const noHScroll = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('bots: só o dono vê "Adicionar bot"; remover bot pelo ✕; botão some com a mesa cheia', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const beto = await newPlayer(browser, 'Beto');
  const errors = failOnConsoleErrors(ana);
  ana.on('dialog', (d) => d.accept());
  const code = await createRoom(ana);
  await joinRoom(beto, code);
  await chooseGame(ana, 'Truco');
  await expect(beto.getByRole('button', { name: 'Adicionar bot' })).toHaveCount(0);
  await ana.getByRole('button', { name: 'Adicionar bot' }).click();
  await expect(ana.locator('.player-item')).toHaveCount(3);
  await ana.getByRole('button', { name: 'Adicionar bot' }).click();
  await expect(ana.getByRole('button', { name: 'Adicionar bot' })).toHaveCount(0); // 4/4
  await expect(beto.locator('.player-item.is-bot')).toHaveCount(2);
  const firstBot = (await ana.locator('.player-item.is-bot .name').first().innerText()).trim();
  await ana.getByRole('button', { name: `Remover ${firstBot}` }).click();
  await expect(ana.locator('.player-item', { hasText: firstBot })).toHaveCount(0);
  await expect(beto.locator('.player-item', { hasText: firstBot })).toHaveCount(0);
  await expect(beto.locator('.player-item.is-bot')).toHaveCount(1);
  expect(await noHScroll(ana)).toBe(true);
  expect(errors).toEqual([]);
});

test('bots: Truco 4 jogadores (1 humano + 3 bots) — bots jogam, cartas deles ocultas, recarregar retoma', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const errors = failOnConsoleErrors(ana);
  await createRoom(ana);
  await chooseGame(ana, 'Truco');
  for (let i = 1; i <= 3; i++) {
    await ana.getByRole('button', { name: 'Adicionar bot' }).click();
    await expect(ana.locator('.player-item')).toHaveCount(1 + i);
  }
  await startGame(ana);
  // só as minhas cartas aparecem; dos bots vejo só a contagem
  await expect(ana.locator('.truco-hand .pcard-btn')).toHaveCount(3);
  await expect(ana.locator('.gt-seat:not(:has(.gt-seat-name:text-is("Você")))').first()).toContainText('carta');
  await expect(ana.locator('.gt-seat .avatar-bot')).toHaveCount(3);
  for (let turn = 0; turn < 3; turn++) {
    await expect(ana.locator('.status-pill.my-turn')).toBeVisible({ timeout: 15_000 });
    const accept = ana.getByRole('button', { name: /Aceitar|Aceito/ });
    const onze = ana.getByRole('button', { name: /^Jogar/ });
    if (await accept.isVisible().catch(() => false)) await accept.click();
    else if (await onze.isVisible().catch(() => false)) await onze.click();
    else await ana.locator('.truco-hand .pcard-btn:enabled').first().click();
    if (turn === 1) {
      await ana.reload();
      await expect(ana.locator('.status-pill')).toBeVisible();
    }
  }
  await expect(ana.locator('.status-pill.my-turn')).toBeVisible({ timeout: 15_000 });
  expect(await noHScroll(ana)).toBe(true);
  expect(errors).toEqual([]);
});

test('bots: Dominó até o fim (1 humano + 1 bot) e voltar à sala com o bot ainda pronto', async ({ browser }) => {
  test.setTimeout(900_000); // bots "pensam" 1,2–2,5 s por jogada
  const ana = await newPlayer(browser, 'Ana');
  const errors = failOnConsoleErrors(ana);
  await createRoom(ana);
  await chooseGame(ana, 'Dominó');
  await ana.getByLabel('Pontos para vencer').selectOption('50'); // partida mais curta
  await ana.getByRole('button', { name: 'Adicionar bot' }).click();
  await startGame(ana);
  const back = ana.getByRole('button', { name: 'Voltar à mesa' });
  for (let i = 0; i < 3000 && !(await back.isVisible().catch(() => false)); i++) {
    if (!(await ana.locator('.status-pill.my-turn').isVisible().catch(() => false))) {
      await ana.waitForTimeout(300);
      continue;
    }
    const tile = ana.locator('.domino-hand-tile.playable').first();
    const draw = ana.getByRole('button', { name: 'Comprar do monte' });
    const pass = ana.getByRole('button', { name: 'Passar a vez' });
    // o estado pode mudar entre a checagem e o clique (fim de rodada): clique com prazo curto e tenta de novo
    const click = (l: typeof tile) => l.click({ timeout: 2000 }).catch(() => {});
    if (await tile.isVisible().catch(() => false)) {
      await click(tile);
      const side = ana.getByRole('button', { name: /Esquerda/ });
      if (await side.isVisible().catch(() => false)) await click(side);
    } else if (await draw.isVisible().catch(() => false)) await click(draw);
    else if (await pass.isVisible().catch(() => false)) await click(pass);
    await ana.waitForTimeout(200);
  }
  await expect(back).toBeVisible();
  await back.click();
  await expect(ana.locator('.player-item.is-bot')).toContainText('Bot');
  await expect(ana.getByRole('button', { name: 'Iniciar partida' })).toBeEnabled();
  expect(errors).toEqual([]);
});
