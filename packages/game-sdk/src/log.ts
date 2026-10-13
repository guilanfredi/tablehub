/** Uma linha do histórico da partida. `by` é o id de quem agiu, quando houver. */
export interface LogEntry {
  text: string;
  by?: string;
}

/**
 * Histórico público da partida. `entries` guarda só as últimas `LOG_LIMIT`;
 * `total` conta tudo que já entrou (base do contador de não lidas).
 */
export interface GameLog {
  total: number;
  entries: LogEntry[];
}

export const LOG_LIMIT = 60;

export function emptyLog(): GameLog {
  return { total: 0, entries: [] };
}

/** Converte o formato antigo (`string[]`, de partidas anteriores ao histórico comum) para `GameLog`. */
export function toGameLog(raw: unknown): GameLog {
  if (Array.isArray(raw)) {
    const entries = raw.filter((t): t is string => typeof t === 'string').slice(-LOG_LIMIT).map((text) => ({ text }));
    return { total: raw.length, entries };
  }
  if (raw && typeof raw === 'object' && Array.isArray((raw as GameLog).entries)) return raw as GameLog;
  return emptyLog();
}

/** Acrescenta uma linha (mantendo as últimas `LOG_LIMIT`) e devolve o log, já convertido se vier no formato antigo. */
export function pushLog(log: GameLog | string[] | undefined, text: string, by?: string): GameLog {
  const l = toGameLog(log);
  l.entries.push(by === undefined ? { text } : { text, by });
  l.total++;
  if (l.entries.length > LOG_LIMIT) l.entries.splice(0, l.entries.length - LOG_LIMIT);
  return l;
}
