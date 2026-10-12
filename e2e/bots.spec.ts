import { expect, test } from '@playwright/test';
import { chooseGame, createRoom, failOnConsoleErrors, newPlayer, startGame } from './helpers';

test('bots: dono adiciona um bot ao Dominó e o bot joga na sua vez', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const errors = failOnConsoleErrors(ana);
  await createRoom(ana);
  await chooseGame(ana, 'Dominó');
  await ana.getByRole('button', { name: 'Adicionar bot' }).click();
  await expect(ana.locator('.player-item', { hasText: 'Bot 1' })).toContainText('Bot');
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

test('bots: Truco aceita bots e Catan não oferece', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  await createRoom(ana);
  await chooseGame(ana, 'Catan');
  await expect(ana.getByRole('button', { name: 'Adicionar bot' })).toHaveCount(0);
  await chooseGame(ana, 'Truco');
  await ana.getByRole('button', { name: 'Adicionar bot' }).click();
  await expect(ana.getByText('Bot 1')).toBeVisible();
  await startGame(ana);
});
