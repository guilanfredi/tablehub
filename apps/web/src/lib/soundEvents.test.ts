import { describe, expect, it } from 'vitest';
import type { GameStatusView, RoomPlayerView, RoomView } from '@tablehub/shared';
import { gameSounds, roomSounds } from './soundEvents';

const player = (id: string, ready = false): RoomPlayerView => ({ id, name: id, ready, readyAtVersion: 0, connected: true, bot: false });

function room(players: RoomPlayerView[], status: RoomView['status'] = 'lobby'): RoomView {
  return {
    code: 'ABCDE',
    ownerId: 'eu',
    players,
    gameId: 'domino',
    options: {},
    optionsVersion: 0,
    lastChange: null,
    status,
    lastResult: null,
    botsAvailable: false,
  };
}

const status = (currentPlayers: string[], extra: Partial<GameStatusView> = {}): GameStatusView => ({ phase: 'playing', currentPlayers, ...extra });
const game = (seq: number, s: GameStatusView) => ({ gameId: 'domino', seq, status: s });

describe('roomSounds', () => {
  it('não toca nada ao entrar na sala', () => {
    expect(roomSounds(null, room([player('eu'), player('ana')]), 'eu')).toEqual([]);
  });

  it('toca ao outro jogador entrar e sair', () => {
    const a = room([player('eu')]);
    const b = room([player('eu'), player('ana')]);
    expect(roomSounds(a, b, 'eu')).toEqual(['join']);
    expect(roomSounds(b, a, 'eu')).toEqual(['leave']);
  });

  it('toca quando outro jogador fica pronto, mas não quando eu fico', () => {
    const a = room([player('eu'), player('ana')]);
    expect(roomSounds(a, room([player('eu'), player('ana', true)]), 'eu')).toEqual(['ready']);
    expect(roomSounds(a, room([player('eu', true), player('ana')]), 'eu')).toEqual([]);
  });

  it('toca ao começar a partida', () => {
    const a = room([player('eu', true), player('ana', true)]);
    expect(roomSounds(a, room(a.players, 'playing'), 'eu')).toEqual(['start']);
  });
});

describe('gameSounds', () => {
  it('não toca no primeiro estado nem em estado repetido', () => {
    const g = game(1, status(['ana']));
    expect(gameSounds(null, g, 'eu')).toEqual([]);
    expect(gameSounds(g, g, 'eu')).toEqual([]);
  });

  it('distingue jogada comum de começo da minha vez', () => {
    expect(gameSounds(game(1, status(['ana'])), game(2, status(['bia'])), 'eu')).toEqual(['move']);
    expect(gameSounds(game(1, status(['ana'])), game(2, status(['eu'])), 'eu')).toEqual(['turn']);
    expect(gameSounds(game(1, status(['eu'])), game(2, status(['eu'])), 'eu')).toEqual(['move']);
  });

  it('toca vitória ou fim de partida', () => {
    const fim = (winners: string[]) => game(2, status([], { phase: 'finished', winners }));
    expect(gameSounds(game(1, status(['eu'])), fim(['eu']), 'eu')).toEqual(['win']);
    expect(gameSounds(game(1, status(['eu'])), fim(['ana']), 'eu')).toEqual(['end']);
  });
});
