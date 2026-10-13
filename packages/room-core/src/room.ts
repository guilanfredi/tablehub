import {
  checkPlayerCount,
  defaultOptions,
  isActionError,
  normalizeOptions,
  Rng,
  runAction,
  type BotRegistry,
  type GameDefinition,
  type GameOptions,
} from '@tablehub/game-sdk';
import {
  AVATARS,
  defaultAvatar,
  MAX_ROOM_PLAYERS,
  type GameLogView,
  type GameStatusView,
  type MatchResult,
  type OptionsChange,
  type RoomStatus,
  type RoomView,
} from '@tablehub/shared';

export type GameRegistry = Record<string, GameDefinition>;

/** Tempo que o dono pode ficar desconectado antes de perder a posse da sala. */
export const OWNER_GRACE_MS = 60_000;
/** Sala sem ninguém conectado é apagada após esse tempo. */
export const ROOM_IDLE_TTL_MS = 2 * 60 * 60_000;
/** Tempo de "pensar" do bot (ms): primeira ação da vez e ações seguidas do mesmo bot. */
export const BOT_THINK_MS = { first: [1200, 2500], next: [600, 1000] } as const;
/** Nomes dos bots, escolhidos pelo dono do produto. */
export const BOT_NAMES = ['Paula', 'Jacinto', 'Benjamin', 'Cuca', 'Kelly', 'Oscar', 'Simas', 'Giuseppe', 'Sujiro', 'Tati', 'Kevin'];

/** Nome comparável: sem acento, minúsculo e sem espaços nas pontas. */
const normName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

export interface RoomPlayer {
  id: string;
  name: string;
  /** Id de `AVATARS`; ausente em salas antigas/clientes antigos (usa `defaultAvatar`). */
  avatar?: string;
  ready: boolean;
  readyAtVersion: number;
  connected: boolean;
  disconnectedAt: number | null;
  /** Jogador controlado pelo servidor (estratégia em `@tablehub/bots`). */
  bot?: boolean;
}

export interface RoomGame {
  gameId: string;
  state: unknown;
  seq: number;
}

/** Estado completo e serializável de uma sala. */
export interface RoomData {
  code: string;
  createdAt: number;
  updatedAt: number;
  ownerId: string | null;
  players: RoomPlayer[];
  gameId: string | null;
  options: GameOptions;
  optionsVersion: number;
  lastChange: OptionsChange | null;
  status: RoomStatus;
  game: RoomGame | null;
  lastResult: MatchResult | null;
  /** Instante em que o bot da vez joga (sorteado uma vez por vez; ver `botDue`). */
  botDueAt?: number | null;
  /** Quem fez a última ação da partida (distingue ação seguida do mesmo bot). */
  lastActor?: string | null;
}

export type Result = { ok: true } | { ok: false; error: string };
const OK: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

export function createRoom(code: string, now: number): RoomData {
  return {
    code,
    createdAt: now,
    updatedAt: now,
    ownerId: null,
    players: [],
    gameId: null,
    options: {},
    optionsVersion: 0,
    lastChange: null,
    status: 'lobby',
    game: null,
    lastResult: null,
    botDueAt: null,
    lastActor: null,
  };
}

/**
 * Regras de sala/lobby, independentes de transporte (Cloudflare, Node...).
 * Todos os métodos mutam o `RoomData` recebido.
 */
export class RoomService {
  constructor(
    private readonly registry: GameRegistry,
    private readonly bots: BotRegistry = {},
  ) {}

  game(room: RoomData): GameDefinition | null {
    return room.gameId ? (this.registry[room.gameId] ?? null) : null;
  }

  private player(room: RoomData, id: string): RoomPlayer | undefined {
    return room.players.find((p) => p.id === id);
  }

  private isOwner(room: RoomData, id: string): boolean {
    return room.ownerId === id;
  }

