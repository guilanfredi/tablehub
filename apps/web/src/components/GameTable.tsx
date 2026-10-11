import { Suspense } from 'react';
import { GAMES } from '@tablehub/games';
import { BOARDS } from '../games/registry';
import { sendAction, useRoom } from '../store/room';

export function GameTable() {
  const room = useRoom((s) => s.room)!;
  const game = useRoom((s) => s.game);
  const you = useRoom((s) => s.you)!;
  const send = useRoom((s) => s.send);
  if (!game) return <p className="muted">Carregando partida…</p>;

  const def = GAMES[game.gameId];
  const Board = BOARDS[game.gameId];
  const myTurn = game.status.currentPlayers.includes(you);
  const isOwner = room.ownerId === you;
  const finished = game.status.phase === 'finished';
  const winners = room.players.filter((p) => game.status.winners?.includes(p.id)).map((p) => p.name);

  return (
    <div>
      <div className="table-header">
        <strong>{def?.name}</strong>
        <div className={`status-pill ${myTurn && !finished ? 'my-turn' : ''}`} aria-live="polite">
          {finished ? 'Fim de jogo' : myTurn && /^Vez de /.test(game.status.message ?? '') ? 'Sua vez!' : (game.status.message ?? '')}
        </div>
        {isOwner && !finished && (
          <button className="btn btn-sm btn-danger" onClick={() => confirm('Encerrar a partida para todos e voltar à sala?') && send({ t: 'backToLobby' })}>
            Encerrar
          </button>
        )}
      </div>

      {finished && (
        <div className="card result-card stack" style={{ marginBottom: 12 }}>
          <h2>{game.status.winners?.includes(you) ? 'Você venceu! 🎉' : 'Fim de jogo'}</h2>
          <p style={{ margin: 0 }}>{game.status.message ?? (winners.length ? `Vencedor: ${winners.join(', ')}` : '')}</p>
          <button className="btn btn-primary" onClick={() => send({ t: 'backToLobby' })}>
            Voltar à sala
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
  );
}
