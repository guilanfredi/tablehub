import { buildHexGraph, coastalEdges, hexagonShape, hexId, spiralOrder, type HexGraph, type Rng } from '@tablehub/game-sdk';

export const RESOURCES = ['brick', 'lumber', 'wool', 'grain', 'ore'] as const;
export type Resource = (typeof RESOURCES)[number];
export type Terrain = 'hills' | 'forest' | 'pasture' | 'fields' | 'mountains' | 'desert';

export const TERRAIN_RESOURCE: Record<Terrain, Resource | null> = {
  hills: 'brick',
  forest: 'lumber',
  pasture: 'wool',
  fields: 'grain',
  mountains: 'ore',
  desert: null,
};

export const RESOURCE_LABEL: Record<Resource, string> = {
  brick: 'Tijolo',
  lumber: 'Madeira',
  wool: 'Lã',
  grain: 'Trigo',
  ore: 'Minério',
};

export interface BoardHex {
  id: string;
  terrain: Terrain;
  number: number | null;
}

export interface Port {
  edge: string;
  vertices: [string, string];
  type: Resource | 'any';
}

export interface Board {
  hexes: BoardHex[];
  ports: Port[];
}

let cachedGraph: HexGraph | null = null;
/** Grafo do tabuleiro padrão (19 hexágonos). Constante e derivado — não vai para o estado. */
export function catanGraph(): HexGraph {
  if (!cachedGraph) cachedGraph = buildHexGraph(hexagonShape(2));
  return cachedGraph;
}

const SPIRAL = spiralOrder(2).map((a) => hexId(a.q, a.r));

/** Terrenos do tabuleiro para iniciantes, na ordem da espiral (de fora para dentro). */
const BEGINNER_TERRAINS: Terrain[] = [
  'mountains', 'pasture', 'forest', 'fields', 'hills', 'pasture', 'hills', 'fields', 'forest', 'forest',
  'mountains', 'fields', 'pasture', 'hills', 'fields', 'pasture', 'forest', 'mountains', 'desert',
];
/** Fichas numéricas na ordem da espiral (A..R), pulando o deserto. */
const NUMBER_TOKENS = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];
const PORT_SLOTS = [0, 3, 7, 10, 13, 17, 20, 23, 27];
const BEGINNER_PORTS: (Resource | 'any')[] = ['any', 'grain', 'ore', 'any', 'wool', 'any', 'any', 'brick', 'lumber'];

function assignNumbers(terrains: Terrain[]): BoardHex[] {
  let k = 0;
  return SPIRAL.map((id, i) => ({ id, terrain: terrains[i], number: terrains[i] === 'desert' ? null : NUMBER_TOKENS[k++] }));
}

function redNumbersAdjacent(hexes: BoardHex[]): boolean {
  const g = catanGraph();
  const byId = new Map(hexes.map((h) => [h.id, h]));
  for (const e of Object.values(g.edges)) {
    if (e.hexes.length !== 2) continue;
    const [a, b] = e.hexes.map((id) => byId.get(id)!);
    if ((a.number === 6 || a.number === 8) && (b.number === 6 || b.number === 8)) return true;
  }
  return false;
}

function buildPorts(types: (Resource | 'any')[]): Port[] {
  const g = catanGraph();
  const coast = coastalEdges(g);
  return PORT_SLOTS.map((slot, i) => {
    const e = g.edges[coast[slot]];
    return { edge: e.id, vertices: e.vertices, type: types[i] };
  });
}

export function generateBoard(kind: 'beginner' | 'random', rng: Rng): Board {
  if (kind === 'beginner') return { hexes: assignNumbers(BEGINNER_TERRAINS), ports: buildPorts(BEGINNER_PORTS) };
  let hexes: BoardHex[] = [];
  for (let attempt = 0; attempt < 200; attempt++) {
    hexes = assignNumbers(rng.shuffle(BEGINNER_TERRAINS));
    if (!redNumbersAdjacent(hexes)) break;
  }
  return { hexes, ports: buildPorts(rng.shuffle(BEGINNER_PORTS)) };
}

export { redNumbersAdjacent };
