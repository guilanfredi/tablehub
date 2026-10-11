import { describe, expect, it } from 'vitest';
import { buildHexGraph, coastalEdges, hexagonShape, spiralOrder } from './hexgrid';
import { normalizeOptions } from './options';
import { Rng } from './rng';

describe('Rng', () => {
  it('é determinístico pela semente', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const xs = Array.from({ length: 10 }, () => a.next());
    expect(Array.from({ length: 10 }, () => b.next())).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('shuffle preserva os elementos e retoma do estado salvo', () => {
    const r = new Rng(7);
    const s = r.shuffle([1, 2, 3, 4, 5, 6]);
    expect([...s].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    const resumed = new Rng(r.state);
    expect(resumed.next()).toBe(r.next());
  });
});

describe('hexgrid', () => {
  const cells = hexagonShape(2);
  const g = buildHexGraph(cells);

  it('tabuleiro de raio 2 tem 19 hexágonos, 54 vértices e 72 arestas (Catan)', () => {
    expect(cells.length).toBe(19);
    expect(Object.keys(g.vertices).length).toBe(54);
    expect(Object.keys(g.edges).length).toBe(72);
  });

  it('cada vértice toca 1 a 3 hexágonos e tem 2 a 3 vizinhos', () => {
    for (const v of Object.values(g.vertices)) {
      expect(v.hexes.length).toBeGreaterThanOrEqual(1);
      expect(v.hexes.length).toBeLessThanOrEqual(3);
      expect(v.neighbors.length).toBeGreaterThanOrEqual(2);
      expect(v.neighbors.length).toBeLessThanOrEqual(3);
    }
  });

  it('espiral cobre todos os hexágonos uma única vez', () => {
    const sp = spiralOrder(2);
    expect(sp.length).toBe(19);
    expect(new Set(sp.map((h) => `${h.q},${h.r}`)).size).toBe(19);
  });

  it('contorno do tabuleiro tem 30 arestas encadeadas', () => {
    const coast = coastalEdges(g);
    expect(coast.length).toBe(30);
    for (let i = 0; i < coast.length; i++) {
      const a = g.edges[coast[i]].vertices;
      const b = g.edges[coast[(i + 1) % coast.length]].vertices;
      expect(a.some((v) => b.includes(v))).toBe(true);
    }
  });
});

describe('normalizeOptions', () => {
  it('aplica padrões, limites e ignora valores inválidos', () => {
    const schema = [
      { type: 'number' as const, key: 'n', label: 'n', default: 5, min: 1, max: 10 },
      { type: 'select' as const, key: 's', label: 's', default: 'a', choices: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
      { type: 'boolean' as const, key: 'b', label: 'b', default: false },
    ];
    expect(normalizeOptions(schema, { n: 50, s: 'z', b: 'yes', extra: 1 })).toEqual({ n: 10, s: 'a', b: false });
    expect(normalizeOptions(schema, { s: 'b', b: true })).toEqual({ n: 5, s: 'b', b: true });
  });
});
