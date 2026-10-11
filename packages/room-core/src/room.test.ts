import { describe, expect, it } from 'vitest';
import { runConformance } from '@tablehub/game-sdk/testing';
import { createRoom, OWNER_GRACE_MS, ROOM_IDLE_TTL_MS, RoomService } from './room';
import { counterGame } from './testGame';

const svc = new RoomService({ counter: counterGame });

function lobby() {
  const room = createRoom('ABCDE', 0);
  svc.join(room, 'a', 'Ana', 0);
  svc.join(room, 'b', 'Beto', 0);
  svc.setGame(room, 'a', 'counter');
  return room;
}

describe('RoomService', () => {
  it('primeiro a entrar vira dono', () => {
    const room = lobby();
    expect(room.ownerId).toBe('a');
    expect(room.players.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('só o dono escolhe jogo e opções', () => {
    const room = lobby();
    expect(svc.setOptions(room, 'b', { target: 10 }).ok).toBe(false);
    expect(svc.setGame(room, 'b', null).ok).toBe(false);
    expect(svc.setOptions(room, 'a', { target: 10 }).ok).toBe(true);
    expect(room.options.target).toBe(10);
  });

  it('normaliza opções (limites e chaves desconhecidas)', () => {
    const room = lobby();
    svc.setOptions(room, 'a', { target: 999, hack: 'x' });
    expect(room.options).toEqual({ target: 20, fast: false });
  });

  it('mudar opções NÃO desmarca pronto, mas registra a mudança', () => {
    const room = lobby();
    svc.setReady(room, 'b', true);
    const v = room.optionsVersion;
    svc.setOptions(room, 'a', { target: 8 });
    const b = room.players.find((p) => p.id === 'b')!;
    expect(b.ready).toBe(true);
    expect(b.readyAtVersion).toBe(v);
    expect(room.optionsVersion).toBe(v + 1);
    expect(room.lastChange?.keys).toEqual(['target']);
  });

  it('iniciar exige todos prontos (exceto o dono)', () => {
    const room = lobby();
    expect(svc.start(room, 'a', 1, 0)).toEqual({ ok: false, error: 'Aguardando: Beto.' });
    svc.setReady(room, 'b', true);
    expect(svc.start(room, 'b', 1, 0).ok).toBe(false); // não é dono
    expect(svc.start(room, 'a', 1, 0).ok).toBe(true);
    expect(room.status).toBe('playing');
  });

  it('valida número de jogadores e configuração do jogo', () => {
    const room = createRoom('ABCDE', 0);
    svc.join(room, 'a', 'Ana', 0);
    svc.setGame(room, 'a', 'counter');
    expect(svc.startBlocker(room)).toMatch(/pelo menos 2/);
    for (const id of ['b', 'c', 'd']) {
      svc.join(room, id, id, 0);
      svc.setReady(room, id, true);
    }
    svc.setOptions(room, 'a', { fast: true });
    expect(svc.startBlocker(room)).toMatch(/até 3/);
  });

  it('bloqueia entrada com sala cheia ou partida em andamento', () => {
    const room = lobby();
    svc.join(room, 'c', 'c', 0);
    svc.join(room, 'd', 'd', 0);
    expect(svc.join(room, 'e', 'e', 0).ok).toBe(false);
    for (const id of ['b', 'c', 'd']) svc.setReady(room, id, true);
    svc.start(room, 'a', 1, 0);
    svc.disconnect(room, 'c', 1);
    expect(svc.join(room, 'c', 'c', 2).ok).toBe(true); // reconexão é permitida
  });

  it('ações passam pelo jogo e a partida termina', () => {
    const room = lobby();
    svc.setReady(room, 'b', true);
    svc.start(room, 'a', 1, 0);
    expect(svc.action(room, 'b', { type: 'add', n: 1 }, 0)).toEqual({ ok: false, error: 'Não é a sua vez.' });
    for (let i = 0; i < 20 && room.status === 'playing'; i++) {
      const cur = svc.gameViewFor(room, 'a')!.status.currentPlayers[0];
      expect(svc.action(room, cur, { type: 'add', n: 2 }, 0).ok).toBe(true);
    }
    expect(room.status).toBe('finished');
    expect(room.lastResult?.winners.length).toBe(1);
    svc.backToLobby(room, 'b');
    expect(room.status).toBe('lobby');
    expect(room.players.every((p) => !p.ready)).toBe(true);
  });

  it('dono que sai transfere a posse; saída durante a partida encerra o jogo', () => {
    const room = lobby();
    svc.setReady(room, 'b', true);
    svc.start(room, 'a', 1, 0);
    svc.leave(room, 'a', 5);
    expect(room.ownerId).toBe('b');
    expect(room.status).toBe('lobby');
    expect(room.lastResult?.aborted).toBe(true);
  });

  it('dono desconectado perde a posse após o tempo de carência', () => {
    const room = lobby();
    svc.disconnect(room, 'a', 1000);
    expect(svc.tick(room, 1000 + OWNER_GRACE_MS - 1).changed).toBe(false);
    const t = svc.tick(room, 1000 + OWNER_GRACE_MS);
    expect(t.changed).toBe(true);
    expect(room.ownerId).toBe('b');
  });

  it('sala sem ninguém conectado expira', () => {
    const room = lobby();
    svc.disconnect(room, 'a', 10);
    svc.disconnect(room, 'b', 10);
    expect(svc.tick(room, 10 + ROOM_IDLE_TTL_MS - 1).expired).toBe(false);
    expect(svc.tick(room, 10 + ROOM_IDLE_TTL_MS).expired).toBe(true);
  });

  it('visão do jogo só traz ações legais para quem está na vez', () => {
    const room = lobby();
    svc.setReady(room, 'b', true);
    svc.start(room, 'a', 1, 0);
    const cur = svc.gameViewFor(room, 'a')!.status.currentPlayers[0];
    const other = cur === 'a' ? 'b' : 'a';
    expect(svc.gameViewFor(room, cur)!.legal.length).toBe(2);
    expect(svc.gameViewFor(room, other)!.legal.length).toBe(0);
  });

  it('o jogo de teste passa na bateria de conformidade', () => {
    const r = runConformance(counterGame, { requireFinish: true });
    expect(r.games).toBeGreaterThan(0);
  });
});