  capacity(room: RoomData): number {
    const def = this.game(room);
    return def ? Math.min(def.maxPlayers, MAX_ROOM_PLAYERS) : MAX_ROOM_PLAYERS;
  }

  botsAvailable(room: RoomData): boolean {
    return room.gameId !== null && Boolean(this.bots[room.gameId]);
  }

  /** Adiciona um bot com nome e avatar sorteados entre os que ainda não estão em uso na sala. */
  addBot(room: RoomData, by: string, now: number, seed: number): Result {
    if (!this.isOwner(room, by)) return fail('Só o dono da sala pode adicionar bots.');
    if (room.status === 'playing') return fail('A partida está em andamento.');
    if (!this.botsAvailable(room)) return fail('Este jogo ainda não tem bots.');
    if (room.players.length >= this.capacity(room)) return fail('A sala está cheia.');
    let n = 1;
    while (room.players.some((p) => p.id === `bot-${n}`)) n++;
    const rng = new Rng(seed);
    const usedNames = new Set(room.players.map((p) => normName(p.name)));
    const freeNames = BOT_NAMES.filter((name) => !usedNames.has(normName(name)));
    const allAvatars = AVATARS.map((a) => a.id);
    const usedAvatars = new Set<string>(room.players.map((p) => p.avatar ?? defaultAvatar(p.id)));
    const freeAvatars = allAvatars.filter((a) => !usedAvatars.has(a));
    room.players.push({
      id: `bot-${n}`,
      name: freeNames.length ? rng.pick(freeNames) : `Bot ${n}`,
      avatar: rng.pick(freeAvatars.length ? freeAvatars : allAvatars),
      ready: true,
      readyAtVersion: room.optionsVersion,
      connected: true,
      disconnectedAt: null,
      bot: true,
    });
    room.updatedAt = now;
    return OK;
  }

  join(room: RoomData, id: string, name: string, avatar: string | undefined, now: number): Result {
    const existing = this.player(room, id);
    room.updatedAt = now;
    if (existing) {
      existing.name = name;
      // durante a partida o avatar não muda (só preenche quem ainda não tinha)
      if (avatar && (room.status !== 'playing' || !existing.avatar)) existing.avatar = avatar;
      existing.connected = true;
      existing.disconnectedAt = null;
      if (!room.ownerId) room.ownerId = id;
      return OK;
    }
    if (room.status === 'playing') return fail('A partida já começou nesta sala.');
    if (room.players.length >= this.capacity(room)) return fail('A sala está cheia.');
    room.players.push({ id, name, ...(avatar ? { avatar } : {}), ready: false, readyAtVersion: 0, connected: true, disconnectedAt: null });
    if (!room.ownerId) room.ownerId = id;
    return OK;
  }

  disconnect(room: RoomData, id: string, now: number): void {
    const p = this.player(room, id);
    if (!p) return;
    p.connected = false;
    p.disconnectedAt = now;
    room.updatedAt = now;
  }

  rename(room: RoomData, id: string, name: string, avatar?: string): Result {
    const p = this.player(room, id);
    if (!p) return fail('Você não está nesta sala.');
    if (avatar && avatar !== (p.avatar ?? defaultAvatar(p.id))) {
      if (room.status === 'playing') return fail('Não é possível trocar o avatar durante a partida.');
      p.avatar = avatar;
    }
    p.name = name;
    return OK;
  }

  leave(room: RoomData, id: string, now: number): Result {
    const idx = room.players.findIndex((p) => p.id === id);
    if (idx < 0) return fail('Você não está nesta sala.');
    const [left] = room.players.splice(idx, 1);
    room.updatedAt = now;
    if (room.ownerId === id) this.transferOwnership(room);
    if (room.status === 'playing' && room.game) {
      room.lastResult = {
        gameId: room.game.gameId,
        winners: [],
        aborted: true,
        message: `${left.name} saiu da sala e a partida foi encerrada.`,
      };
      this.resetToLobby(room);
    }
    return OK;
  }

