import { describe, expect, it } from 'vitest';
import { arrangeSeats } from './seats';

const regions = (order: string[], viewer: string | null) => arrangeSeats(order, viewer).map((s) => `${s.id}:${s.region}`);

describe('arrangeSeats', () => {
  it('quem vê fica embaixo e os demais seguem a ordem da mesa', () => {
    expect(regions(['a', 'b', 'c', 'd'], 'c')).toEqual(['c:bottom', 'd:right', 'a:top', 'b:left']);
    expect(regions(['a', 'b'], 'b')).toEqual(['b:bottom', 'a:top']);
    expect(regions(['a', 'b', 'c'], 'a')).toEqual(['a:bottom', 'b:right', 'c:left']);
  });

  it('espectador vê o 1º assento embaixo', () => {
    expect(regions(['a', 'b', 'c', 'd'], null)[0]).toBe('a:bottom');
    expect(regions(['a', 'b', 'c', 'd'], 'x')[0]).toBe('a:bottom');
  });

  it('direção aponta do centro para o assento', () => {
    const [me, right, top] = arrangeSeats(['a', 'b', 'c', 'd'], 'a');
    expect([me.dx, me.dy]).toEqual([0, 1]);
    expect([right.dx, right.dy]).toEqual([1, 0]);
    expect([top.dx, top.dy]).toEqual([0, -1]);
  });
});
