import type { GameDefinition, GameOptions, OptionField } from './types';

export function defaultOptions(schema: OptionField[]): GameOptions {
  const out: GameOptions = {};
  for (const f of schema) out[f.key] = f.default;
  return out;
}

/** Mescla valores recebidos com os padrões, descartando chaves e tipos inválidos. */
export function normalizeOptions(schema: OptionField[], input: Record<string, unknown> | undefined): GameOptions {
  const out = defaultOptions(schema);
  if (!input) return out;
  for (const f of schema) {
    const v = input[f.key];
    if (v === undefined) continue;
    if (f.type === 'boolean' && typeof v === 'boolean') out[f.key] = v;
    else if (f.type === 'number' && typeof v === 'number' && Number.isFinite(v)) {
      let n = v;
      if (f.min !== undefined) n = Math.max(f.min, n);
      if (f.max !== undefined) n = Math.min(f.max, n);
      out[f.key] = n;
    } else if (f.type === 'select' && f.choices.some((c) => c.value === v)) out[f.key] = v as string | number;
  }
  return out;
}

export function checkPlayerCount(def: GameDefinition, playerCount: number): string | null {
  if (playerCount < def.minPlayers) return `${def.name} precisa de pelo menos ${def.minPlayers} jogadores.`;
  if (playerCount > def.maxPlayers) return `${def.name} aceita no máximo ${def.maxPlayers} jogadores.`;
  return null;
}
