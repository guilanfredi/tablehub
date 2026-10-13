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
  await expect(current.locator('.kot-board').getByText('Tóquio Cidade')).toBeVisible();
  await expect(current.locator('.kot-board').getByText('Tóquio Baía')).toHaveCount(0);
  await expect(current.locator('.kot-table .gt-seat')).toHaveCount(2);
  await expect(current.locator('.gt-seat [aria-label="Vida 10 de 10"]')).toHaveCount(2);
  await expect(current.locator('.kot-market img')).toHaveCount(3);
  await expect(current.locator('.kot-market img').first()).toHaveJSProperty('complete', true);
  await expect(current.getByRole('button', { name: /Descartar e repor/ })).toBeDisabled();
  const over = await current.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over).toBeLessThanOrEqual(1);

  // desktop: passar o mouse amplia a miniatura sem mexer no layout
  const mini = current.locator('.kot-market .kot-mini').first();
  if (await current.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches)) {
    const box = await mini.boundingBox();
    const imgBefore = (await mini.locator('img').boundingBox())!;
    await mini.hover();
    await expect.poll(async () => (await mini.locator('img').boundingBox())!.width).toBeGreaterThan(imgBefore.width * 2);
    expect(await mini.boundingBox()).toEqual(box);
    await current.mouse.move(0, 0);
  }

  await current.getByRole('button', { name: 'Rolar dados' }).click();
  await expect(current.locator('.kot-dice .kot-die')).toHaveCount(6);
  await current.locator('.kot-die').first().click();
  await expect(current.locator('.kot-die.kept')).toHaveCount(1);
  await current.getByRole('button', { name: 'Parar e resolver' }).click();

  // ninguém em Tóquio: o jogador da vez entra na Cidade
  await expect(current.locator('.kot-board .kot-portrait')).toHaveCount(1);
  // tocar na miniatura abre a carta grande, com o botão de comprar
  await mini.click();
  await expect(current.locator('.kot-zoom img')).toBeVisible();
  await expect(current.locator('.kot-zoom').getByRole('button', { name: /^Comprar/ })).toBeVisible();
  await current.locator('.kot-zoom').getByRole('button', { name: 'Fechar' }).click();
  await current.getByRole('button', { name: 'Encerrar turno' }).click();

  const other = current === ana ? beto : ana;
  await expect(other.getByRole('button', { name: 'Rolar dados' })).toBeVisible();
  expect(errors).toEqual([]);
});
