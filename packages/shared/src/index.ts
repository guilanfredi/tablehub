import { z } from 'zod';

export const NAME_MAX = 20;
export const ROOM_CODE_LENGTH = 5;
/** Alfabeto sem caracteres ambíguos (0/O, 1/I/L). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const MAX_ROOM_PLAYERS = 8;

export const playerNameSchema = z
  .string()
  .trim()
  .min(1, 'Informe um apelido')
  .max(NAME_MAX, `Máximo de ${NAME_MAX} caracteres`);

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidRoomCode(code: string): boolean {
  return code.length === ROOM_CODE_LENGTH && [...code].every((c) => ROOM_CODE_ALPHABET.includes(c));
}

const optionValue = z.union([z.string().max(100), z.number(), z.boolean()]);

/** Mensagens do cliente para o servidor (WebSocket). */
export const clientMessageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('setGame'), gameId: z.string().max(40).nullable() }),
  z.object({ t: z.literal('setOptions'), options: z.record(z.string(), optionValue) }),
  z.object({ t: z.literal('movePlayer'), playerId: z.string().max(64), toIndex: z.number().int().min(0).max(MAX_ROOM_PLAYERS) }),
  z.object({ t: z.literal('kick'), playerId: z.string().max(64) }),
  z.object({ t: z.literal('ready'), ready: z.boolean() }),
  z.object({ t: z.literal('start') }),
  z.object({ t: z.literal('action'), action: z.object({ type: z.string().max(40) }).passthrough() }),
  z.object({ t: z.literal('backToLobby') }),
  z.object({ t: z.literal('leave') }),
  z.object({ t: z.literal('rename'), name: playerNameSchema }),
  z.object({ t: z.literal('ping') }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface RoomPlayerView {
  id: string;
  name: string;
  ready: boolean;
  /** Versão das opções quando o jogador marcou "pronto". */
  readyAtVersion: number;
  connected: boolean;
}

export interface OptionsChange {
  version: number;
  keys: string[];
  at: number;
}

export interface MatchResult {
  gameId: string;
  winners: string[];
  scores?: Record<string, number>;
  message?: string;
  aborted?: boolean;
}

export interface RoomView {
  code: string;
  ownerId: string | null;
  players: RoomPlayerView[];
  gameId: string | null;
  options: Record<string, string | number | boolean>;
  optionsVersion: number;
  lastChange: OptionsChange | null;
  status: RoomStatus;
  lastResult: MatchResult | null;
}

export interface GameStatusView {
  phase: 'playing' | 'finished';
  currentPlayers: string[];
  winners?: string[];
  scores?: Record<string, number>;
  message?: string;
}

/** Mensagens do servidor para o cliente. */
export type ServerMessage =
  | { t: 'room'; room: RoomView; you: string }
  | { t: 'game'; gameId: string; seq: number; view: unknown; status: GameStatusView; legal: unknown[] }
  | { t: 'gameEnded' }
  | { t: 'error'; message: string }
  | { t: 'kicked' }
  | { t: 'pong' };

export interface CreateRoomResponse {
  code: string;
}