  kick(room: RoomData, by: string, target: string, now: number): Result {
    if (!this.isOwner(room, by)) return fail('Só o dono da sala pode remover jogadores.');
    if (by === target) return fail('Você não pode remover a si mesmo.');
    if (room.status === 'playing') return fail('Não é possível remover jogadores durante a partida.');
    return this.leave(room, target, now);
  }

  private transferOwnership(room: RoomData): void {
    const humans = room.players.filter((p) => !p.bot);
    const next = humans.find((p) => p.connected) ?? humans[0];
    room.ownerId = next ? next.id : null;
  }

  setGame(room: RoomData, by: string, gameId: string | null): Result {
    if (!this.isOwner(room, by)) return fail('Só o dono da sala pode escolher o jogo.');
    if (room.status === 'playing') return fail('A partida está em andamento.');
    if (gameId !== null && !this.registry[gameId]) return fail('Jogo desconhecido.');
    if (room.gameId === gameId) return OK;
    room.gameId = gameId;
    room.options = gameId ? defaultOptions(this.registry[gameId].optionsSchema) : {};
    if (!this.botsAvailable(room)) room.players = room.players.filter((p) => !p.bot);
    this.bumpOptions(room, ['__game__']);
    if (room.status === 'finished') this.resetToLobby(room);
    return OK;
  }

  setOptions(room: RoomData, by: string, input: Record<string, unknown>): Result {
    if (!this.isOwner(room, by)) return fail('Só o dono da sala pode alterar as regras.');
    if (room.status === 'playing') return fail('A partida está em andamento.');
    const def = this.game(room);
    if (!def) return fail('Escolha um jogo primeiro.');
    const next = normalizeOptions(def.optionsSchema, { ...room.options, ...input });
    const changed = Object.keys(next).filter((k) => next[k] !== room.options[k]);
    if (changed.length === 0) return OK;
    room.options = next;
    // Decisão de produto: mudar regras NÃO desmarca "pronto"; a mudança fica destacada.
    this.bumpOptions(room, changed);
    return OK;
  }

  private bumpOptions(room: RoomData, keys: string[]): void {
    room.optionsVersion++;
    room.lastChange = { version: room.optionsVersion, keys, at: room.updatedAt };
  }

  movePlayer(room: RoomData, by: string, playerId: string, toIndex: number): Result {
    if (!this.isOwner(room, by)) return fail('Só o dono da sala pode trocar os lugares.');
    if (room.status === 'playing') return fail('A partida está em andamento.');
    const from = room.players.findIndex((p) => p.id === playerId);
    if (from < 0) return fail('Jogador não encontrado.');
    const to = Math.max(0, Math.min(room.players.length - 1, toIndex));
    const [p] = room.players.splice(from, 1);
    room.players.splice(to, 0, p);
    return OK;
  }

  setReady(room: RoomData, by: string, ready: boolean): Result {
    const p = this.player(room, by);
    if (!p || p.bot) return fail('Você não está nesta sala.');
    if (room.status === 'playing') return fail('A partida já começou.');
    p.ready = ready;
    p.readyAtVersion = room.optionsVersion;
    return OK;
  }

  /** Motivo pelo qual a partida não pode começar, ou null se pode. */
  startBlocker(room: RoomData): string | null {
    if (room.status === 'playing') return 'A partida já está em andamento.';
    const def = this.game(room);
    if (!def) return 'Escolha um jogo.';
    const countErr = checkPlayerCount(def, room.players.length);
    if (countErr) return countErr;
    const configErr = def.validateConfig(room.options, room.players.length);
    if (configErr) return configErr;
    const notReady = room.players.filter((p) => p.id !== room.ownerId && !p.ready);
    if (notReady.length > 0) return `Aguardando: ${notReady.map((p) => p.name).join(', ')}.`;
    return null;
  }

