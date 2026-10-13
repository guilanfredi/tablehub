import type { RoomView } from '@tablehub/shared';
import type { GameState } from '../../store/room';
import { PlayerAvatar } from './Avatar';

/**
 * Avatar de um jogador dentro de um tabuleiro: selo de bot, cinza se desconectado e
 * "pensando…" enquanto é a vez de um bot (o cliente deduz: bot na vez + partida em andamento).
 */
export function SeatAvatar({ game, room, id, size = 28 }: { game: GameState; room: RoomView; id: string; size?: number }) {
  const player = room.players.find((p) => p.id === id);
  const onTurn = game.status.phase === 'playing' && game.status.currentPlayers.includes(id);
  return <PlayerAvatar player={player} size={size} thinking={onTurn} />;
}
