/**
 * Gerador pseudoaleatório determinístico (mulberry32). O estado é um único número,
 * que deve ser guardado no estado do jogo para manter as partidas reprodutíveis.
 */
export class Rng {
  constructor(public state: number) {
    this.state = state >>> 0;
  }

  /** Número em [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Inteiro em [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)];
  }

  /** Embaralha uma cópia (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  dice(sides = 6): number {
    return this.int(sides) + 1;
  }
}

export function randomSeed(): number {
  return (Math.random() * 4294967296) >>> 0;
}
