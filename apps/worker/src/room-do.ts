import { DurableObject } from 'cloudflare:workers';
import { randomSeed } from '@tablehub/game-sdk';
import { GAMES } from '@tablehub/games';
import { createRoom, OWNER_GRACE_MS, ROOM_IDLE_TTL_MS, RoomService, type Result, type RoomData } from '@tablehub/room-core';
import { clientMessageSchema, type ClientMessage, type ServerMessage } from '@tablehub/shared';
import type { Env } from './env';

const svc = new RoomService(GAMES);
const MAX_MESSAGE_BYTES = 16 * 1024;

interface Attachment {
  playerId: string | null;
}

export async function playerIdFromToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Uma instância por sala. Usa a WebSocket Hibernation API: enquanto ninguém manda mensagens,
 * o objeto pode ser descarregado da memória sem cobrança de duração; o estado fica no storage.
 *
 * Protocolo: o cliente conecta em /ws/:code e envia `hello` com token e apelido;
 * só então entra na sala e passa a receber o estado.
 */
export class RoomDurableObject extends DurableObject<Env> {
  private room: RoomData | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<RoomData>('room')) ?? null;
    });
    // ping/pong respondido pelo runtime, sem acordar o objeto
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }

  // ---------- RPC chamados pelo Worker ----------

  async init(code: string): Promise<boolean> {
    if (this.room) return false;
    this.room = createRoom(code, Date.now());
    await this.persist();
    return true;
  }

  async exists(): Promise<boolean> {
    return this.room !== null;
  }

  // ---------- WebSocket ----------

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Esperado WebSocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ playerId: null } satisfies Attachment);
    if (!this.room) this.fatal(server, 'Sala não encontrada.', 4404);
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (!this.room) return this.fatal(ws, 'Sala não encontrada.', 4404);
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    if (text.length > MAX_MESSAGE_BYTES) return this.sendTo(ws, { t: 'error', message: 'Mensagem grande demais.' });

    let msg: ClientMessage;
    try {
      const parsed = clientMessageSchema.safeParse(JSON.parse(text));
      if (!parsed.success) return this.sendTo(ws, { t: 'error', message: 'Mensagem inválida.' });
      msg = parsed.data;
    } catch {
      return this.sendTo(ws, { t: 'error', message: 'Mensagem inválida.' });
    }
    if (msg.t === 'ping') return this.sendTo(ws, { t: 'pong' });

    const att = ws.deserializeAttachment() as Attachment;
    if (msg.t === 'hello') return this.hello(ws, msg.token, msg.name);
    if (!att?.playerId) return this.sendTo(ws, { t: 'error', message: 'Identifique-se primeiro.' });

    const playerId = att.playerId;
    const room = this.room;
    const now = Date.now();
    let result: Result;
    switch (msg.t) {
      case 'setGame':
        result = svc.setGame(room, playerId, msg.gameId);
        break;
      case 'setOptions':
        result = svc.setOptions(room, playerId, msg.options);
        break;
      case 'movePlayer':
        result = svc.movePlayer(room, playerId, msg.playerId, msg.toIndex);
        break;
      case 'kick':
        result = svc.kick(room, playerId, msg.playerId, now);
        if (result.ok) this.dropPlayer(msg.playerId, { t: 'kicked' });
        break;
      case 'ready':
        result = svc.setReady(room, playerId, msg.ready);
        break;
      case 'start':
        result = svc.start(room, playerId, randomSeed(), now);
        break;
      case 'action':
        result = svc.action(room, playerId, msg.action, now);
        break;
      case 'backToLobby':
        result = svc.backToLobby(room, playerId);
        break;
      case 'rename':
        result = svc.rename(room, playerId, msg.name);
        break;
      case 'leave':
        result = svc.leave(room, playerId, now);
        if (result.ok) this.dropPlayer(playerId, null);
        break;
    }
    if (!result.ok) return this.sendTo(ws, { t: 'error', message: result.error });
    await this.commit();
  }

  private async hello(ws: WebSocket, token: string, name: string) {
    const room = this.room!;
    const playerId = await playerIdFromToken(token);
    const res = svc.join(room, playerId, name, Date.now());
    if (!res.ok) return this.fatal(ws, res.error, 4409);
    // fecha conexões antigas do mesmo jogador (outra aba/reconexão)
    for (const other of this.sockets(playerId)) {
      if (other === ws) continue;
      other.serializeAttachment({ playerId: null } satisfies Attachment);
      this.fatal(other, 'Você se conectou em outra aba.', 4001);
    }
    ws.serializeAttachment({ playerId } satisfies Attachment);
    await this.commit();
  }

  override async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    await this.handleDisconnect(ws);
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye');
    } catch {
      /* já fechado */
    }
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  private async handleDisconnect(ws: WebSocket) {
    if (!this.room) return;
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att?.playerId) return;
    ws.serializeAttachment({ playerId: null } satisfies Attachment);
    if (this.sockets(att.playerId).some((s) => s !== ws)) return;
    svc.disconnect(this.room, att.playerId, Date.now());
    await this.commit();
  }

  override async alarm(): Promise<void> {
    if (!this.room) return;
    const r = svc.tick(this.room, Date.now());
    if (r.expired) {
      for (const ws of this.ctx.getWebSockets()) this.fatal(ws, 'Sala expirada.', 4410);
      this.room = null;
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.commit();
  }

  // ---------- auxiliares ----------

  private sockets(playerId: string): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => (ws.deserializeAttachment() as Attachment | null)?.playerId === playerId);
  }

  private fatal(ws: WebSocket, message: string, code: number) {
    this.sendTo(ws, { t: 'error', message, fatal: true });
    try {
      ws.close(code, message.slice(0, 100));
    } catch {
      /* já fechado */
    }
  }

  private dropPlayer(playerId: string, msg: ServerMessage | null) {
    for (const ws of this.sockets(playerId)) {
      ws.serializeAttachment({ playerId: null } satisfies Attachment);
      if (msg) this.sendTo(ws, msg);
      try {
        ws.close(4000, 'Saiu da sala');
      } catch {
        /* já fechado */
      }
    }
  }

  private sendTo(ws: WebSocket, msg: ServerMessage) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* conexão encerrada */
    }
  }

  private async persist() {
    if (this.room) await this.ctx.storage.put('room', this.room);
    await this.scheduleAlarm();
  }

  /** Salva, agenda manutenção e envia o estado atualizado a todos. */
  private async commit() {
    await this.persist();
    this.broadcast();
  }

  private broadcast() {
    if (!this.room) return;
    const roomView = svc.toView(this.room);
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (!att?.playerId) continue;
      this.sendTo(ws, { t: 'room', room: roomView, you: att.playerId });
      const gv = svc.gameViewFor(this.room, att.playerId);
      if (gv) this.sendTo(ws, { t: 'game', ...gv });
    }
  }

  private async scheduleAlarm() {
    const room = this.room;
    if (!room) return;
    const connected = room.players.filter((p) => p.connected);
    let next: number | null = null;
    if (connected.length === 0) next = room.updatedAt + ROOM_IDLE_TTL_MS;
    else {
      const owner = room.players.find((p) => p.id === room.ownerId);
      if (owner && !owner.connected && owner.disconnectedAt) next = owner.disconnectedAt + OWNER_GRACE_MS;
      const stale = room.players.filter((p) => !p.connected && p.disconnectedAt).map((p) => p.disconnectedAt! + ROOM_IDLE_TTL_MS);
      if (room.status === 'lobby' && stale.length) next = Math.min(next ?? Infinity, ...stale);
    }
    if (next === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(Math.max(next, Date.now() + 1000));
  }
}
