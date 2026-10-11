/**
 * Utilitários para tabuleiros hexagonais (hexágonos "pointy-top", coordenadas axiais).
 * Gera o grafo de vértices (cruzamentos) e arestas (lados) compartilhados entre hexágonos,
 * usado por jogos como Catan, Terra Mystica etc.
 */

export interface Axial {
  q: number;
  r: number;
}

export interface HexCell extends Axial {
  id: string;
  /** Centro em pixels (tamanho do hexágono = 1). */
  x: number;
  y: number;
  vertices: string[]; // 6 cantos, sentido horário a partir do canto superior direito
  edges: string[]; // 6 lados, edges[i] liga vertices[i] e vertices[(i+1)%6]
}

export interface HexVertex {
  id: string;
  x: number;
  y: number;
  hexes: string[];
  neighbors: string[];
  edges: string[];
}

export interface HexEdge {
  id: string;
  vertices: [string, string];
  hexes: string[];
}

export interface HexGraph {
  hexes: Record<string, HexCell>;
  vertices: Record<string, HexVertex>;
  edges: Record<string, HexEdge>;
  hexOrder: string[];
  vertexOrder: string[];
  edgeOrder: string[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

const SQRT3 = Math.sqrt(3);

export const AXIAL_DIRECTIONS: Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexId(q: number, r: number): string {
  return `${q},${r}`;
}

export function axialToPixel(q: number, r: number): { x: number; y: number } {
  return { x: SQRT3 * (q + r / 2), y: 1.5 * r };
}

export function hexDistance(a: Axial, b: Axial): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

/** Todos os hexágonos a até `radius` passos do centro. */
export function hexagonShape(radius: number): Axial[] {
  const out: Axial[] = [];
  for (let r = -radius; r <= radius; r++) {
    for (let q = -radius; q <= radius; q++) {
      if (Math.abs(q + r) <= radius) out.push({ q, r });
    }
  }
  return out;
}

/**
 * Ordem espiral (de fora para dentro, sentido horário) começando no canto superior-esquerdo,
 * útil para distribuir fichas numéricas.
 */
export function spiralOrder(radius: number): Axial[] {
  const out: Axial[] = [];
  for (let k = radius; k > 0; k--) {
    // começa no canto "noroeste" do anel k
    let cur: Axial = { q: 0, r: -k };
    // direções no sentido horário a partir do topo-esquerdo: leste, sudeste, sudoeste, oeste, noroeste, nordeste
    const dirs: Axial[] = [
      { q: 1, r: 0 },
      { q: 0, r: 1 },
      { q: -1, r: 1 },
      { q: -1, r: 0 },
      { q: 0, r: -1 },
      { q: 1, r: -1 },
    ];
    for (const d of dirs) {
      for (let s = 0; s < k; s++) {
        out.push(cur);
        cur = { q: cur.q + d.q, r: cur.r + d.r };
      }
    }
  }
  out.push({ q: 0, r: 0 });
  return out;
}

function pointKey(x: number, y: number): string {
  return `${Math.round(x * 1000)}:${Math.round(y * 1000)}`;
}

export function buildHexGraph(cells: Axial[]): HexGraph {
  const rawVertices = new Map<string, { x: number; y: number; hexes: Set<string> }>();
  const hexCorners: Record<string, string[]> = {};

  for (const c of cells) {
    const id = hexId(c.q, c.r);
    const { x, y } = axialToPixel(c.q, c.r);
    const corners: string[] = [];
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 180) * (60 * i - 30);
      const vx = x + Math.cos(ang);
      const vy = y + Math.sin(ang);
      const key = pointKey(vx, vy);
      if (!rawVertices.has(key)) rawVertices.set(key, { x: vx, y: vy, hexes: new Set() });
      rawVertices.get(key)!.hexes.add(id);
      corners.push(key);
    }
    hexCorners[id] = corners;
  }

