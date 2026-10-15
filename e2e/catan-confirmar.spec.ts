import { expect, test } from '@playwright/test';
import { chooseGame, createRoom, failOnConsoleErrors, newPlayer, startGame } from './helpers';

test('catan: toque só seleciona; Cancelar descarta e Confirmar executa (draft inicial)', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const errors = failOnConsoleErrors(ana);
  await createRoom(ana);
  await chooseGame(ana, 'Catan');
  for (let i = 0; i < 2; i++) await ana.getByRole('button', { name: 'Adicionar bot' }).click();
  await startGame(ana);
  await expect(ana.locator('.status-pill.my-turn')).toBeVisible({ timeout: 30_000 });

  const targets = ana.locator('g.hit:has(.vertex-target)');
  const n = await targets.count();
  expect(n).toBeGreaterThan(0);
  const bar = ana.getByRole('group', { name: 'Confirmar jogada' });
  const dismiss = ana.getByRole('button', { name: 'Cancelar' });

  // seleciona: nada executa
  await targets.first().locator('circle').last().click({ force: true });
  await expect(bar).toBeVisible();
  await expect(bar).toContainText('aldeia');
  expect(await targets.count()).toBe(n);
  await dismiss.click();
  await expect(bar).toHaveCount(0);
  expect(await targets.count()).toBe(n);

  // troca de seleção e confirma
  await targets.first().locator('circle').last().click({ force: true });
  await targets.nth(1).locator('circle').last().click({ force: true });
  await expect(bar).toHaveCount(1);
  await bar.getByRole('button', { name: 'Confirmar' }).click();

  // agora pede a estrada
  const edges = ana.locator('g.hit:has(.edge-target)');
  await expect(edges.first()).toBeVisible();
  await edges.first().locator('line').last().click({ force: true });
  await expect(bar).toContainText('estrada');
  await dismiss.click();
  await expect(bar).toHaveCount(0);
  await edges.first().locator('line').last().click({ force: true });
  await bar.getByRole('button', { name: 'Confirmar' }).click();
  await expect(bar).toHaveCount(0);
  await expect(ana.locator('.catan-board')).toBeVisible();
  expect(errors).toEqual([]);
});
