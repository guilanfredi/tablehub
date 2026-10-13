import { Suspense, useEffect } from 'react';
import { GAMES } from '@tablehub/games';
import { BOARDS } from '../games/registry';
import { countSince, useHistory } from '../store/history';
import { sendAction, useRoom } from '../store/room';
import { HistoryPanel } from './table/HistoryPanel';
import { useMediaQuery } from './table/GameTableLayout';

export function GameTable() {
  const room = useRoom((s) => s.room)!;
  const game = useRoom((s) => s.game);
  const you = useRoom((s) => s.you)!;
  const send = useRoom((s) => s.send);
  const history = useHistory();
  const wide = useMediaQuery('(min-width: 900px)');
  const log = game?.log;
  const pinned = history.pinned && wide;
  const panelShown = Boolean(log) && (pinned || history.open);

  useEffect(() => () => useHistory.getState().reset(), []);
  useEffect(() => {
    if (log) history.sync(log.total, panelShown && document.visibilityState === 'visible');
  }, [log?.total, panelShown]);

  if (!game) return <p className="muted">Carregando partida…</p>;

  const def = GAMES[game.gameId];
  const Board = BOARDS[game.gameId];
  const myTurn = game.status.currentPlayers.includes(you);
  const isOwner = room.ownerId === you;
  const finished = game.status.phase === 'finished';
  const winners = room.players.filter((p) => game.status.winners?.includes(p.id)).map((p) => p.name);
  const unread = panelShown ? 0 : countSince(log, history.seen, you);
  const away = history.returned ? countSince(log, history.awayMark, you) : 0;

  return (
    <div className={`table-shell ${pinned && log ? 'pinned' : ''}`}>
      <div className="table-main">
        <div className="table-header">
          <strong>{def?.name}</strong>
          <div className={`status-pill ${myTurn && !finished ? 'my-turn' : ''}`} aria-live="polite">
            {finished ? 'Fim de jogo' : myTurn && /^Vez de /.test(game.status.message ?? '') ? 'Sua vez!' : (game.status.message ?? '')}
          </div>
          {log && !pinned && (
            <button
              className="btn btn-sm history-btn"
              aria-expanded={history.open}
              data-total={log.total}
              aria-label={unread ? `Histórico, ${unread} ${unread === 1 ? 'nova' : 'novas'}` : 'Histórico'}
              onClick={() => history.setOpen(!history.open)}
            >
              Histórico
              {unread > 0 && <span className="badge badge-primary history-count">{unread > 99 ? '99+' : unread}</span>}
            </button>
          )}
          {isOwner && !finished && (
            <button className="btn btn-sm btn-danger" onClick={() => confirm('Encerrar a partida para todos e voltar à mesa?') && send({ t: 'backToLobby' })}>
              Encerrar
            </button>
          )}
        </div>

        {away > 0 && !panelShown && (
          <div className="banner banner-info away-banner" role="status">
            <span className="grow">
              {away} {away === 1 ? 'jogada' : 'jogadas'} enquanto você esteve fora
            </span>
            <button
              className="btn btn-sm"
              onClick={() => {
                history.dismissAway();
                history.setOpen(true);
              }}
            >
              Ver histórico
            </button>
            <button className="btn btn-sm btn-ghost" aria-label="Dispensar aviso" onClick={history.dismissAway}>
              ✕
            </button>
          </div>
        )}

        {finished && (
          <div className="card result-card stack" style={{ marginBottom: 12 }}>
            <h2>{game.status.winners?.includes(you) ? 'Você venceu! 🎉' : 'Fim de jogo'}</h2>
            <p style={{ margin: 0 }}>{game.status.message ?? (winners.length ? `Vencedor: ${winners.join(', ')}` : '')}</p>
            <button className="btn btn-primary" onClick={() => send({ t: 'backToLobby' })}>
              Voltar à mesa
            </button>
          </div>
        )}

        {Board ? (
          <Suspense fallback={<p className="muted">Carregando tabuleiro…</p>}>
            <Board game={game} room={room} you={you} act={sendAction} />
          </Suspense>
        ) : (
          <p>Este jogo ainda não tem interface.</p>
        )}
      </div>
      {panelShown && <HistoryPanel log={log} room={room} pinned={pinned} wide={wide} />}
    </div>
  );
}
