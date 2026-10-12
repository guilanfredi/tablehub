import { describe, expect, it } from 'vitest';
import { runConformance } from '@tablehub/game-sdk/testing';
import { kingOfTokyo } from './engine';

describe('King of Tokyo', () => {
  it.todo('regras específicas (uma por item do RULES.md)');

  it('passa na bateria de conformidade', () => {
    const r = runConformance(kingOfTokyo, { maxSteps: 3000, requireFinish: false });
    expect(r.games).toBeGreaterThan(0);
  });
});
