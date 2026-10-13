import { describe, expect, it } from 'vitest';
import { countSince, useHistory } from './history';

const log = (total: number, by: (string | undefined)[]) => ({ total, entries: by.map((b, i) => ({ text: `l${i}`, by: b })) });

describe('histórico: não lidas', () => {
  it('conta só jogadas de outros desde a marca', () => {
    expect(countSince(log(5, ['a', 'b', undefined, 'me', 'b']), 2, 'me')).toBe(2);
    expect(countSince(log(5, ['a', 'b']), 5, 'me')).toBe(0);
    expect(countSince(log(5, ['a']), null, 'me')).toBe(0);
  });

  it('o que saiu da janela de 60 conta como jogada', () => {
    expect(countSince(log(100, ['me', 'me']), 90, 'me')).toBe(8);
  });

  it('1ª atualização marca tudo como visto; partida nova zera; painel à vista acompanha', () => {
    const h = useHistory.getState();
    h.reset();
    h.sync(10, false);
    expect(useHistory.getState().seen).toBe(10);
    h.sync(14, false);
    expect(useHistory.getState().seen).toBe(10);
    h.sync(16, true);
    expect(useHistory.getState().seen).toBe(16);
    h.sync(2, false); // outra partida
    expect(useHistory.getState().seen).toBe(2);
  });
});