  start(room: RoomData, by: string, seed: number, now: number): Result {
    if (!this.isOwner(room, by)) return fail('Só o dono da sala pode iniciar a partida.');
    const blocker = this.startBlocker(room);
    if (blocker) return fail(blocker);
    const def = this.game(room)!;
    const players = room.players.map((p, seat) => ({ id: p.id, name: p.name, seat }));
    const state = def.setup({ players, options: room.options, seed });
    room.game = { gameId: def.id, state, seq: 0 };
    room.status = 'playing';
    room.botDueAt = null;
    room.lastActor = null;
    room.lastResult = null;
    room.updatedAt = now;
    return OK;
  }

  action(room: RoomData, by: string, action: unknown, now: number): Result {
    if (room.status !== 'playing' || !room.game) return fail('Nenhuma partida em andamento.');
    const def = this.registry[room.game.gameId];
    if (!def) return fail('Jogo indisponível.');
    const result = runAction(def, room.game.state, by, action);
    if (isActionError(result)) return fail(result.error);
    room.game.state = result;
    room.game.seq++;
    room.lastActor = by;
    room.botDueAt = null;
    room.updatedAt = now;
    const status = def.getStatus(result);
    if (status.phase === 'finished') {
      room.status = 'finished';
      room.lastResult = { gameId: def.id, winners: status.winners ?? [], scores: status.scores, message: status.message };
    }
    return OK;
  }

  backToLobby(room: RoomData, by: string): Result {
    if (room.status === 'lobby') return OK;
    if (room.status === 'playing' && !this.isOwner(room, by)) return fail('Só o dono pode encerrar a partida.');
    if (room.status === 'playing' && room.game) {
      room.lastResult = { gameId: room.game.gameId, winners: [], aborted: true, message: 'Partida encerrada pelo dono da sala.' };
    }
    this.resetToLobby(room);
    return OK;
  }

  private resetToLobby(room: RoomData): void {
    room.status = 'lobby';
    room.game = null;
    room.botDueAt = null;
    for (const p of room.players) p.ready = Boolean(p.bot);
  }

  /** Bot que deve agir agora, ou null. Bots esperam enquanto nenhum humano estiver conectado. */
  pendingBot(room: RoomData): string | null {
    if (room.status !== 'playing' || !room.game) return null;
    if (!room.players.some((p) => !p.bot && p.connected)) return null;
    const def = this.registry[room.game.gameId];
    if (!def || !this.bots[def.id]) return null;
    const current = def.getStatus(room.game.state).currentPlayers;
    return room.players.find((p) => p.bot && current.includes(p.id))?.id ?? null;
  }

  /**
   * Instante em que o bot da vez deve jogar, ou null se nenhum bot precisa jogar. O prazo é sorteado
   * uma vez por vez e fica em `botDueAt` até a próxima ação: primeira ação da vez em `BOT_THINK_MS.first`,
   * ação seguida do mesmo bot em `BOT_THINK_MS.next`.
   */
  botDue(room: RoomData, now: number, seed: number): number | null {
    const bot = this.pendingBot(room);
    if (!bot) {
      room.botDueAt = null;
      return null;
    }
    if (room.botDueAt == null) {
      const [min, max] = room.lastActor === bot ? BOT_THINK_MS.next : BOT_THINK_MS.first;
      room.botDueAt = now + min + new Rng(seed).int(max - min + 1);
    }
    return room.botDueAt;
  }

