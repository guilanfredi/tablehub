import { expect, test, type Page } from '@playwright/test';
import { chooseGame, createRoom, failOnConsoleErrors, joinRoom, newPlayer, setReady, startGame, whoseTurn } from './helpers';

/** QA do PR #30: monte visual do Dominó jogando uma rodada inteira com 3 jogadores (monte de 7). */

async function boneyardCount(page: Page): Promise<number> {
  const el = page.locator('.domino-boneyard-count');
  if (!(await el.count())) return 0;
  return Number((await el.textContent())!.replace('×', ''));
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test('dominó com compra: rodada inteira, monte igual para todos, destaque some ao jogar, monte vazio', async ({ browser }) => {
  test.setTimeout(240_000);
  const names = ['Ana', 'Beto', 'Caio'];
  const pages = await Promise.all(names.map((n) => newPlayer(browser, n)));
  const [ana, beto, caio] = pages;
  const errors = pages.flatMap((p) => failOnConsoleErrors(p));

  const code = await createRoom(ana);
  await joinRoom(beto, code);
  await joinRoom(caio, code);
  await chooseGame(ana, 'Dominó');
  await ana.getByLabel('Modo').selectOption({ label: 'Com compra (monte)' });
  await setReady(beto);
  await setReady(caio);
  await startGame(ana);

  for (const p of pages) {
    await expect(p.locator('.domino-boneyard-count')).toHaveText('×7');
    await expect(p.locator('.domino-boneyard .domino-boneyard-tile')).toHaveCount(7);
    await expect(p.locator('.domino-mini-hand')).toHaveCount(2);
  }

  let draws = 0;
  let sawEmpty = false;
  let reloaded = false;
  for (let turn = 0; turn < 150; turn++) {
    if (await ana.getByText(/Rodada 1: /).count()) break;
    if (await ana.locator('.result-card').count()) break;
    const cur = await whoseTurn(pages);
    const hand = cur.locator('.domino-hand-tile');
    const before = await hand.count();
    const left = await boneyardCount(cur);

    if (await cur.locator('.domino-boneyard.can-draw').count()) {
      await expect(cur.getByText('Sem peça para jogar — compre do monte')).toBeVisible();
      await cur.locator('.domino-boneyard.can-draw').click();
      await expect(hand).toHaveCount(before + 1);
      draws++;
      for (const p of pages) {
        if (left - 1 > 0) {
          await expect(p.locator('.domino-boneyard-count')).toHaveText(`×${left - 1}`);
          await expect(p.locator('.domino-boneyard .domino-boneyard-tile')).toHaveCount(left - 1);
        } else {
          await expect(p.locator('.domino-boneyard')).toHaveCount(0);
        }
      }
      // peças compradas continuam destacadas enquanto o jogador não joga
      await expect(cur.locator('.domino-hand-tile.drawn')).not.toHaveCount(0);
      continue;
    }

    const pass = cur.getByRole('button', { name: 'Passar a vez' });
    if (await pass.count()) {
      expect(left).toBe(0);
      await expect(cur.getByText('O monte acabou')).toBeVisible();
      await expect(pass).toHaveClass(/domino-pass-highlight/);
      await expect(cur.locator('.domino-boneyard')).toHaveCount(0);
      sawEmpty = true;
      await pass.click();
      await expect(pass).toHaveCount(0);
      continue;
    }

    // tem jogada: monte não pisca e nada é comprado sozinho
    await expect(cur.locator('.domino-boneyard.can-draw')).toHaveCount(0);
    await expect(cur.getByText('Sem peça para jogar — compre do monte')).toHaveCount(0);
    await cur.locator('.domino-hand-tile.playable').first().click();
    const side = cur.getByRole('button', { name: /Esquerda/ });
    if (await side.isVisible().catch(() => false)) await side.click();
    // a última peça encerra a rodada e a mão é reposta
    if (before === 1) break;
    await expect(hand).toHaveCount(before - 1);
    // ao jogar, o destaque das compradas some
    await expect(cur.locator('.domino-hand-tile.drawn')).toHaveCount(0);
    expect(await boneyardCount(cur)).toBe(left);

    await noHorizontalScroll(cur);
    await expect(cur.locator('.domino-hand')).toBeInViewport();

    if (!reloaded && draws > 0) {
      reloaded = true;
      const other = pages.find((p) => p !== cur)!;
      await other.reload();
      await expect(other.locator('.domino-hand-tile').first()).toBeVisible();
      expect(await boneyardCount(other)).toBe(left);
      await expect(other.locator('.domino-boneyard .domino-boneyard-tile')).toHaveCount(left);
    }
  }
  expect(draws).toBeGreaterThan(0);
  test.info().annotations.push({ type: 'monte vazio visto', description: String(sawEmpty) });

  // 375 px com as miniaturas das mãos dos oponentes
  for (const p of pages) {
    await p.setViewportSize({ width: 375, height: 740 });
    await noHorizontalScroll(p);
  }
  expect(errors).toEqual([]);
});
