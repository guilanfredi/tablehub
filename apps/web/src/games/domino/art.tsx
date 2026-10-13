// Arte do dominó: peça e verso. Cores da arte do jogo ficam aqui (fora dos tokens do design system).

const TILE = { body: '#fbf8f1', edge: '#3a352c', pip: '#24211c' };
const BACK = { edge: '#165540', edgeStroke: '#0d3a2b', a: '#1f6f54', b: '#2a8a68', c: '#175d46', d: '#3fae84' };

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
        <circle key={i} cx={px * 40} cy={py * 40} r={4.2} className="pip" fill={TILE.pip} />
      ))}
    </g>
  );
}

export function DominoTile({ a, b, vertical = false, size = 1 }: { a: number; b: number; vertical?: boolean; size?: number }) {
  const [w, h] = vertical ? [40, 80] : [80, 40];
  const line = { stroke: TILE.edge, strokeWidth: 1.5 };
  return (
    <svg className="domino-tile" viewBox={`0 0 ${w} ${h}`} width={w * size} height={h * size} role="img" aria-label={`Peça ${a} e ${b}`}>
      <rect x="1" y="1" width={w - 2} height={h - 2} rx="6" className="tile-body" fill={TILE.body} {...line} />
      {vertical ? <line x1="5" y1="40" x2="35" y2="40" className="tile-divider" {...line} /> : <line x1="40" y1="5" x2="40" y2="35" className="tile-divider" {...line} />}
      <Half n={a} x={0} y={0} />
      <Half n={b} x={vertical ? 0 : 40} y={vertical ? 40 : 0} />
    </svg>
  );
}

/** Verso da peça: facetas low poly. */
export function TileBack({ width = 20 }: { width?: number }) {
  return (
    <svg className="domino-back" viewBox="0 0 20 36" width={width} height={width * 1.8} aria-hidden="true">
      <rect x="0.5" y="0.5" width="19" height="35" rx="3" className="back-edge" fill={BACK.edge} stroke={BACK.edgeStroke} strokeWidth="1" />
      <polygon points="2,2 18,2 10,10" fill={BACK.a} />
      <polygon points="2,2 10,10 2,18" fill={BACK.b} />
      <polygon points="18,2 18,18 10,10" fill={BACK.c} />
      <polygon points="2,18 10,10 18,18" fill={BACK.d} />
      <polygon points="2,18 18,18 10,26" fill={BACK.c} />
      <polygon points="2,18 10,26 2,34" fill={BACK.a} />
      <polygon points="18,18 18,34 10,26" fill={BACK.b} />
      <polygon points="2,34 10,26 18,34" fill={BACK.d} />
    </svg>
  );
}
