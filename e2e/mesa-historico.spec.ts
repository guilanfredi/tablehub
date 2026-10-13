import { expect, test, type Browser, type Page } from '@playwright/test';
import { chooseGame, createRoom, failOnConsoleErrors, joinRoom, newPlayer, setReady, startGame, whoseTurn } from './helpers';

async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

/** Joga a primeira jogada possível do dominó (peça, compra ou passe). */
async function dominoMove(page: Page) {
  const before = await last(page);
  const tile = page.locator('.domino-hand-tile.playable').first();
  if (await tile.count()) {
    await tile.click();
    const left = page.getByRole('button', { name: /Esquerda/ });
    if (await left.isVisible().catch(() => false)) await left.click();
  } else if (await page.locator('.domino-boneyard.can-draw').count()) await page.locator('.domino-boneyard.can-draw').click();
  else await page.getByRole('button', { name: 'Passar a vez' }).click();
  // espera o servidor confirmar (a última jogada mostrada no centro muda)
  await expect.poll(() => last(page)).not.toBe(before);
}

const last = (page: Page) => page.locator('.domino-last').textContent({ timeout: 500 }).catch(() => null);

async function dominoTable(browser: Browser, opts: Parameters<typeof newPlayer>[2] = {}) {
  const ana = await newPlayer(browser, 'Ana', opts);
  const beto = await newPlayer(browser, 'Beto', opts);
  const code = await createRoom(ana);
  await joinRoom(beto, code);
  await chooseGame(ana, 'Dominó');
  await setReady(beto);
  await startGame(ana);
  await expect(beto.locator('.status-pill')).toBeVisible();
  return { ana, beto };
}

test('dominó na mesa comum: você embaixo, anel na vez; histórico com não lidas e aviso de ausência', async ({ browser }) => {
  const { ana, beto } = await dominoTable(browser);
  const errors = [...failOnConsoleErrors(ana), ...failOnConsoleErrors(beto)];

  for (const p of [ana, beto]) {
    await expect(p.locator('.gt-seat')).toHaveCount(2);
    await expect(p.locator('.gt-bottom .gt-seat-name')).toHaveText('Você');
    await expect(p.locator('.gt-seat.turn')).toHaveCount(1);
    await expect(p.locator('.gt-seat.turn .avatar-ring')).toHaveCount(1);
  }

  // jogada do outro aumenta o contador; abrir o painel zera
  let cur = await whoseTurn([ana, beto]);
  let other = cur === ana ? beto : ana;
  await expect(other.locator('.history-count')).toHaveCount(0);
  await dominoMove(cur);
  await expect(other.locator('.history-count')).toHaveText('1');
  await expect(cur.locator('.history-count')).toHaveCount(0); // a própria jogada não conta
  await other.getByRole('button', { name: /^Histórico/ }).click();
  const panel = other.getByRole('complementary', { name: 'Histórico da partida' });
  await expect(panel.locator('.history-entry').first()).toContainText(/abriu com \[\d\|\d\]/);
  await expect(other.locator('.history-count')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Fechar' }).click();
  await expect(panel).toHaveCount(0);

  // aba em segundo plano enquanto houve jogadas
  cur = await whoseTurn([ana, beto]);
  other = cur === ana ? beto : ana;
  await setHidden(other, true);
  await dominoMove(cur);
  await expect(other.locator('.history-count')).toHaveText('1');
  await setHidden(other, false);
  await expect(other.getByText('1 jogada enquanto você esteve fora')).toBeVisible();
  await other.getByRole('button', { name: 'Ver histórico' }).click();
  await expect(other.getByRole('complementary', { name: 'Histórico da partida' })).toBeVisible();
  await expect(other.getByText(/enquanto você esteve fora/)).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('dominó em 375 px: sem rolagem horizontal e a mão visível sem rolar', async ({ browser }) => {
  const { ana, beto } = await dominoTable(browser, { viewport: { width: 375, height: 667 } });
  for (let i = 0; i < 4; i++) await dominoMove(await whoseTurn([ana, beto]));
  for (const p of [ana, beto]) {
    await expect(p.locator('.gt-strip .gt-seat')).toHaveCount(1);
    expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await expect(p.locator('.domino-hand-tile').first()).toBeInViewport();
  }
});

test('animações existem e somem com prefers-reduced-motion', async ({ browser }) => {
  const { ana } = await dominoTable(browser);
  await expect.poll(() => ana.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0); // anel da vez pulsando

  const calm = await dominoTable(browser, { reducedMotion: 'reduce' });
  const cur = await whoseTurn([calm.ana, calm.beto]);
  await dominoMove(cur);
  for (const p of [calm.ana, calm.beto]) {
    await expect(p.locator('.domino-line .domino-placed')).toHaveCount(1);
    expect(await p.evaluate(() => document.getAnimations().length)).toBe(0);
  }
});

test('truco na mesa comum: carta jogada vai ao centro e entra no histórico', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const beto = await newPlayer(browser, 'Beto');
  const code = await createRoom(ana);
  await joinRoom(beto, code);
  await chooseGame(ana, 'Truco');
  await setReady(beto);
  await startGame(ana);

  for (const p of [ana, beto]) {
    await expect(p.locator('.gt-seat')).toHaveCount(2);
    await expect(p.locator('.gt-bottom .gt-seat-name')).toHaveText('Você');
  }
  const cur = await whoseTurn([ana, beto]);
  const other = cur === ana ? beto : ana;
  const onze = cur.getByRole('button', { name: /^Jogar \(vale 3\)/ });
  if (await onze.isVisible().catch(() => false)) await onze.click();
  await cur.locator('.truco-hand .pcard-btn:enabled').first().click();
  await expect(other.locator('.truco-trick .truco-slot-top .truco-play')).toHaveCount(1);
  await expect(cur.locator('.truco-trick .truco-slot-bottom .truco-play')).toHaveCount(1);
  await other.getByRole('button', { name: /^Histórico/ }).click();
  await expect(other.locator('.history-entry').first()).toContainText(/jogou/);
});
