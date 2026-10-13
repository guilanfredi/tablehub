import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { RoomView } from '@tablehub/shared';
import type { GameState } from '../../store/room';
import { PlayerAvatar } from '../avatars/Avatar';
import type { SeatPlace } from './seats';
import './table.css';

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/** Estilo com a direção do assento, para animações que saem dele (`--dx`/`--dy`). */
export const fromSeat = (place: SeatPlace | undefined): CSSProperties => ({ '--dx': place?.dx ?? 0, '--dy': place?.dy ?? 0 }) as CSSProperties;

interface LayoutProps {
  game: GameState;
  room: RoomView;
  you: string;
  /** Assentos já distribuídos (`arrangeSeats`). O primeiro fica embaixo. */
  places: SeatPlace[];
  /** Contadores do jogo em cada assento (peças, pontos, vida…). */
  counters?(id: string): ReactNode;
  /** Jogadores destacados como "da vez" (padrão: os da vez no status). */
  turn?: string[];
  /** Conteúdo do centro da mesa. */
  children: ReactNode;
  /** Cantos do tampo: no celular descem para baixo do centro, logo acima da sua mão. */
  cornerLeft?: ReactNode;
  cornerRight?: ReactNode;
  className?: string;
}

function Seat({ place, game, room, you, counters, onTurn, compact }: { place: SeatPlace; game: GameState; room: RoomView; you: string; counters?: LayoutProps['counters']; onTurn: boolean; compact: boolean }) {
  const player = room.players.find((p) => p.id === place.id);
  const name = place.id === you ? 'Você' : (player?.name ?? place.id);
  return (
    <div className={`gt-seat gt-seat-${place.region} ${onTurn ? 'turn' : ''}`} data-player={place.id} style={fromSeat(place)} aria-current={onTurn ? 'true' : undefined}>
      <PlayerAvatar player={player} size={compact ? 32 : 40} ring={onTurn} thinking={onTurn && game.status.phase === 'playing'} />
      <div className="gt-seat-body">
        <span className="gt-seat-name">{name}</span>
        {counters && <div className="gt-counters">{counters(place.id)}</div>}
      </div>
    </div>
  );
}

/**
 * Mesa comum dos tabuleiros: assentos ao redor do tampo (você embaixo, demais na ordem da mesa),
 * centro com o conteúdo do jogo e cantos opcionais. No celular os oponentes viram uma faixa no topo.
 */
export function GameTableLayout({ game, room, you, places, counters, turn, children, cornerLeft, cornerRight, className = '' }: LayoutProps) {
  const compact = useMediaQuery('(max-width: 600px)');
  const active = turn ?? (game.status.phase === 'playing' ? game.status.currentPlayers : []);
  const seat = (p: SeatPlace) => <Seat key={p.id} place={p} game={game} room={room} you={you} counters={counters} onTurn={active.includes(p.id)} compact={compact} />;
  const [bottom, ...others] = places;
  const by = (r: SeatPlace['region']) => others.filter((p) => p.region === r);
  const corners = (cornerLeft || cornerRight) && (
    <div className="gt-corners">
      <div className="gt-corner">{cornerLeft}</div>
      <div className="gt-corner gt-corner-right">{cornerRight}</div>
    </div>
  );
  const felt = (
    <div className="table-top gt-felt">
      {corners}
      <div className="gt-center">{children}</div>
    </div>
  );

  if (compact)
    return (
      <div className={`gt gt-compact ${className}`}>
        {others.length > 0 && <div className="gt-strip">{others.map(seat)}</div>}
        {felt}
        {bottom && <div className="gt-bottom">{seat(bottom)}</div>}
      </div>
    );

  const top = by('top').sort((a, b) => a.dx - b.dx);
  const left = by('left').sort((a, b) => a.dy - b.dy);
  const right = by('right').sort((a, b) => a.dy - b.dy);
  return (
    <div className={`gt ${className}`}>
      {top.length > 0 && <div className="gt-top">{top.map(seat)}</div>}
      <div className="gt-mid">
        {left.length > 0 && <div className="gt-side">{left.map(seat)}</div>}
        {felt}
        {right.length > 0 && <div className="gt-side">{right.map(seat)}</div>}
      </div>
      {bottom && <div className="gt-bottom">{seat(bottom)}</div>}
    </div>
  );
}
