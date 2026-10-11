import { useState } from 'react';
import type { DominoAction, DominoView, Side, Tile } from '@tablehub/games/domino/engine';
import type { BoardProps } from '../registry';
import './domino.css';

const PIP_POS: Record<number, [number, number][]> = {
  0: [],
  1: [[0.5, 0.5]],
  2: [[0.25, 0.25], [0.75, 0.75]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.25, 0.2], [0.75, 0.2], [0.25, 0.5], [0.75, 0.5], [0.25, 0.8], [0.75, 0.8]],
};

function Half({ n, x, y }: { n: number; x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {PIP_POS[n].map(([px, py], i) => (
        <circle key={i} cx={px * 40} cy={py * 40} r={4.2} className="pip" />
      ))}
    </g>
  );
}

export function DominoTile({ a, b, vertical = false, size = 1 }: { a: number; b: number; vertical?: boolean; size?: number }) {
  const [w, h] = vertical ? [40, 80] : [80, 40];
  return (
    <svg className="domino-tile" viewBox={`0 0 ${w} ${h}`} width={w * size} height={h * size} role="img" aria-label={`Peça ${a} e ${b}`}>
      <rect x="1" y="1" width={w - 2} height={h - 2} rx="6" className="tile-body" />
      {vertical ? <line x1="5" y1="40" x2="35" y2="40" className="tile-divider" /> : <line x1="40" y1="5" x2="40" y2="35" className="tile-divider" />}
      <Half n={a} x={0} y={0} />
      <Half n={b} x={vertical ? 0 : 40} y={vertical ? 40 : 0} />
    </svg>
  );
}

const same = (x: Tile, y: Tile) => x[0] === y[0] && x[1] === y[1];

export default function DominoBoard({ game, room, you, act }: BoardProps) {
  const v = game.view as DominoView;
  const legal = game.legal as DominoAction[];
  const [selected, setSelected] = useState<Tile | null>(null);
  const myTurn = v.turn === you;
  const plays = legal.filter((a): a is Extract<DominoAction, { type: 'play' }> => a.type === 'play');
  const canDraw = legal.some((a) => a.type === 'draw');
  const canPass = legal.some((a) => a.type === 'pass');
  const nameOf = (id: string) => room.players.find((p) => p.id === id)?.name ?? id;

  function choose(tile: Tile) {
    const options = plays.filter((p) => same(p.tile, tile));
    if (options.length === 0) return;
    if (options.length === 1) {
      act(options[0]);
      setSelected(null);
    } else setSelected(tile);
  }

  function playSide(side: Side) {
    if (!selected) return;
    act({ type: 'play', tile: selected, side });
    setSelected(null);
  }

  const me = v.players.find((p) => p.id === you);
  const teams = v.options.teams;

  return (
    <div className="stack">
      <div className="scoreboard">
        {v.players.map((p) => (
          <div key={p.id} className={`score-chip ${p.id === v.turn ? 'active' : ''}`}>
            {teams && <span className="badge">{p.team === 0 ? 'A' : 'B'}</span>}
            <span>{p.id === you ? 'Você' : p.name}</span>
            <span className="muted">· {p.tiles} peças</span>
            <strong>{p.score}</strong>
          </div>
        ))}
        <div className="score-chip muted">
          Rodada {v.round} · meta {v.options.pointsToWin}
          {v.options.mode === 'compra' && ` · monte ${v.boneyard}`}
        </div>
      </div>

      {v.lastRound && v.lastRound.round === v.round - 1 && (
        <div className="banner banner-info">
          Rodada {v.lastRound.round}: {v.lastRound.reason === 'batida' ? 'batida' : 'jogo fechado'} —{' '}
          {v.lastRound.winners.length ? `${v.lastRound.winners.map(nameOf).join(' e ')} +${v.lastRound.points}` : 'empate, ninguém pontua'}
        </div>
      )}

      <div className="felt domino-felt">
        {v.line.length === 0 ? (
          <p className="domino-empty">{myTurn ? (v.forcedOpening ? `Abra com o [${v.forcedOpening[0]}|${v.forcedOpening[1]}]` : 'Jogue qualquer peça para abrir') : 'Aguardando a primeira peça…'}</p>
        ) : (
          <div className="domino-line" aria-label="Mesa">
            {v.line.map((pt, i) => (
              <DominoTile key={i} a={pt.shown[0]} b={pt.shown[1]} vertical={pt.shown[0] === pt.shown[1]} size={0.7} />
            ))}
          </div>
        )}
        {v.ends && (
          <div className="domino-ends">
            Pontas: <strong>{v.ends.left}</strong> e <strong>{v.ends.right}</strong>
          </div>
        )}
        {v.lastAction && <div className="domino-last">{v.lastAction.text}</div>}
      </div>

      {selected && (
        <div className="card row" style={{ justifyContent: 'center' }}>
          <span>Em qual ponta?</span>
          <button className="btn btn-primary" onClick={() => playSide('left')}>
            ◀ Esquerda ({v.ends?.left})
          </button>
          <button className="btn btn-primary" onClick={() => playSide('right')}>
            Direita ({v.ends?.right}) ▶
          </button>
          <button className="btn btn-ghost" onClick={() => setSelected(null)}>
            Cancelar
          </button>
        </div>
      )}

      <div className="card stack">
        <div className="row">
          <strong className="grow">Sua mão {me ? `(${me.tiles})` : ''}</strong>
          {canDraw && (
            <button className="btn btn-warn" onClick={() => act({ type: 'draw' })}>
              Comprar do monte
            </button>
          )}
          {canPass && (
            <button className="btn btn-warn" onClick={() => act({ type: 'pass' })}>
              Passar a vez
            </button>
          )}
        </div>
        <div className="domino-hand">
          {(v.myHand ?? []).map((t) => {
            const playable = plays.some((p) => same(p.tile, t));
            return (
              <button
                key={`${t[0]}-${t[1]}`}
                className={`domino-hand-tile ${playable ? 'playable' : ''} ${myTurn ? '' : 'idle'} ${selected && same(selected, t) ? 'selected' : ''}`}
                disabled={!playable}
                onClick={() => choose(t)}
              >
                <DominoTile a={t[0]} b={t[1]} vertical size={0.9} />
              </button>
            );
          })}
        </div>
        {!myTurn && <p className="muted small" style={{ margin: 0 }}>Aguarde sua vez.</p>}
      </div>
    </div>
  );
}
