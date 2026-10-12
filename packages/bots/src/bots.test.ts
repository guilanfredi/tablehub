import { describe, expect, it } from 'vitest';
import { Rng, type GameOptions } from '@tablehub/game-sdk';
import { GAMES } from '@tablehub/games';
import { createRoom, RoomService } from '@tablehub/room-core';
import type { DominoView } from '@tablehub/games/domino/engine';
import type { TrucoView } from '@tablehub/games/truco-paulista/engine';
import type { CatanView } from '@tablehub/games/catan/engine';
import type { KingOfTokyoView } from '@tablehub/games/king-of-tokyo/engine';
import { BOTS, catanBot, dominoBot, kingOfTokyoBot, trucoBot } from './index';

const svc = new RoomService(GAMES, BOTS);

/** Um humano (que joga a primeira ação legal) contra bots, até o fim da partida. */
function playWithBots(gameId: string, bots: number, options: GameOptions, seed: number) {
  const room = createRoom('ABCDE', 0);
  svc.join(room, 'h', 'Humano', 0);
  svc.setGame(room, 'h', gameId);
  svc.setOptions(room, 'h', options);
  for (let i = 0; i < bots; i++) expect(svc.addBot(room, 'h', 0).ok).toBe(true);
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
  it('todos os jogos têm bots', () => {
    expect(Object.keys(BOTS).sort()).toEqual(Object.keys(GAMES).sort());
    for (const bot of Object.values(BOTS)) expect(GAMES[bot.gameId]).toBeDefined();
  });

  it.each([
    ['domino', 1, { mode: 'bloqueio' }],
    ['domino', 3, { mode: 'compra', pointsToWin: 100 }],
    ['domino', 3, { teams: true }],
    ['truco-paulista', 1, {}],
    ['truco-paulista', 3, {}],
    ['catan', 2, { board: 'beginner', vpToWin: 10, discardLimit: 7 }],
    ['catan', 3, { board: 'random', vpToWin: 8, discardLimit: 7 }],
    ['king-of-tokyo', 1, { powerCards: true }],
    ['king-of-tokyo', 5, { powerCards: true }],
    ['king-of-tokyo', 3, { powerCards: false }],
  ] as const)('%s com %i bot(s) termina a partida', (gameId, bots, options) => {
    for (const seed of [1, 2, 3]) {
      const room = playWithBots(gameId, bots, options, seed);
      expect(room.status).toBe('finished');
    }
  });

  it.each(['catan', 'king-of-tokyo'])('%s: bots vencem um humano que só passa a vez', (gameId) => {
    for (const seed of [1, 2, 3]) {
      const room = playWithBots(gameId, 2, {}, seed);
      const winners = svc.gameViewFor(room, 'h')!.status.winners ?? [];
      expect(winners.length).toBeGreaterThan(0);
      expect(winners).not.toContain('h');
    }
  });

  it('catan: aceita troca que completa o objetivo e recusa a que não ajuda', () => {
    const room = playWithBots('catan', 2, {}, 1);
    const view = { ...(svc.gameViewFor(room, 'bot-1')!.view as CatanView) };
    const hand = { brick: 1, lumber: 0, wool: 1, grain: 3, ore: 0 };
    view.myHand = hand;
    // sem cidade possível: o objetivo vira aldeia (ou estrada); madeira sempre ajuda
    view.buildings = Object.fromEntries(Object.entries(view.buildings).map(([k, b]) => [k, { ...b, kind: b.owner === 'bot-1' ? 'city' : b.kind }]));
    view.players = view.players.map((p) => ({ ...p, publicVp: 2 }));
    const legal = [{ type: 'respondTrade', accept: false }, { type: 'respondTrade', accept: true }] as const;
    const turn = (give: Record<string, number>, get: Record<string, number>) => ({
      playerId: 'bot-1',
      view: { ...view, trade: { from: 'h', give, get, responses: { 'bot-1': null } } },
      status: { phase: 'playing' as const, currentPlayers: ['h', 'bot-1'] },
      legal: legal.map((a) => ({ ...a })),
    });
    expect(catanBot.chooseAction(turn({ lumber: 1 }, { grain: 1 }), new Rng(1))).toEqual({ type: 'respondTrade', accept: true });
    expect(catanBot.chooseAction(turn({ ore: 1 }, { brick: 1 }), new Rng(1))).toEqual({ type: 'respondTrade', accept: false });
  });

  it('king of tokyo: cede Tóquio com pouca Vida e fica com Vida sobrando', () => {
    const room = playWithBots('king-of-tokyo', 1, {}, 1);
    const base = svc.gameViewFor(room, 'bot-1')!.view as KingOfTokyoView;
    const turn = (hp: number) => ({
      playerId: 'bot-1',
      view: { ...base, monsters: { ...base.monsters, 'bot-1': { ...base.monsters['bot-1'], hp, place: 'city' as const } }, pending: { type: 'yield' as const, players: ['bot-1'] } },
      status: { phase: 'playing' as const, currentPlayers: ['bot-1'] },
      legal: [{ type: 'yield' as const, leave: true }, { type: 'yield' as const, leave: false }],
    });
    expect(kingOfTokyoBot.chooseAction(turn(3), new Rng(1))).toEqual({ type: 'yield', leave: true });
    expect(kingOfTokyoBot.chooseAction(turn(9), new Rng(1))).toEqual({ type: 'yield', leave: false });
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
