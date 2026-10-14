import { describe, expect, it } from 'vitest';
import { markdown, parseEvents, summarize } from './agent-summary.mjs';

const result = {
  type: 'result', subtype: 'success', is_error: false, duration_ms: 90_000, duration_api_ms: 60_000, num_turns: 14,
  total_cost_usd: 0.42, result: 'PR #39 sem bloqueantes.',
  usage: { input_tokens: 5, cache_creation_input_tokens: 10, cache_read_input_tokens: 20, output_tokens: 30 },
  modelUsage: { 'claude-opus-5-5': { inputTokens: 100, cacheCreationInputTokens: 200, cacheReadInputTokens: 300_000, outputTokens: 400 } },
};

describe('resumo da execução no Actions', () => {
  it('lê lista JSON e JSON Lines', () => {
    expect(parseEvents(JSON.stringify([{ type: 'system' }, result]))).toHaveLength(2);
    expect(parseEvents(`{"type":"system"}\nlixo\n${JSON.stringify(result)}\n`)).toHaveLength(2);
    expect(parseEvents('')).toEqual([]);
  });

  it('usa o último resultado e soma os tokens de todos os modelos da sessão', () => {
    const s = summarize([{ type: 'system' }, result]);
    expect(s).toMatchObject({ outcome: 'ok', durationMin: 1.5, apiMin: 1, turns: 14, costUsd: 0.42, models: ['claude-opus-5-5'] });
    expect(s.tokens).toEqual({ input: 100, cacheWrite: 200, cacheRead: 300_000, output: 400 });
  });

  it('sem modelUsage, usa o usage do resultado; marca erros', () => {
    const s = summarize([{ ...result, modelUsage: undefined, is_error: true, subtype: 'error_max_turns' }]);
    expect(s.tokens).toEqual({ input: 5, cacheWrite: 10, cacheRead: 20, output: 30 });
    expect(s.outcome).toBe('erro (error_max_turns)');
  });

  it('sem resultado, diz isso no resumo', () => {
    expect(summarize([{ type: 'system' }])).toBeNull();
    expect(markdown(null, 'revisor', 39)).toMatch(/sem resultado/);
    expect(markdown(summarize([result]), 'revisor', 39)).toMatch(/revisor #39: ok/);
  });
});
