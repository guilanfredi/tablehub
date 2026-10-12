import { expect, test } from '@playwright/test';
import { chooseGame, createRoom, failOnConsoleErrors, joinRoom, newPlayer, setReady, startGame } from './helpers';

// Issue #11: o jogo aparece como "Truco" (sem "Paulista") no início, no lobby, na validação e na mesa.
test('truco: nome "Truco" no lobby, na validação e na partida', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const beto = await newPlayer(browser, 'Beto');
  const caio = await newPlayer(browser, 'Caio');
  const errors = [...failOnConsoleErrors(ana), ...failOnConsoleErrors(beto), ...failOnConsoleErrors(caio)];

  await ana.goto('/');
  await expect(ana.getByText('Truco', { exact: true }).first()).toBeVisible();
  await expect(ana.getByText(/Truco Paulista/)).toHaveCount(0);

  const code = await createRoom(ana);
  await joinRoom(beto, code);
  await joinRoom(caio, code);
  await expect(ana.getByText('Caio')).toBeVisible();

  await chooseGame(ana, 'Truco');
  await expect(ana.getByText(/Truco Paulista/)).toHaveCount(0);
  await expect(beto.getByText(/Truco Paulista/)).toHaveCount(0);
  await expect(ana.getByText('Truco é jogado com 2 ou 4 jogadores.')).toBeVisible();

  ana.once('dialog', (d) => d.accept());
  await ana.getByRole('button', { name: 'Remover Caio' }).click();
  await expect(ana.getByText('Truco é jogado com 2 ou 4 jogadores.')).toHaveCount(0);

  await setReady(beto);
  await startGame(ana);
  await expect(ana.getByText('Truco', { exact: true }).first()).toBeVisible();
  await expect(ana.getByText(/Truco Paulista/)).toHaveCount(0);
  await expect(beto.getByText(/Truco Paulista/)).toHaveCount(0);

  expect(errors).toEqual([]);
});
