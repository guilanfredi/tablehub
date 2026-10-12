import { expect, test } from '@playwright/test';
import { chooseGame, createRoom, failOnConsoleErrors, joinRoom, newPlayer, setReady, startGame, whoseTurn } from './helpers';

test('sala: criar, entrar, pronto mantido após mudar regra, iniciar e jogar', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const beto = await newPlayer(browser, 'Beto');
  const errors = [...failOnConsoleErrors(ana), ...failOnConsoleErrors(beto)];

  const code = await createRoom(ana);
  await joinRoom(beto, code);
  await expect(ana.getByText('Beto')).toBeVisible();

  await chooseGame(ana, 'Dominó');
  await setReady(beto);
  await ana.getByLabel('Pontos para vencer').selectOption({ label: '50 pontos' });
  // decisão de produto: mudar regra não desmarca o pronto, mas avisa
  await expect(beto.getByText('O dono alterou as regras depois que você marcou pronto.')).toBeVisible();
  await expect(beto.getByRole('button', { name: 'Não estou pronto' })).toBeVisible();

  await startGame(ana);
  const current = await whoseTurn([ana, beto]);
  await expect(current.locator('.domino-hand-tile')).toHaveCount(7);
  await current.locator('.domino-hand-tile.playable').first().click();
  const sideButton = current.getByRole('button', { name: /Esquerda/ });
  if (await sideButton.isVisible().catch(() => false)) await sideButton.click();
  await expect(current.locator('.domino-hand-tile')).toHaveCount(6);
  await expect(ana.locator('.domino-line .domino-tile')).toHaveCount(1);

  expect(errors).toEqual([]);
});

test('reconexão: recarregar a página mantém o jogador na partida', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const beto = await newPlayer(browser, 'Beto');
  const code = await createRoom(ana);
  await joinRoom(beto, code);
  await chooseGame(ana, 'Dominó');
  await setReady(beto);
  await startGame(ana);
  await beto.reload();
  await expect(beto.locator('.domino-hand-tile')).toHaveCount(7);
});
