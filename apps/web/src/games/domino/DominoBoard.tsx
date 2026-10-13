import { useEffect, useRef, useState } from 'react';
import type { DominoAction, DominoView, Side, Tile } from '@tablehub/games/domino/engine';
import { useFreshKeys, useLeaving } from '../../components/table/anim';
import { GameTableLayout, fromSeat } from '../../components/table/GameTableLayout';
import { arrangeSeats } from '../../components/table/seats';
import type { BoardProps } from '../registry';
import { DominoTile, TileBack } from './art';
import './domino.css';

const ROW = 7;

function Boneyard({ count, canDraw, onDraw }: { count: number; canDraw: boolean; onDraw: () => void }) {
  // peças que acabaram de sair do monte ficam um instante na ponta para animar a saída
  const leaving = useLeaving(count);
  const total = count + leaving;
  if (total === 0) return null;
  const rows: number[][] = [];
  for (let i = 0; i < total; i += ROW) rows.push(Array.from({ length: Math.min(ROW, total - i) }, (_, k) => i + k));
  const content = (
    <>
      <span className="domino-boneyard-rows">
        {rows.map((r, ri) => (
          <span key={ri} className="domino-boneyard-row">
            {r.map((i) => (
              <span key={i} className={`domino-boneyard-tile ${i >= count ? 'leaving' : ''}`}>
                <TileBack />
              </span>
            ))}
          </span>
        ))}
      </span>
      <span className="domino-boneyard-count">×{count}</span>
    </>
  );
  return canDraw ? (
    <button type="button" className="domino-boneyard can-draw" onClick={onDraw} aria-label={`Monte: ${count} peças, toque para comprar`}>
      {content}
    </button>
  ) : (
    <div className="domino-boneyard" role="img" aria-label={`Monte: ${count} peças`}>
      {content}
    </div>
  );
}

/** Mão de um oponente em miniatura: peças que saem somem com fade. */
function MiniHand({ count }: { count: number }) {
  const leaving = useLeaving(count);
  return (
    <span className="domino-mini-hand" aria-hidden="true">
      {Array.from({ length: count + leaving }, (_, i) => (
        <span key={i} className={i >= count ? 'leaving' : ''}>
          <TileBack width={7} />
        </span>
      ))}
    </span>
  );
}

const same = (x: Tile, y: Tile) => x[0] === y[0] && x[1] === y[1];
const key = (t: Tile) => `${t[0]}-${t[1]}`;

/** Peças compradas desde a sua última jogada (o destaque some ao jogar ou ao mudar de rodada). */
function useDrawnTiles(hand: Tile[] | null, round: number): Set<string> {
  const [drawn, setDrawn] = useState<Set<string>>(new Set());
  const prev = useRef({ hand, round });
  useEffect(() => {
    const before = prev.current;
    prev.current = { hand, round };
    if (!hand || !before.hand || before.round !== round || hand.length < before.hand.length) {
      setDrawn((d) => (d.size ? new Set() : d));
      return;
    }
    const old = new Set(before.hand.map(key));
    const added = hand.map(key).filter((k) => !old.has(k));
    if (added.length) setDrawn((d) => new Set([...d, ...added]));
  }, [hand, round]);
  return drawn;
}