  /**
   * Faz um bot jogar. Ele recebe só o que um humano receberia (visão e ações legais) e a ação
   * passa pela mesma validação; se a estratégia falhar, joga a primeira ação legal.
   */
  playBot(room: RoomData, seed: number, now: number): Result {
    const botId = this.pendingBot(room);
    if (!botId) return fail('Nenhum bot precisa jogar agora.');
    const def = this.registry[room.game!.gameId];
    const state = room.game!.state;
    const legal = def.getLegalActions(state, botId);
    if (legal.length === 0) return fail('O bot não tem ações legais.');
    let action: unknown;
    try {
      const turn = { playerId: botId, view: def.getPlayerView(state, botId), status: def.getStatus(state), legal };
      action = this.bots[def.id].chooseAction(turn, new Rng(seed));
    } catch {
      action = legal[0];
    }
    const result = this.action(room, botId, action, now);
    return result.ok ? result : this.action(room, botId, legal[0], now);
  }

  /**
   * Manutenção periódica. Retorna `expired: true` quando a sala deve ser apagada e
   * `nextCheckAt` com o próximo instante em que vale rodar de novo.
   */
  tick(room: RoomData, now: number): { expired: boolean; changed: boolean; nextCheckAt: number | null } {
    let changed = false;
    // remove do lobby jogadores desconectados há muito tempo
    if (room.status === 'lobby') {
      const before = room.players.length;
      room.players = room.players.filter((p) => p.connected || !p.disconnectedAt || now - p.disconnectedAt < ROOM_IDLE_TTL_MS);
      if (room.players.length !== before) changed = true;
      if (room.ownerId && !room.players.some((p) => p.id === room.ownerId)) {
        this.transferOwnership(room);
        changed = true;
      }
    }
    const owner = room.ownerId ? this.player(room, room.ownerId) : undefined;
    if (owner && !owner.connected && owner.disconnectedAt && now - owner.disconnectedAt >= OWNER_GRACE_MS) {
      const next = room.players.find((p) => p.connected && !p.bot);
      if (next) {
        room.ownerId = next.id;
        changed = true;
      }
    }
    const anyoneConnected = room.players.some((p) => p.connected && !p.bot);
    if (!anyoneConnected && now - room.updatedAt >= ROOM_IDLE_TTL_MS) return { expired: true, changed, nextCheckAt: null };

    let nextCheckAt: number | null = null;
    if (!anyoneConnected) nextCheckAt = room.updatedAt + ROOM_IDLE_TTL_MS;
    const newOwner = room.ownerId ? this.player(room, room.ownerId) : undefined;
    if (newOwner && !newOwner.connected && newOwner.disconnectedAt && anyoneConnected) {
      nextCheckAt = newOwner.disconnectedAt + OWNER_GRACE_MS;
    }
    return { expired: false, changed, nextCheckAt };
  }

  toView(room: RoomData): RoomView {
    return {
      code: room.code,
      ownerId: room.ownerId,
      players: room.players.map(({ id, name, avatar, ready, readyAtVersion, connected, bot }) => ({
        id,
        name,
        avatar: avatar ?? defaultAvatar(id),
        ready,
        readyAtVersion,
        connected,
        bot: Boolean(bot),
      })),
      botsAvailable: this.botsAvailable(room),
      gameId: room.gameId,
      options: room.options,
      optionsVersion: room.optionsVersion,
      lastChange: room.lastChange,
      status: room.status,
      lastResult: room.lastResult,
    };
  }

  gameViewFor(
    room: RoomData,
    playerId: string,
  ): { gameId: string; seq: number; view: unknown; status: GameStatusView; legal: unknown[]; log?: GameLogView } | null {
    if (!room.game) return null;
    const def = this.registry[room.game.gameId];
    if (!def) return null;
    const isPlayer = room.players.some((p) => p.id === playerId);
    const state = room.game.state;
    const status = def.getStatus(state);
    return {
      gameId: def.id,
      seq: room.game.seq,
      view: def.getPlayerView(state, isPlayer ? playerId : null),
      status,
      legal: isPlayer && status.phase === 'playing' && status.currentPlayers.includes(playerId) ? def.getLegalActions(state, playerId) : [],
      // público por contrato: o mesmo para todos (inclusive espectadores)
      ...(def.getLog ? { log: def.getLog(state) } : {}),
    };
  }
}
