import { Rng } from '../rng';
import { defaultOptions } from '../options';
import { runAction } from '../runner';
import { isActionError, type GameDefinition, type GameOptions, type PlayerSeat } from '../types';
import { LOG_LIMIT, type GameLog } from '../log';

export interface ConformanceConfig {
  /** Quantidades de jogadores a testar (padrão: min e max). */
  playerCounts?: number[];
  /** Conjuntos de opções a testar (padrão: opções padrão). */
  optionSets?: GameOptions[];
  /** Sementes por combinação. */
  seeds?: number;
  maxSteps?: number;
  /** Se verdadeiro, toda partida aleatória precisa terminar dentro de maxSteps. */
  requireFinish?: boolean;
  /**
   * Verifica se a view de `viewerId` vaza informação secreta de outros jogadores.
   * Deve retornar uma mensagem de erro ou null.
   */
  leakCheck?: (state: any, viewerId: string, view: any) => string | null;
  /** Escolhe a ação entre as legais (padrão: aleatória). Útil para guiar partidas longas. */
  chooseAction?: (legal: any[], rng: Rng, state: any, playerId: string) => any;
  /** Verifica se o histórico (público, igual para todos) revela informação oculta. Erro ou null. */
  logLeakCheck?: (state: any, log: GameLog) => string | null;
}

export interface ConformanceReport {
  games: number;
  finished: number;
  totalSteps: number;
}