  // IDs estáveis: ordena por y e depois x
  const sortedKeys = [...rawVertices.keys()].sort((a, b) => {
    const va = rawVertices.get(a)!;
    const vb = rawVertices.get(b)!;
    return Math.round(va.y * 1000) - Math.round(vb.y * 1000) || Math.round(va.x * 1000) - Math.round(vb.x * 1000);
  });
  const keyToId = new Map<string, string>();
  sortedKeys.forEach((k, i) => keyToId.set(k, `v${i}`));

  const vertices: Record<string, HexVertex> = {};
  for (const k of sortedKeys) {
    const v = rawVertices.get(k)!;
    const id = keyToId.get(k)!;
    vertices[id] = { id, x: round(v.x), y: round(v.y), hexes: [...v.hexes].sort(), neighbors: [], edges: [] };
  }

  const edges: Record<string, HexEdge> = {};
  const hexes: Record<string, HexCell> = {};
  const edgeKey = (a: string, b: string) => {
    const na = Number(a.slice(1));
    const nb = Number(b.slice(1));
    return na < nb ? `e${na}-${nb}` : `e${nb}-${na}`;
  };

  for (const c of cells) {
    const id = hexId(c.q, c.r);
    const { x, y } = axialToPixel(c.q, c.r);
    const vIds = hexCorners[id].map((k) => keyToId.get(k)!);
    const eIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const a = vIds[i];
      const b = vIds[(i + 1) % 6];
      const eid = edgeKey(a, b);
      if (!edges[eid]) {
        const [lo, hi] = Number(a.slice(1)) < Number(b.slice(1)) ? [a, b] : [b, a];
        edges[eid] = { id: eid, vertices: [lo, hi], hexes: [] };
        vertices[a].neighbors.push(b);
        vertices[b].neighbors.push(a);
        vertices[a].edges.push(eid);
        vertices[b].edges.push(eid);
      }
      edges[eid].hexes.push(id);
      eIds.push(eid);
    }
    hexes[id] = { id, q: c.q, r: c.r, x: round(x), y: round(y), vertices: vIds, edges: eIds };
  }

  const xs = Object.values(vertices).map((v) => v.x);
  const ys = Object.values(vertices).map((v) => v.y);
  return {
    hexes,
    vertices,
    edges,
    hexOrder: cells.map((c) => hexId(c.q, c.r)),
    vertexOrder: Object.keys(vertices),
    edgeOrder: Object.keys(edges).sort(),
    bounds: { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) },
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Arestas do contorno externo (pertencem a um único hexágono), em ordem ao redor do tabuleiro. */
export function coastalEdges(graph: HexGraph): string[] {
  const coast = Object.values(graph.edges).filter((e) => e.hexes.length === 1);
  if (coast.length === 0) return [];
  // percorre o contorno a partir da aresta mais ao topo
  const byVertex = new Map<string, string[]>();
  for (const e of coast) {
    for (const v of e.vertices) {
      if (!byVertex.has(v)) byVertex.set(v, []);
      byVertex.get(v)!.push(e.id);
    }
  }
  const start = coast.slice().sort((a, b) => {
    const ya = Math.min(...a.vertices.map((v) => graph.vertices[v].y));
    const yb = Math.min(...b.vertices.map((v) => graph.vertices[v].y));
    const xa = Math.min(...a.vertices.map((v) => graph.vertices[v].x));
    const xb = Math.min(...b.vertices.map((v) => graph.vertices[v].x));
    return ya - yb || xa - xb;
  })[0];
  const order: string[] = [start.id];
  const visited = new Set(order);
  // direção: segue pelo vértice mais à direita para andar no sentido horário
  let [va, vb] = start.vertices;
  let cur = graph.vertices[va].x > graph.vertices[vb].x ? va : vb;
  while (order.length < coast.length) {
    const next = byVertex.get(cur)!.find((eid) => !visited.has(eid));
    if (!next) break;
    order.push(next);
    visited.add(next);
    const e = graph.edges[next];
    cur = e.vertices[0] === cur ? e.vertices[1] : e.vertices[0];
  }
  return order;
}
