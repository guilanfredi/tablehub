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

/** Avatares (cabeças de animais em low poly). O id é estável e vai no protocolo. */
export const AVATARS = [
  { id: 'onca', label: 'Onça' },
  { id: 'capivara', label: 'Capivara' },
  { id: 'tucano', label: 'Tucano' },
  { id: 'arara', label: 'Arara' },
  { id: 'boto', label: 'Boto' },
  { id: 'jacare', label: 'Jacaré' },
  { id: 'mico', label: 'Mico-leão' },
  { id: 'tamandua', label: 'Tamanduá' },
  { id: 'preguica', label: 'Preguiça' },
  { id: 'lobo-guara', label: 'Lobo-guará' },
  { id: 'coruja', label: 'Coruja' },
  { id: 'raposa', label: 'Raposa' },
  { id: 'gato', label: 'Gato' },
  { id: 'cachorro', label: 'Cachorro' },
  { id: 'coelho', label: 'Coelho' },
  { id: 'panda', label: 'Panda' },
  { id: 'pinguim', label: 'Pinguim' },
  { id: 'sapo', label: 'Sapo' },
  { id: 'polvo', label: 'Polvo' },
  { id: 'tartaruga', label: 'Tartaruga' },
] as const;
export type AvatarId = (typeof AVATARS)[number]['id'];
const AVATAR_IDS = AVATARS.map((a) => a.id) as [AvatarId, ...AvatarId[]];
export const avatarIdSchema = z.enum(AVATAR_IDS);

export function isAvatarId(id: unknown): id is AvatarId {
  return typeof id === 'string' && (AVATAR_IDS as string[]).includes(id);
}

/** Avatar estável para quem não escolheu um (salas antigas, clientes antigos): hash do id sobre a lista. */
export function defaultAvatar(playerId: string): AvatarId {
  let h = 2166136261;
  for (let i = 0; i < playerId.length; i++) h = Math.imul(h ^ playerId.charCodeAt(i), 16777619);
  return AVATAR_IDS[(h >>> 0) % AVATAR_IDS.length];
}

const optionValue = z.union([z.string().max(100), z.number(), z.boolean()]);

/** Mensagens do cliente para o servidor (WebSocket). */
export const clientMessageSchema = z.discriminatedUnion('t', [
  /** Primeira mensagem após conectar: identifica o jogador (token fica fora da URL). */
  z.object({ t: z.literal('hello'), token: z.string().min(16).max(128), name: playerNameSchema, avatar: avatarIdSchema.optional() }),
  z.object({ t: z.literal('setGame'), gameId: z.string().max(40).nullable() }),
  z.object({ t: z.literal('setOptions'), options: z.record(z.string(), optionValue) }),
  z.object({ t: z.literal('movePlayer'), playerId: z.string().max(64), toIndex: z.number().int().min(0).max(MAX_ROOM_PLAYERS) }),
  z.object({ t: z.literal('kick'), playerId: z.string().max(64) }),
  z.object({ t: z.literal('addBot') }),
  z.object({ t: z.literal('ready'), ready: z.boolean() }),
  z.object({ t: z.literal('start') }),
  z.object({ t: z.literal('action'), action: z.object({ type: z.string().max(40) }).passthrough() }),
  z.object({ t: z.literal('backToLobby') }),
  z.object({ t: z.literal('leave') }),
  z.object({ t: z.literal('rename'), name: playerNameSchema, avatar: avatarIdSchema.optional() }),
  z.object({ t: z.literal('ping') }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface RoomPlayerView {
  id: string;
  name: string;
  avatar: string;
  ready: boolean;
  /** Versão das opções quando o jogador marcou "pronto". */
  readyAtVersion: number;
  connected: boolean;
  bot: boolean;
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
  /** O jogo escolhido aceita bots. */
  botsAvailable: boolean;
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
  | { t: 'error'; message: string; fatal?: boolean }
  | { t: 'kicked' }
  | { t: 'pong' };

export interface CreateRoomResponse {
  code: string;
}
