import { describe, expect, it } from 'vitest';
import { GAMES } from './index';

describe('registro de jogos', () => {
  it('ids batem com as chaves e são únicos', () => {
    for (const [k, g] of Object.entries(GAMES)) expect(g.id).toBe(k);
  });
  it('todo jogo tem nome, descrição e opções com padrão válido', () => {
    for (const g of Object.values(GAMES)) {
      expect(g.name.length).toBeGreaterThan(0);
      expect(g.description.length).toBeGreaterThan(0);
      for (const f of g.optionsSchema) {
        if (f.type === 'select') expect(f.choices.some((c) => c.value === f.default)).toBe(true);
        if (f.type === 'number') {
          if (f.min !== undefined) expect(f.default).toBeGreaterThanOrEqual(f.min);
          if (f.max !== undefined) expect(f.default).toBeLessThanOrEqual(f.max);
        }
      }
    }
  });
});
