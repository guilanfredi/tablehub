/**
 * Arte própria (SVG) do Catan no TableHub: ícones de recursos e peças.
 * Coordenadas centradas em (0,0), cabendo em ~[-10,10].
 */
import type { Resource, Terrain } from '@tablehub/games/catan/board';

export const TERRAIN_FILL: Record<Terrain, string> = {
  forest: '#2f7a3a',
  pasture: '#8cc663',
  fields: '#e6c14a',
  hills: '#c8693f',
  mountains: '#8b8f99',
  desert: '#e3d3a4',
};

/** Cores do tabuleiro: borda dos hexes, fichas de número, portos e estradas. */
export const BOARD_ART = {
  hexStroke: '#f3ead2',
  token: '#f8f1dc',
  tokenStroke: '#6b5a34',
  hotPip: '#b3342f',
  pip: '#3a3122',
  portLine: '#d9c9a0',
  roadOutline: '#1b1b1b',
  unknownPlayer: '#999',
};

export const RESOURCE_COLOR: Record<Resource, string> = {
  lumber: '#2f7a3a',
  wool: '#8cc663',
  grain: '#e6c14a',
  brick: '#c8693f',
  ore: '#8b8f99',
};

export function ResourceGlyph({ r }: { r: Resource }) {
  switch (r) {
    case 'lumber':
      return (
        <g>
          <rect x={-1.5} y={4} width={3} height={5} fill="#5b3a1e" />
          <polygon points="0,-9 7,0 3,0 8,5 -8,5 -3,0 -7,0" fill="#1f5c2a" stroke="#123b1a" strokeWidth={0.6} />
        </g>
      );
    case 'brick':
      return (
        <g stroke="#6e2d14" strokeWidth={0.6} fill="#e08a5c">
          <rect x={-8} y={-6} width={7.5} height={4} />
          <rect x={0.5} y={-6} width={7.5} height={4} />
          <rect x={-4} y={-1.5} width={7.5} height={4} />
          <rect x={-8} y={3} width={7.5} height={4} />
          <rect x={0.5} y={3} width={7.5} height={4} />
        </g>
      );
    case 'wool':
      return (
        <g>
          <ellipse cx={0} cy={1} rx={7.5} ry={5} fill="#fbfbf7" stroke="#6a6a60" strokeWidth={0.6} />
          <circle cx={-4} cy={-2} r={3} fill="#fbfbf7" stroke="#6a6a60" strokeWidth={0.6} />
          <circle cx={1} cy={-3} r={3} fill="#fbfbf7" stroke="#6a6a60" strokeWidth={0.6} />
          <ellipse cx={7.5} cy={0} rx={2.4} ry={2} fill="#3a3a33" />
          <rect x={-5} y={5} width={1.4} height={3.5} fill="#3a3a33" />
          <rect x={3} y={5} width={1.4} height={3.5} fill="#3a3a33" />
        </g>
      );
    case 'grain':
      return (
        <g stroke="#7a5a12" strokeWidth={0.6}>
          <line x1={0} y1={9} x2={0} y2={-8} stroke="#9a7a22" strokeWidth={1.2} />
          {[-6, -2.5, 1, 4.5].map((y) => (
            <g key={y}>
              <ellipse cx={-2.6} cy={y} rx={2.6} ry={1.4} fill="#f5d36a" transform={`rotate(-30 -2.6 ${y})`} />
              <ellipse cx={2.6} cy={y} rx={2.6} ry={1.4} fill="#f5d36a" transform={`rotate(30 2.6 ${y})`} />
            </g>
          ))}
        </g>
      );
    case 'ore':
      return (
        <g>
          <polygon points="-9,7 -2,-6 5,7" fill="#6d717b" stroke="#3e4148" strokeWidth={0.6} />
          <polygon points="-1,7 4,-2 9,7" fill="#9aa0ab" stroke="#3e4148" strokeWidth={0.6} />
          <polygon points="-4,-1 -2,-6 0,-1" fill="#f2f2f2" />
        </g>
      );
  }
}

export function TerrainGlyph({ t }: { t: Terrain }) {
  const map: Record<Terrain, Resource | null> = { forest: 'lumber', pasture: 'wool', fields: 'grain', hills: 'brick', mountains: 'ore', desert: null };
  const r = map[t];
  if (!r) {
    return (
      <g>
        <path d="M-9,4 Q-4,-2 0,4 T9,4" fill="none" stroke="#b49a5a" strokeWidth={1.2} />
        <circle cx={5} cy={-5} r={3} fill="#f0c95a" />
      </g>
    );
  }
  return <ResourceGlyph r={r} />;
}

export function SettlementShape({ color }: { color: string }) {
  return <polygon points="-7,7 -7,-1 0,-8 7,-1 7,7" fill={color} stroke="#1b1b1b" strokeWidth={1.6} strokeLinejoin="round" />;
}

export function CityShape({ color }: { color: string }) {
  return <polygon points="-10,8 -10,-2 -4,-8 2,-2 2,0 10,0 10,8" fill={color} stroke="#1b1b1b" strokeWidth={1.6} strokeLinejoin="round" />;
}

export function RobberShape() {
  return (
    <g>
      <ellipse cx={0} cy={10} rx={8} ry={3} fill="rgb(0 0 0 / 0.35)" />
      <path d="M-6,10 Q-7,0 -3,-3 A5,5 0 1 1 3,-3 Q7,0 6,10 Z" fill="#2b2b2b" stroke="#000" strokeWidth={1} />
    </g>
  );
}
