import { emptyLog, pushLog, type GameDefinition, type GameLog } from '@tablehub/game-sdk';

/** Jogo mínimo usado nos testes da plataforma: cada jogador soma pontos até alguém chegar ao alvo. */
interface CounterState {
  players: string[];
  turn: number;
  scores: Record<string, number>;
  target: number;
  winner: string | null;
  log: GameLog;
}

export const counterGame: GameDefinition<CounterState, { type: 'add'; n: 1 | 2 }> = {
  id: 'counter',
  name: 'Contador',
  description: 'Jogo de teste',
  minPlayers: 2,
  maxPlayers: 4,
  optionsSchema: [
    { type: 'number', key: 'target', label: 'Alvo', default: 5, min: 3, max: 20 },
    { type: 'boolean', key: 'fast', label: 'Rápido', default: false },
  ],
  rulesSummary: (o) => [`Primeiro a chegar em ${o.target} vence.`],
  validateConfig: (o, n) => (o.fast && n > 3 ? 'Modo rápido aceita até 3 jogadores.' : null),
  setup: ({ players, options }) => ({
    players: players.map((p) => p.id),
    turn: 0,
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    target: Number(options.target),
    winner: null,
    log: emptyLog(),
  }),
  getPlayerView: (s) => s,
  getLegalActions: () => [
    { type: 'add', n: 1 },
    { type: 'add', n: 2 },
  ],
  applyAction(s, pid, a) {
    if (a.type !== 'add' || (a.n !== 1 && a.n !== 2)) return { error: 'Ação inválida' };
    s.scores[pid] += a.n;
    s.log = pushLog(s.log, `${pid} somou ${a.n}`, pid);
    if (s.scores[pid] >= s.target) s.winner = pid;
    else s.turn = (s.turn + 1) % s.players.length;
    return s;
  },
  getStatus: (s) =>
    s.winner
      ? { phase: 'finished', currentPlayers: [], winners: [s.winner], scores: s.scores }
      : { phase: 'playing', currentPlayers: [s.players[s.turn]], scores: s.scores },
  getLog: (s) => s.log,
};
