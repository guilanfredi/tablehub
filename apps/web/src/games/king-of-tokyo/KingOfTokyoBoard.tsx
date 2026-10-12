import type { KingOfTokyoAction, KingOfTokyoState } from '@tablehub/games/king-of-tokyo/engine';
import type { BoardProps } from '../registry';

export default function KingOfTokyoBoard({ game, act }: BoardProps) {
  const v = game.view as KingOfTokyoState;
  const legal = game.legal as KingOfTokyoAction[];
  return (
    <div className="card stack">
      <p className="muted">TODO: interface de King of Tokyo. Turno de {v.players[v.turn]?.name}.</p>
      <div className="row">
        {legal.map((a, i) => (
          <button key={i} className="btn" onClick={() => act(a)}>
            {a.type}
          </button>
        ))}
      </div>
    </div>
  );
}
