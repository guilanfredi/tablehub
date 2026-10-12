import type { GameStatusView, RoomView } from '@tablehub/shared';

export type SoundId = 'join' | 'leave' | 'ready' | 'start' | 'move' | 'turn' | 'win' | 'end' | 'error';

interface GameSnapshot {
  gameId: string;
  seq: number;
  status: GameStatusView;
}

/** Sons disparados por uma atualização da sala. A primeira mensagem (entrada na sala) não toca nada. */
export function roomSounds(prev: RoomView | null, next: RoomView, you: string | null): SoundId[] {
  if (!prev || prev.code !== next.code) return [];
  const out: SoundId[] = [];
  if (prev.status === 'lobby' && next.status === 'playing') out.push('start');
  const before = new Map(prev.players.map((p) => [p.id, p]));
  const after = new Set(next.players.map((p) => p.id));
  for (const p of next.players) {
    if (p.id === you) continue;
    const old = before.get(p.id);
    if (!old) out.push('join');
    else if (p.ready && !old.ready && next.status === 'lobby') out.push('ready');
  }
  if (prev.players.some((p) => p.id !== you && !after.has(p.id))) out.push('leave');
  return out;
}

/** Sons disparados por um novo estado de jogo. O primeiro estado da partida não toca nada (o início já tem som próprio). */
export function gameSounds(prev: GameSnapshot | null, next: GameSnapshot, you: string | null): SoundId[] {
  if (!prev || prev.gameId !== next.gameId || next.seq <= prev.seq) return [];
  if (next.status.phase === 'finished') {
    if (prev.status.phase === 'finished') return [];
    return [you && next.status.winners?.includes(you) ? 'win' : 'end'];
  }
  const myTurn = you !== null && next.status.currentPlayers.includes(you);
  const wasMyTurn = you !== null && prev.status.currentPlayers.includes(you);
  return [myTurn && !wasMyTurn ? 'turn' : 'move'];
}
