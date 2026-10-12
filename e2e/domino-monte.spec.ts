import { expect, test, type Page } from '@playwright/test';
import { chooseGame, createRoom, failOnConsoleErrors, joinRoom, newPlayer, setReady, startGame, whoseTurn } from './helpers';

async function boneyardCount(page: Page): Promise<number> {
  const text = await page.locator('.domino-boneyard-count').textContent();
  return Number(text!.replace('×', ''));
}

test('dominó com compra: monte visual, compra tocando no monte e peça comprada destacada', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const beto = await newPlayer(browser, 'Beto');
  const errors = [...failOnConsoleErrors(ana), ...failOnConsoleErrors(beto)];

  const code = await createRoom(ana);
  await joinRoom(beto, code);
  await chooseGame(ana, 'Dominó');
  await ana.getByLabel('Modo').selectOption({ label: 'Com compra (monte)' });
  await setReady(beto);
  await startGame(ana);

  for (const p of [ana, beto]) {
    await expect(p.locator('.domino-boneyard .domino-boneyard-tile')).toHaveCount(14);
    await expect(p.locator('.domino-boneyard-count')).toHaveText('×14');
    await expect(p.locator('.domino-mini-hand .domino-back')).toHaveCount(7);
  }

  let drew = false;
  for (let turn = 0; turn < 60 && !drew; turn++) {
    const cur = await whoseTurn([ana, beto]);
    const other = cur === ana ? beto : ana;
    const hand = cur.locator('.domino-hand-tile');
    const before = await hand.count();
    const boneyard = cur.locator('.domino-boneyard.can-draw');
    if (await boneyard.isVisible()) {
      await expect(cur.getByText('Sem peça para jogar — compre do monte')).toBeVisible();
      await expect(cur.getByRole('button', { name: 'Comprar do monte', exact: true })).toBeVisible();
      const left = await boneyardCount(cur);
      await boneyard.click();
      await expect(hand).toHaveCount(before + 1);
      await expect(cur.locator('.domino-hand-tile.drawn')).toHaveCount(1);
      await expect(other.locator('.domino-boneyard-count')).toHaveText(`×${left - 1}`);
      await expect(other.locator('.domino-boneyard .domino-boneyard-tile')).toHaveCount(left - 1);
      drew = true;
      break;
    }
    // nada é comprado sem ação do jogador
    await expect(cur.locator('.domino-boneyard.can-draw')).toHaveCount(0);
    await cur.locator('.domino-hand-tile.playable').first().click();
    const side = cur.getByRole('button', { name: /Esquerda/ });
    if (await side.isVisible().catch(() => false)) await side.click();
    await expect(hand).not.toHaveCount(before);
  }
  expect(drew).toBe(true);

  // 375 px: sem rolagem horizontal e a mão à vista
  await ana.setViewportSize({ width: 375, height: 740 });
  const overflow = await ana.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(ana.locator('.domino-hand-tile').first()).toBeInViewport();

  expect(errors).toEqual([]);
});

test('dominó em bloqueio: sem monte na mesa', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const beto = await newPlayer(browser, 'Beto');
  const code = await createRoom(ana);
  await joinRoom(beto, code);
  await chooseGame(ana, 'Dominó');
  await setReady(beto);
  await startGame(ana);
  await expect(ana.locator('.domino-hand-tile')).toHaveCount(7);
  await expect(ana.locator('.domino-boneyard')).toHaveCount(0);
});
