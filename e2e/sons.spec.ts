import { expect, test, type Page } from '@playwright/test';
import { chooseGame, createRoom, failOnConsoleErrors, joinRoom, newPlayer, setReady, startGame, whoseTurn } from './helpers';

/** Registra as notas tocadas (frequência de cada oscilador iniciado). */
async function recordNotes(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __notes: number[] };
    w.__notes = [];
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args: Parameters<typeof start>) {
      w.__notes.push(Math.round(this.frequency.value));
      return start.apply(this, args);
    };
  });
}
const notes = (page: Page) => page.evaluate(() => (window as unknown as { __notes: number[] }).__notes.splice(0));
const SOUND = {
  join: [440, 659],
  leave: [659, 440],
  ready: [880],
  start: [523, 659, 784],
  move: [659],
  turn: [523, 784],
};
const noHScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function playDomino(page: Page) {
  const tile = page.locator('.domino-hand-tile.playable').first();
  const fallback = page.getByRole('button', { name: /Comprar|Passar/ }).first();
  await expect(tile.or(fallback).first()).toBeVisible();
  if (await tile.isVisible()) {
    await tile.click();
    const side = page.getByRole('button', { name: /Esquerda/ });
    if (await side.isVisible({ timeout: 500 }).catch(() => false)) await side.click();
  } else {
    // sem peça jogável: compra ou passa
    await fallback.click();
  }
}

test('sons: entrada, pronto, início, jogada/vez, botão silenciar com preferência salva', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const beto = await newPlayer(browser, 'Beto');
  await recordNotes(ana);
  await recordNotes(beto);
  const errors = [...failOnConsoleErrors(ana)];
  const errorsB = failOnConsoleErrors(beto);

  const code = await createRoom(ana); // clique libera o áudio da Ana
  const toggle = ana.getByRole('button', { name: 'Desativar sons' });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await notes(ana);

  await joinRoom(beto, code);
  await expect(ana.locator('.player-item', { hasText: 'Beto' })).toBeVisible();
  await expect.poll(() => notes(ana)).toEqual(SOUND.join);

  await chooseGame(ana, 'Dominó');
  await beto.locator('body').click({ position: { x: 5, y: 5 } }); // libera o áudio do Beto
  await setReady(beto);
  await expect.poll(() => notes(ana)).toEqual(SOUND.ready);
  expect(await notes(beto)).toEqual([]); // o próprio pronto não toca

  await startGame(ana);
  await expect.poll(() => notes(ana)).toEqual(SOUND.start);
  await expect.poll(() => notes(beto)).toEqual(SOUND.start);

  // uma jogada: quem joga ouve "move"; o outro ouve "turn" (se a vez passou para ele)
  const first = await whoseTurn([ana, beto]);
  const other = first === ana ? beto : ana;
  await playDomino(first);
  await expect(other.locator('.status-pill.my-turn')).toBeVisible();
  await expect.poll(() => notes(other)).toEqual(SOUND.turn);
  expect(await notes(first)).toEqual(SOUND.move);

  // silenciar: nada mais toca e a preferência sobrevive à recarga
  await ana.getByRole('button', { name: 'Desativar sons' }).click();
  await expect(ana.getByRole('button', { name: 'Ativar sons' })).toHaveAttribute('aria-pressed', 'false');
  await notes(ana);
  const next = await whoseTurn([ana, beto]);
  await playDomino(next);
  await ana.waitForTimeout(500);
  expect(await notes(ana)).toEqual([]);
  await ana.reload();
  await expect(ana.getByRole('button', { name: 'Ativar sons' })).toBeVisible();

  // reativar toca um aviso curto
  await ana.getByRole('button', { name: 'Ativar sons' }).click();
  await expect.poll(() => notes(ana)).toEqual(SOUND.ready);

  expect(await noHScroll(ana)).toBe(true);
  expect(errors).toEqual([]);
  expect(errorsB).toEqual([]);
});

test('sons: jogador removido toca "saída" para quem fica', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const beto = await newPlayer(browser, 'Beto');
  await recordNotes(ana);
  ana.on('dialog', (d) => d.accept());
  const code = await createRoom(ana);
  await joinRoom(beto, code);
  await expect.poll(() => notes(ana)).toEqual(SOUND.join);
  await ana.getByRole('button', { name: 'Remover Beto' }).click();
  await expect(ana.locator('.player-item', { hasText: 'Beto' })).toHaveCount(0);
  await expect.poll(() => notes(ana)).toEqual(SOUND.leave);
});
