import { describe, expect, it } from 'vitest';
import { Rng, type GameOptions } from '@tablehub/game-sdk';
import { GAMES } from '@tablehub/games';
import { createRoom, RoomService } from '@tablehub/room-core';
import type { DominoView } from '@tablehub/games/domino/engine';
import type { TrucoView } from '@tablehub/games/truco-paulista/engine';
import { BOTS, dominoBot, trucoBot } from './index';

const svc = new RoomService(GAMES, BOTS);

/** Um humano (que joga a primeira ação legal) contra bots, até o fim da partida. */
function playWithBots(gameId: string, bots: number, options: GameOptions, seed: number) {
  const room = createRoom('ABCDE', 0);
  svc.join(room, 'h', 'Humano', undefined, 0);
  svc.setGame(room, 'h', gameId);
  svc.setOptions(room, 'h', options);
  for (let i = 0; i < bots; i++) expect(svc.addBot(room, 'h', 0, seed + i).ok).toBe(true);
  expect(svc.start(room, 'h', seed, 0)).toEqual({ ok: true });
  let steps = 0;
  while (room.status === 'playing' && steps++ < 20_000) {
    const botId = svc.pendingBot(room);
    if (botId) {
      // a estratégia escolhe sempre uma ação legal (sem depender do plano B da sala)
      const { view, status, legal } = svc.gameViewFor(room, botId)!;
      expect(legal).toContainEqual(BOTS[gameId].chooseAction({ playerId: botId, view, status, legal }, new Rng(seed + steps)));
      expect(svc.playBot(room, seed + steps, 0)).toEqual({ ok: true });
    } else {
      const legal = svc.gameViewFor(room, 'h')!.legal;
      expect(legal.length).toBeGreaterThan(0);
      expect(svc.action(room, 'h', legal[0], 0)).toEqual({ ok: true });
    }
  }
  return room;
}

describe('bots', () => {
  it('só há bots para Dominó e Truco', () => {
    expect(Object.keys(BOTS).sort()).toEqual(['domino', 'truco-paulista']);
    for (const bot of Object.values(BOTS)) expect(GAMES[bot.gameId]).toBeDefined();
  });

  it.each([
    ['domino', 1, { mode: 'bloqueio' }],
    ['domino', 3, { mode: 'compra', pointsToWin: 100 }],
    ['domino', 3, { teams: true }],
    ['truco-paulista', 1, {}],
    ['truco-paulista', 3, {}],
  ] as const)('%s com %i bot(s) termina a partida', (gameId, bots, options) => {
    for (const seed of [1, 2, 3]) {
      const room = playWithBots(gameId, bots, options, seed);
      expect(room.status).toBe('finished');
    }
  });

  it('dominó: joga a pedra mais pesada', () => {
    const legal = [
      { type: 'play', tile: [1, 2], side: 'left' },
      { type: 'play', tile: [3, 3], side: 'right' },
      { type: 'play', tile: [2, 4], side: 'left' },
    ] as const;
    const action = dominoBot.chooseAction({ playerId: 'x', view: {} as DominoView, status: { phase: 'playing', currentPlayers: ['x'] }, legal: legal.map((a) => ({ ...a, tile: [...a.tile] as [number, number] })) }, new Rng(1));
    expect(action).toMatchObject({ tile: [3, 3] });
  });

  it('truco: vence a vaza com a menor carta possível e corre sem cartas boas', () => {
    const view = {
      players: [
        { id: 'a', name: 'A', team: 0, cards: 3 },
        { id: 'b', name: 'B', team: 1, cards: 2 },
      ],
      me: 'a',
      myTeam: 0,
      myHand: [
        { rank: '3', suit: 'ouros' },
        { rank: 'K', suit: 'copas' },
        { rank: '4', suit: 'paus' },
      ],
      manilha: '5',
      current: [{ playerId: 'b', card: { rank: 'Q', suit: 'ouros' }, faceDown: false }],
      pending: null,
    } as unknown as TrucoView;
    const legal = [0, 1, 2].map((index) => ({ type: 'play' as const, index }));
    const turn = { playerId: 'a', view, status: { phase: 'playing' as const, currentPlayers: ['a'] }, legal };
    expect(trucoBot.chooseAction(turn, new Rng(1))).toEqual({ type: 'play', index: 1 });

    const weak = { ...view, myHand: [{ rank: '4', suit: 'paus' }, { rank: '6', suit: 'copas' }, { rank: 'Q', suit: 'espadas' }], pending: { team: 1, to: 3 } } as unknown as TrucoView;
    const answer = trucoBot.chooseAction({ ...turn, view: weak, legal: [{ type: 'accept' }, { type: 'run' }, { type: 'raise' }] }, new Rng(1));
    expect(answer).toEqual({ type: 'run' });
  });
});
