import { expect, test } from '@playwright/test';
import { chooseGame, createRoom, failOnConsoleErrors, joinRoom, newPlayer, setReady, startGame, whoseTurn } from './helpers';

test('king of tokyo: rolar, guardar, resolver, ver a vitrine e passar a vez', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const beto = await newPlayer(browser, 'Beto');
  const errors = [...failOnConsoleErrors(ana), ...failOnConsoleErrors(beto)];

  const code = await createRoom(ana);
  await joinRoom(beto, code);
  await chooseGame(ana, 'King of Tokyo');
  await setReady(beto);
  await startGame(ana);

  const current = await whoseTurn([ana, beto]);
  await expect(current.getByText('Cidade de Tóquio')).toBeVisible();
  await expect(current.locator('.kot-market img')).toHaveCount(3);
  await expect(current.locator('.kot-market img').first()).toHaveJSProperty('complete', true);

  await current.getByRole('button', { name: 'Rolar dados' }).click();
  await expect(current.locator('.kot-dice .kot-die')).toHaveCount(6);
  await current.locator('.kot-die').first().click();
  await expect(current.locator('.kot-die.kept')).toHaveCount(1);
  await current.getByRole('button', { name: 'Parar e resolver' }).click();

  // ninguém em Tóquio: o jogador da vez entra na Cidade
  await expect(current.locator('.kot-tokyo .kot-portrait')).toHaveCount(1);
  await current.locator('.kot-market .kot-card').first().click();
  await expect(current.locator('.kot-zoom img')).toBeVisible();
  await current.locator('.kot-zoom').click();
  await current.getByRole('button', { name: 'Encerrar turno' }).click();

  const other = current === ana ? beto : ana;
  await expect(other.getByRole('button', { name: 'Rolar dados' })).toBeVisible();
  expect(errors).toEqual([]);
});
