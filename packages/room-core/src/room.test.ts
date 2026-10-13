import { describe, expect, it } from 'vitest';
import type { BotStrategy, GameDefinition, PlayerTurn } from '@tablehub/game-sdk';
import { runConformance } from '@tablehub/game-sdk/testing';
import { AVATARS, defaultAvatar } from '@tablehub/shared';
import { BOT_NAMES, BOT_THINK_MS, createRoom, OWNER_GRACE_MS, ROOM_IDLE_TTL_MS, RoomService } from './room';
import { counterGame } from './testGame';

const svc = new RoomService({ counter: counterGame });

function lobby() {
  const room = createRoom('ABCDE', 0);
  svc.join(room, 'a', 'Ana', undefined, 0);
  svc.join(room, 'b', 'Beto', undefined, 0);
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
    svc.join(room, 'a', 'Ana', undefined, 0);
    svc.setGame(room, 'a', 'counter');
    expect(svc.startBlocker(room)).toMatch(/pelo menos 2/);
    for (const id of ['b', 'c', 'd']) {
      svc.join(room, id, id, undefined, 0);
      svc.setReady(room, id, true);
    }
    svc.setOptions(room, 'a', { fast: true });
    expect(svc.startBlocker(room)).toMatch(/até 3/);
  });

  it('bloqueia entrada com sala cheia ou partida em andamento', () => {
    const room = lobby();
    svc.join(room, 'c', 'c', undefined, 0);
    svc.join(room, 'd', 'd', undefined, 0);
    expect(svc.join(room, 'e', 'e', undefined, 0).ok).toBe(false);
    for (const id of ['b', 'c', 'd']) svc.setReady(room, id, true);
    svc.start(room, 'a', 1, 0);
    svc.disconnect(room, 'c', 1);
    expect(svc.join(room, 'c', 'c', undefined, 2).ok).toBe(true); // reconexão é permitida
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

  describe('avatares', () => {
    it('hello com avatar grava o avatar; a visão mostra para todos', () => {
      const room = createRoom('ABCDE', 0);
      svc.join(room, 'a', 'Ana', 'capivara', 0);
      expect(svc.toView(room).players[0].avatar).toBe('capivara');
    });

    it('cliente sem avatar recebe um padrão estável (o mesmo a cada reconexão)', () => {
      const room = createRoom('ABCDE', 0);
      svc.join(room, 'a', 'Ana', undefined, 0);
      const first = svc.toView(room).players[0].avatar;
      expect(AVATARS.some((x) => x.id === first)).toBe(true);
      expect(first).toBe(defaultAvatar('a'));
      svc.disconnect(room, 'a', 1);
      svc.join(room, 'a', 'Ana', undefined, 2);
      expect(svc.toView(room).players[0].avatar).toBe(first);
    });

    it('no lobby, rename troca o avatar; durante a partida a troca é recusada', () => {
      const room = lobby();
      expect(svc.rename(room, 'b', 'Beto', 'panda').ok).toBe(true);
      expect(svc.toView(room).players[1].avatar).toBe('panda');
      svc.setReady(room, 'b', true);
      svc.start(room, 'a', 1, 0);
      expect(svc.rename(room, 'b', 'Beto', 'sapo')).toEqual({ ok: false, error: 'Não é possível trocar o avatar durante a partida.' });
      expect(svc.rename(room, 'b', 'Beto', 'panda').ok).toBe(true); // mesmo avatar: só o nome
      expect(svc.rename(room, 'b', 'Betão').ok).toBe(true);
      svc.join(room, 'b', 'Beto', 'sapo', 5); // reconexão no meio da partida não troca o avatar
      expect(svc.toView(room).players[1].avatar).toBe('panda');
    });
  });

  describe('bots', () => {
    const seen: PlayerTurn[] = [];
    const counterBot: BotStrategy = {
      gameId: 'counter',
      chooseAction: (turn) => {
        seen.push(turn);
        return { type: 'add', n: 2 };
      },
    };
    const brokenBot: BotStrategy = { gameId: 'counter', chooseAction: () => ({ type: 'hack' }) };
    const botSvc = new RoomService({ counter: counterGame, other: { ...counterGame, id: 'other' } }, { counter: counterBot });

    function botLobby(svcToUse = botSvc) {
      const room = createRoom('ABCDE', 0);
      svcToUse.join(room, 'a', 'Ana', 'onca', 0);
      svcToUse.setGame(room, 'a', 'counter');
      return room;
    }

    it('só o dono adiciona bots, e só em jogos com estratégia', () => {
      const room = botLobby();
      expect(botSvc.addBot(room, 'b', 0, 1).ok).toBe(false);
      expect(botSvc.addBot(room, 'a', 0, 1).ok).toBe(true);
      expect(room.players[1]).toMatchObject({ id: 'bot-1', bot: true, ready: true, connected: true });
      expect(BOT_NAMES).toContain(room.players[1].name);
      expect(botSvc.toView(room).botsAvailable).toBe(true);
      expect(botSvc.toView(room).players[1].bot).toBe(true);
      const plain = botLobby(svc);
      expect(svc.addBot(plain, 'a', 0, 1)).toEqual({ ok: false, error: 'Este jogo ainda não tem bots.' });
    });

    it('respeita a capacidade e gera ids únicos; o dono remove bots', () => {
      const room = botLobby();
      for (let i = 0; i < 3; i++) expect(botSvc.addBot(room, 'a', 0, i).ok).toBe(true);
      expect(botSvc.addBot(room, 'a', 0, 9)).toEqual({ ok: false, error: 'A sala está cheia.' });
      expect(botSvc.kick(room, 'a', 'bot-2', 0).ok).toBe(true);
      botSvc.addBot(room, 'a', 0, 5);
      expect(room.players.map((p) => p.id)).toEqual(['a', 'bot-1', 'bot-3', 'bot-2']);
    });

    it('nomes e avatares dos bots são da lista, distintos entre si e dos humanos (nome sem acento/maiúsculas)', () => {
      const six: GameDefinition = { ...counterGame, id: 'six', maxPlayers: 6 } as GameDefinition;
      const s = new RoomService({ six }, { six: { ...counterBot, gameId: 'six' } });
      for (let seed = 1; seed <= 40; seed++) {
        const room = createRoom('ABCDE', 0);
        s.join(room, 'a', 'PÂULA', 'panda', 0);
        s.join(room, 'b', 'kélly', undefined, 0);
        s.setGame(room, 'a', 'six');
        for (let i = 0; i < 4; i++) expect(s.addBot(room, 'a', 0, seed * 10 + i).ok).toBe(true);
        const bots = room.players.filter((p) => p.bot);
        const names = bots.map((p) => p.name);
        expect(new Set(names).size).toBe(4);
        for (const n of names) expect(BOT_NAMES.filter((x) => x !== 'Paula' && x !== 'Kelly')).toContain(n);
        const avatars = s.toView(room).players.map((p) => p.avatar);
        expect(new Set(avatars).size).toBe(6);
      }
    });

    it('trocar para um jogo sem bots remove os bots', () => {
      const room = botLobby();
      botSvc.addBot(room, 'a', 0, 1);
      botSvc.setGame(room, 'a', 'other');
      expect(room.players.map((p) => p.id)).toEqual(['a']);
    });

    it('bots contam como prontos e continuam prontos depois da partida', () => {
      const room = botLobby();
      botSvc.addBot(room, 'a', 0, 1);
      expect(botSvc.startBlocker(room)).toBeNull();
      botSvc.start(room, 'a', 1, 0);
      botSvc.backToLobby(room, 'a');
      expect(room.players.find((p) => p.bot)!.ready).toBe(true);
    });

    it('bot joga na sua vez recebendo só a visão de jogador e as ações legais', () => {
      const room = botLobby();
      botSvc.addBot(room, 'a', 0, 1);
      botSvc.start(room, 'a', 1, 0);
      expect(botSvc.pendingBot(room)).toBeNull(); // vez da Ana
      botSvc.action(room, 'a', { type: 'add', n: 1 }, 0);
      expect(botSvc.pendingBot(room)).toBe('bot-1');
      seen.length = 0;
      expect(botSvc.playBot(room, 7, 0).ok).toBe(true);
      expect(room.game!.seq).toBe(2);
      expect(seen[0]).toMatchObject({ playerId: 'bot-1', legal: counterGame.getLegalActions(null as never, 'bot-1') });
      expect(botSvc.pendingBot(room)).toBeNull();
    });

    it('ação inválida da estratégia cai na primeira ação legal', () => {
      const s = new RoomService({ counter: counterGame }, { counter: brokenBot });
      const room = botLobby(s);
      s.addBot(room, 'a', 0, 1);
      s.start(room, 'a', 1, 0);
      s.action(room, 'a', { type: 'add', n: 1 }, 0);
      expect(s.playBot(room, 1, 0).ok).toBe(true);
      expect((room.game!.state as { scores: Record<string, number> }).scores['bot-1']).toBe(1);
    });

    it('bots esperam sem humanos conectados e não seguram a sala nem a posse', () => {
      const room = botLobby();
      svc.join(room, 'b', 'Beto', undefined, 0);
      botSvc.addBot(room, 'a', 0, 1);
      botSvc.setReady(room, 'b', true);
      botSvc.start(room, 'a', 1, 0);
      botSvc.action(room, 'a', { type: 'add', n: 1 }, 0);
      botSvc.action(room, 'b', { type: 'add', n: 1 }, 0);
      expect(botSvc.pendingBot(room)).toBe('bot-1');
      botSvc.disconnect(room, 'a', 10);
      botSvc.disconnect(room, 'b', 10);
      expect(botSvc.pendingBot(room)).toBeNull();
      expect(botSvc.botDue(room, 10, 1)).toBeNull();
      expect(botSvc.tick(room, 10 + OWNER_GRACE_MS).changed).toBe(false);
      expect(room.ownerId).toBe('a');
      expect(botSvc.tick(room, 10 + ROOM_IDLE_TTL_MS).expired).toBe(true);
      botSvc.leave(room, 'a', 20);
      botSvc.leave(room, 'b', 20);
      expect(room.ownerId).toBeNull();
    });

    it('bot não marca pronto pelo protocolo', () => {
      const room = botLobby();
      botSvc.addBot(room, 'a', 0, 1);
      expect(botSvc.setReady(room, 'bot-1', false).ok).toBe(false);
    });

    describe('tempo de pensar', () => {
      // "n: 1" mantém a vez (ação seguida), "n: 2" passa a vez
      const again: GameDefinition = {
        ...counterGame,
        id: 'again',
        applyAction(s: { players: string[]; turn: number; scores: Record<string, number>; target: number; winner: string | null }, pid: string, a: { type: string; n: number }) {
          s.scores[pid] += a.n;
          if (a.n === 2) s.turn = (s.turn + 1) % s.players.length;
          return s;
        },
      } as GameDefinition;
      const s = new RoomService({ again }, { again: { gameId: 'again', chooseAction: () => ({ type: 'add', n: 1 }) } });

      function started() {
        const room = createRoom('ABCDE', 0);
        s.join(room, 'a', 'Ana', undefined, 0);
        s.setGame(room, 'a', 'again');
        s.addBot(room, 'a', 0, 1);
        s.start(room, 'a', 1, 0);
        return room;
      }

      it('primeira ação da vez: 1,2–2,5 s; ações seguidas do mesmo bot: 0,6–1 s', () => {
        const firsts: number[] = [];
        const nexts: number[] = [];
        for (let seed = 1; seed <= 200; seed++) {
          const room = started();
          expect(s.botDue(room, 1000, seed)).toBeNull(); // vez da Ana
          s.action(room, 'a', { type: 'add', n: 2 }, 1000);
          const due = s.botDue(room, 1000, seed)!;
          expect(s.botDue(room, 1500, seed + 1)).toBe(due); // sorteado uma vez por vez
          firsts.push(due - 1000);
          expect(s.playBot(room, seed, due).ok).toBe(true); // n: 1, a vez continua com o bot
          nexts.push(s.botDue(room, due, seed)! - due);
        }
        const [fMin, fMax] = BOT_THINK_MS.first;
        const [nMin, nMax] = BOT_THINK_MS.next;
        expect(Math.min(...firsts)).toBeGreaterThanOrEqual(fMin);
        expect(Math.max(...firsts)).toBeLessThanOrEqual(fMax);
        expect(Math.min(...nexts)).toBeGreaterThanOrEqual(nMin);
        expect(Math.max(...nexts)).toBeLessThanOrEqual(nMax);
        expect(new Set(firsts).size).toBeGreaterThan(50); // aleatório de verdade
        expect(fMin).toBe(1200);
        expect(fMax).toBe(2500);
        expect(nMin).toBe(600);
        expect(nMax).toBe(1000);
      });

      it('mesma semente, mesmo prazo', () => {
        const a = started();
        const b = started();
        s.action(a, 'a', { type: 'add', n: 2 }, 0);
        s.action(b, 'a', { type: 'add', n: 2 }, 0);
        expect(s.botDue(a, 0, 42)).toBe(s.botDue(b, 0, 42));
      });

      it('voltar ao lobby limpa o prazo', () => {
        const room = started();
        s.action(room, 'a', { type: 'add', n: 2 }, 0);
        s.botDue(room, 0, 1);
        s.backToLobby(room, 'a');
        expect(room.botDueAt).toBeNull();
      });
    });
  });

  it('o jogo de teste passa na bateria de conformidade', () => {
    const r = runConformance(counterGame, { requireFinish: true });
    expect(r.games).toBeGreaterThan(0);
  });
});
