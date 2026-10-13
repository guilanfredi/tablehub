import { useEffect, useRef } from 'react';
import type { GameLogView, RoomView } from '@tablehub/shared';
import { Avatar } from '../avatars/Avatar';
import { useHistory } from '../../store/history';
import './table.css';

/** Painel do histórico da partida: lateral no desktop (pode ficar fixo), gaveta de baixo no celular. */
export function HistoryPanel({ log, room, pinned, wide }: { log: GameLogView | undefined; room: RoomView; pinned: boolean; wide: boolean }) {
  const setOpen = useHistory((s) => s.setOpen);
  const togglePin = useHistory((s) => s.togglePin);
  const entries = log?.entries ?? [];
  const total = log?.total ?? 0;
  const first = total - entries.length; // índice absoluto da entrada mais antiga guardada
  // só anima as linhas que chegarem com o painel aberto
  const openedAt = useRef(total);
  const close = () => setOpen(false);

  useEffect(() => {
    if (pinned) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [pinned, setOpen]);

  return (
    <>
      {!pinned && <button type="button" className="history-backdrop" aria-label="Fechar histórico" onClick={close} />}
      <aside className={`history-panel ${pinned ? 'pinned' : ''}`} aria-label="Histórico da partida">
        <div className="history-head">
          <h2>Histórico</h2>
          {wide && (
            <button type="button" className="btn btn-sm btn-ghost" aria-pressed={pinned} onClick={togglePin}>
              {pinned ? 'Soltar' : 'Fixar'}
            </button>
          )}
          {!pinned && (
            <button type="button" className="btn btn-sm" onClick={close}>
              Fechar
            </button>
          )}
        </div>
        {entries.length === 0 ? (
          <p className="history-empty">Nenhuma jogada ainda.</p>
        ) : (
          <ol className="history-list" reversed start={total}>
            {entries
              .map((e, i) => ({ ...e, n: first + i }))
              .reverse()
              .map((e) => {
                const player = e.by ? room.players.find((p) => p.id === e.by) : undefined;
                return (
                  <li key={e.n} className={`history-entry ${e.n >= openedAt.current ? 'enter' : ''}`}>
                    {player && <Avatar id={player.avatar} size={22} bot={player.bot} />}
                    <span>{e.text}</span>
                  </li>
                );
              })}
          </ol>
        )}
      </aside>
    </>
  );
}