export function makePlayers(n: number): PlayerSeat[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Jogador ${i + 1}`, seat: i }));
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

/** Joga uma partida aleatória e devolve o histórico de ações e o estado final. */
export function randomPlayout(
  def: GameDefinition,
  playerCount: number,
  options: GameOptions,
  seed: number,
  cfg: ConformanceConfig = {},
) {
  const players = makePlayers(playerCount);
  const rng = new Rng(seed ^ 0x9e3779b9);
  let state = def.setup({ players, options, seed });
  const history: { playerId: string; action: unknown }[] = [];
  const maxSteps = cfg.maxSteps ?? 2000;
  const ctx = `[${def.id} n=${playerCount} seed=${seed} opts=${JSON.stringify(options)}]`;
  let logTotal = 0;

  for (let step = 0; step < maxSteps; step++) {
    const status = def.getStatus(state);
    if (status.phase === 'finished') return { state, history, finished: true };
    assert(status.currentPlayers.length > 0, `${ctx} passo ${step}: nenhum jogador pode agir (jogo travado)`);

    const withActions = status.currentPlayers
      .map((p) => ({ p, legal: def.getLegalActions(state, p) }))
      .filter((x) => x.legal.length > 0);
    assert(withActions.length > 0, `${ctx} passo ${step}: jogadores da vez sem ações legais (jogo travado)`);

    const { p, legal } = rng.pick(withActions);
    const action = cfg.chooseAction ? cfg.chooseAction(legal, rng, state, p) : rng.pick(legal);
    const result = runAction(def, state, p, action);
    assert(!isActionError(result), `${ctx} passo ${step}: ação legal rejeitada ${JSON.stringify(action)} -> ${(result as any).error}`);
    state = result;
    history.push({ playerId: p, action });
    if (def.getLog) {
      const total = def.getLog(state).total;
      assert(total >= logTotal, `${ctx} passo ${step}: total do histórico diminuiu`);
      logTotal = total;
    }

    if (step % 25 === 0) checkState(def, state, players, ctx, cfg);
  }
  return { state, history, finished: def.getStatus(state).phase === 'finished' };
}

function checkState(def: GameDefinition, state: any, players: PlayerSeat[], ctx: string, cfg: ConformanceConfig) {
  const json = JSON.stringify(state);
  assert(JSON.stringify(JSON.parse(json)) === json, `${ctx}: estado não é estável em JSON`);
  for (const pl of [...players.map((p) => p.id), null]) {
    const view = def.getPlayerView(state, pl);
    JSON.stringify(view);
    if (pl && cfg.leakCheck) {
      const leak = cfg.leakCheck(state, pl, view);
      assert(!leak, `${ctx}: vazamento de informação para ${pl}: ${leak}`);
    }
  }
  if (def.getLog) checkLog(def.getLog(state), state, players, ctx, cfg);
}

function checkLog(log: GameLog, state: any, players: PlayerSeat[], ctx: string, cfg: ConformanceConfig) {
  assert(log && Array.isArray(log.entries) && Number.isInteger(log.total), `${ctx}: getLog fora do formato { total, entries }`);
  assert(log.entries.length <= LOG_LIMIT, `${ctx}: histórico com mais de ${LOG_LIMIT} entradas`);
  assert(log.total >= log.entries.length, `${ctx}: total do histórico menor que as entradas`);
  const ids = new Set(players.map((p) => p.id));
  for (const e of log.entries) {
    assert(typeof e.text === 'string' && e.text.length > 0, `${ctx}: entrada do histórico sem texto`);
    assert(e.by === undefined || ids.has(e.by), `${ctx}: entrada do histórico com autor desconhecido ${e.by}`);
  }
  if (cfg.logLeakCheck) {
    const leak = cfg.logLeakCheck(state, log);
    assert(!leak, `${ctx}: histórico revela informação oculta: ${leak}`);
  }
}

/**
 * Bateria genérica que todo jogo precisa passar. Lança erro com contexto em caso de falha.
 */
export function runConformance(def: GameDefinition, cfg: ConformanceConfig = {}): ConformanceReport {
  assert(def.id && /^[a-z0-9-]+$/.test(def.id), 'id do jogo deve ser kebab-case');
  assert(def.minPlayers >= 1 && def.maxPlayers >= def.minPlayers, 'min/max de jogadores inválido');
  const keys = new Set<string>();
  for (const f of def.optionsSchema) {
    assert(!keys.has(f.key), `opção duplicada: ${f.key}`);
    keys.add(f.key);
  }

  const counts = cfg.playerCounts ?? [...new Set([def.minPlayers, def.maxPlayers])];
  const optionSets = cfg.optionSets ?? [defaultOptions(def.optionsSchema)];
  const seeds = cfg.seeds ?? 5;
  const report: ConformanceReport = { games: 0, finished: 0, totalSteps: 0 };

  for (const n of counts) {
    for (const opts of optionSets) {
      if (def.validateConfig(opts, n)) continue; // combinação inválida é ignorada
      assert(def.rulesSummary(opts, n).length > 0, 'rulesSummary vazio');
      for (let s = 1; s <= seeds; s++) {
        const seed = s * 7919 + n * 104729;
        const a = randomPlayout(def, n, opts, seed, cfg);
        report.games++;
        report.totalSteps += a.history.length;
        if (a.finished) report.finished++;
        if (cfg.requireFinish) assert(a.finished, `[${def.id} n=${n} seed=${seed}] partida não terminou em ${cfg.maxSteps ?? 2000} passos`);

        // determinismo: repetir as mesmas ações gera o mesmo estado
        let replay = def.setup({ players: makePlayers(n), options: opts, seed });
        for (const h of a.history) {
          const r = runAction(def, replay, h.playerId, h.action);
          assert(!isActionError(r), `[${def.id}] replay rejeitou ação ${JSON.stringify(h.action)}`);
          replay = r;
        }
        assert(JSON.stringify(replay) === JSON.stringify(a.state), `[${def.id} n=${n} seed=${seed}] jogo não é determinístico`);

        // ação inválida deve ser rejeitada sem lançar exceção
        const st = def.getStatus(a.state);
        if (st.phase === 'playing') {
          const r = runAction(def, a.state, st.currentPlayers[0], { type: '__invalid_action__' });
          assert(isActionError(r), `[${def.id}] ação inválida foi aceita`);
          const outsider = runAction(def, a.state, 'not-a-player', { type: '__invalid_action__' });
          assert(isActionError(outsider), `[${def.id}] jogador de fora conseguiu agir`);
        }
      }
    }
  }
  return report;
}
