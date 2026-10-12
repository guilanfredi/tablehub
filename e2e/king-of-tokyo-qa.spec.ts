import { expect, test, type Page } from '@playwright/test';
import { chooseGame, createRoom, failOnConsoleErrors, joinRoom, newPlayer, setReady, startGame } from './helpers';

/** Frames recebidos do servidor; usados para conferir que a ordem do baralho nunca vaza. */
function captureFrames(page: Page): string[] {
  const frames: string[] = [];
  page.on('websocket', (ws) => ws.on('framereceived', (f) => typeof f.payload === 'string' && frames.push(f.payload)));
  return frames;
}

const ORDER = ['Ficar', 'Não usar', 'Deixar', 'Usar o resto em mim', 'Confirmar', 'Nenhuma por enquanto', 'Rolar dados', 'Rolar de novo', 'Parar e resolver'];

/** Faz uma ação de quem estiver com a vez. Compra a primeira carta possível (exercita janelas). */
async function step(pages: Page[], buy: boolean): Promise<boolean> {
  for (let tries = 0; tries < 40; tries++) {
    for (const p of pages) {
      if (await p.locator('.result-card').count()) return false;
      if (!(await p.locator('.status-pill.my-turn').count())) continue;
      const before = await p.locator('.kot-log').innerText();
      const enabled = await p.locator('button:enabled:visible').allInnerTexts();
      const has = (t: string) => enabled.some((x) => x.trim() === t);
      let clicked = false;
      for (const name of ORDER) {
        if (!has(name)) continue;
        // rola no máximo 2 vezes para a partida andar rápido; guarda as garras
        if (name === 'Rolar de novo') {
          if ((await p.locator('.kot-dice-head .muted').first().innerText()).startsWith('rolagem 2')) continue;
          const dice = p.locator('.kot-dice .kot-die[aria-label*="garra"]:not(.kept)');
          for (let i = (await dice.count()) - 1; i >= 0; i--) await dice.nth(i).click();
        }
        await p.getByRole('button', { name, exact: true }).first().click();
        clicked = true;
        break;
      }
      if (!clicked && buy) {
        const buyBtn = p.locator('.kot-market-slot button:enabled', { hasText: 'Comprar' }).first();
        if (await buyBtn.count()) {
          await buyBtn.click();
          clicked = true;
        }
      }
      if (!clicked && has('Encerrar turno')) {
        await p.getByRole('button', { name: 'Encerrar turno' }).click();
        clicked = true;
      }
      if (clicked) {
        await expect.poll(async () => (await p.locator('.result-card').count()) > 0 || (await p.locator('.kot-log').innerText()) !== before || !(await p.locator('.status-pill.my-turn').count())).toBe(true);
        return true;
      }
    }
    await pages[0].waitForTimeout(150);
  }
  throw new Error('Ninguém consegue agir');
}

async function playToEnd(pages: Page[], buy: boolean, maxSteps = 600) {
  for (let i = 0; i < maxSteps; i++) if (!(await step(pages, buy))) return;
  throw new Error('A partida não terminou');
}

async function noHorizontalScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over).toBeLessThanOrEqual(1);
}

test('king of tokyo QA: lobby, partida completa sem cartas, fim de jogo', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const beto = await newPlayer(browser, 'Beto');
  const errors = [...failOnConsoleErrors(ana), ...failOnConsoleErrors(beto)];
  const code = await createRoom(ana);
  await joinRoom(beto, code);
  await chooseGame(ana, 'King of Tokyo');
  await expect(ana.getByLabel('Cartas de Poder')).toBeChecked();
  await expect(ana.getByText(/Vence quem chegar a 20 PV/)).toBeVisible();
  await ana.getByLabel('Cartas de Poder').click();
  await expect(ana.getByLabel('Cartas de Poder')).not.toBeChecked();
  await expect(beto.getByText('Sem cartas de Poder: partida só com dados.')).toBeVisible();
  await setReady(beto);
  await startGame(ana);
  await expect(ana.getByText('Cartas de Poder', { exact: true })).toHaveCount(0);
  await noHorizontalScroll(ana);

  await playToEnd([ana, beto], false);
  for (const p of [ana, beto]) await expect(p.locator('.result-card')).toBeVisible();
  const won = (await ana.getByText('Você venceu! 🎉').count()) + (await beto.getByText('Você venceu! 🎉').count());
  expect(won).toBe(1);
  await ana.getByRole('button', { name: 'Voltar à sala' }).click();
  await expect(ana.getByRole('heading', { name: 'Regras desta partida' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('king of tokyo QA: 3 jogadores com cartas até o fim, sem vazar o baralho, com recarga', async ({ browser }) => {
  test.setTimeout(480_000);
  const ana = await newPlayer(browser, 'Ana');
  const beto = await newPlayer(browser, 'Beto');
  const caio = await newPlayer(browser, 'Caio');
  const errors = [...failOnConsoleErrors(ana), ...failOnConsoleErrors(beto), ...failOnConsoleErrors(caio)];
  const frames = [...[ana, beto, caio].map(captureFrames)];
  const code = await createRoom(ana);
  await joinRoom(beto, code);
  await joinRoom(caio, code);
  await chooseGame(ana, 'King of Tokyo');
  await setReady(beto);
  await setReady(caio);
  await startGame(ana);
  await expect(ana.locator('.kot-market img')).toHaveCount(3);

  for (let i = 0; i < 25; i++) await step([ana, beto, caio], true);
  await beto.reload();
  await expect(beto.locator('.kot-monsters .kot-monster')).toHaveCount(3);
  await noHorizontalScroll(beto);

  await playToEnd([ana, beto, caio], true, 1500);
  for (const p of [ana, beto, caio]) await expect(p.locator('.result-card')).toBeVisible();
  for (const f of frames) {
    for (const payload of f) {
      expect(payload).not.toMatch(/"deck":\[/);
      expect(payload).not.toMatch(/"rng":/);
      expect(payload).not.toMatch(/"queue":/);
    }
  }
  expect(errors).toEqual([]);
});

test('king of tokyo QA: dono encerra a partida', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const beto = await newPlayer(browser, 'Beto');
  const code = await createRoom(ana);
  await joinRoom(beto, code);
  await chooseGame(ana, 'King of Tokyo');
  await setReady(beto);
  await startGame(ana);
  ana.on('dialog', (d) => d.accept());
  await ana.getByRole('button', { name: 'Encerrar' }).click();
  await expect(beto.getByRole('heading', { name: 'Regras desta partida' })).toBeVisible();
});