export default function DominoBoard({ game, room, you, act }: BoardProps) {
  const v = game.view as DominoView;
  const legal = game.legal as DominoAction[];
  const [selected, setSelected] = useState<Tile | null>(null);
  const myTurn = v.turn === you;
  const plays = legal.filter((a): a is Extract<DominoAction, { type: 'play' }> => a.type === 'play');
  const canDraw = legal.some((a) => a.type === 'draw');
  const canPass = legal.some((a) => a.type === 'pass');
  const nameOf = (id: string) => room.players.find((p) => p.id === id)?.name ?? id;
  const drawn = useDrawnTiles(v.myHand, v.round);
  const draw = () => act({ type: 'draw' });
  const boneyardEmpty = myTurn && canPass && v.options.mode === 'compra';
  const places = arrangeSeats(
    v.players.map((p) => p.id),
    you,
  );
  const lineKeys = v.line.map((pt) => `${v.round}:${key(pt.tile)}`);
  const fresh = useFreshKeys(lineKeys);

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
  const counters = (id: string) => {
    const p = v.players.find((x) => x.id === id)!;
    return (
      <>
        {teams && <span className="badge">{p.team === 0 ? 'A' : 'B'}</span>}
        {id !== you && <MiniHand count={p.tiles} />}
        <span>
          {p.tiles} {p.tiles === 1 ? 'peça' : 'peças'}
        </span>
        <span>
          · <strong>{p.score}</strong> pts
        </span>
      </>
    );
  };

  return (
    <div className="stack">
      {v.lastRound && v.lastRound.round === v.round - 1 && (
        <div className="banner banner-info">
          Rodada {v.lastRound.round}: {v.lastRound.reason === 'batida' ? 'batida' : 'jogo fechado'} —{' '}
          {v.lastRound.winners.length ? `${v.lastRound.winners.map(nameOf).join(' e ')} +${v.lastRound.points}` : 'empate, ninguém pontua'}
        </div>
      )}

      <GameTableLayout
        game={game}
        room={room}
        you={you}
        places={places}
        counters={counters}
        className="domino-table"
        cornerLeft={
          <span className="badge">
            Rodada {v.round} · meta {v.options.pointsToWin}
          </span>
        }
        cornerRight={<Boneyard count={v.boneyard} canDraw={myTurn && canDraw} onDraw={draw} />}
      >
        {v.line.length === 0 ? (
          <p className="domino-empty">{myTurn ? (v.forcedOpening ? `Abra com o [${v.forcedOpening[0]}|${v.forcedOpening[1]}]` : 'Jogue qualquer peça para abrir') : 'Aguardando a primeira peça…'}</p>
        ) : (
          <div className="domino-line" aria-label="Mesa">
            {v.line.map((pt, i) => (
              <span key={lineKeys[i]} className={`domino-placed ${fresh.has(lineKeys[i]) ? 'enter' : ''}`} style={fromSeat(places.find((p) => p.id === pt.by))}>
                <DominoTile a={pt.shown[0]} b={pt.shown[1]} vertical={pt.shown[0] === pt.shown[1]} size={0.7} />
              </span>
            ))}
          </div>
        )}
        {v.ends && (
          <div className="domino-ends">
            Pontas: <strong>{v.ends.left}</strong> e <strong>{v.ends.right}</strong>
          </div>
        )}
        {v.lastAction && <div className="domino-last">{v.lastAction.text}</div>}
      </GameTableLayout>

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

      {myTurn && canDraw && <div className="banner">Sem peça para jogar — compre do monte</div>}
      {boneyardEmpty && <div className="banner">O monte acabou</div>}

      <div className="card stack">
        <div className="row">
          <strong className="grow">Sua mão {me ? `(${me.tiles})` : ''}</strong>
          {canDraw && (
            <button className="btn btn-warn" onClick={draw}>
              Comprar do monte
            </button>
          )}
          {canPass && (
            <button className={`btn ${boneyardEmpty ? 'btn-primary domino-pass-highlight' : 'btn-warn'}`} onClick={() => act({ type: 'pass' })}>
              Passar a vez
            </button>
          )}
        </div>
        <div className="domino-hand">
          {(v.myHand ?? []).map((t) => {
            const playable = plays.some((p) => same(p.tile, t));
            return (
              <button
                key={key(t)}
                className={`domino-hand-tile ${playable ? 'playable' : ''} ${myTurn ? '' : 'idle'} ${selected && same(selected, t) ? 'selected' : ''} ${drawn.has(key(t)) ? 'drawn' : ''}`}
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
