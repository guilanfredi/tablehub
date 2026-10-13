import { Rng, pushLog, toGameLog, type GameDefinition, type GameLog, type GameStatus } from '@tablehub/game-sdk';

export type Tile = [number, number]; // a <= b
export type Side = 'left' | 'right';

export interface DominoOptions {
  mode: 'bloqueio' | 'compra';
  pointsToWin: number;
  teams: boolean;
  [k: string]: string | number | boolean;
}

export type DominoAction =
  | { type: 'play'; tile: Tile; side: Side }
  | { type: 'draw' }
  | { type: 'pass' };

export interface PlacedTile {
  tile: Tile;
  /** Valores na ordem em que aparecem na linha (esquerda → direita). */
  shown: [number, number];
  by: string;
}

export interface RoundSummary {
  round: number;
  reason: 'batida' | 'fechado';
  winners: string[]; // vazio = empate
  points: number;
  hands: Record<string, Tile[]>;
}

export interface DominoState {
  options: DominoOptions;
  players: { id: string; name: string }[];
  rng: number;
  round: number;
  hands: Record<string, Tile[]>;
  boneyard: Tile[];
  line: PlacedTile[];
  turn: number; // índice em players
  passes: number; // passes consecutivos
  /** Na 1ª rodada, a peça que obrigatoriamente abre o jogo. */
  forcedOpening: Tile | null;
  scores: Record<string, number>; // por jogador (em duplas, ambos recebem os pontos da dupla)
  lastRound: RoundSummary | null;
  lastAction: { playerId: string; text: string } | null;
  /** Histórico público; ausente em partidas anteriores ao histórico comum. */
  log?: GameLog;
  winners: string[] | null;
}

const pips = (t: Tile) => t[0] + t[1];
const sameTile = (a: Tile, b: Tile) => a[0] === b[0] && a[1] === b[1];
const tileLabel = (t: Tile) => `[${t[0]}|${t[1]}]`;

export function fullSet(): Tile[] {
  const out: Tile[] = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) out.push([a, b]);
  return out;
}

function ends(s: DominoState): { left: number; right: number } | null {
  if (s.line.length === 0) return null;
  return { left: s.line[0].shown[0], right: s.line[s.line.length - 1].shown[1] };
}

function teamOf(s: DominoState, idx: number): number {
  return s.options.teams ? idx % 2 : idx;
}

function teamMembers(s: DominoState, idx: number): string[] {
  const t = teamOf(s, idx);
  return s.players.filter((_, i) => teamOf(s, i) === t).map((p) => p.id);
}

function playableSides(s: DominoState, tile: Tile): Side[] {
  if (s.forcedOpening) return sameTile(tile, s.forcedOpening) ? ['left'] : [];
  const e = ends(s);
  if (!e) return ['left'];
  const sides: Side[] = [];
  if (tile[0] === e.left || tile[1] === e.left) sides.push('left');
  if (tile[0] === e.right || tile[1] === e.right) sides.push('right');
  // peça que encaixa igualmente dos dois lados (ex.: pontas iguais) — mantém só uma opção
  if (sides.length === 2 && e.left === e.right) return ['left'];
  return sides;
}

function hasPlay(s: DominoState, pid: string): boolean {
  return s.hands[pid].some((t) => playableSides(s, t).length > 0);
}

function deal(s: DominoState, rng: Rng, starter: number | null): void {
  const tiles = rng.shuffle(fullSet());
  s.hands = {};
  for (const p of s.players) s.hands[p.id] = tiles.splice(0, 7);
  s.boneyard = s.options.mode === 'compra' ? tiles : [];
  s.line = [];
  s.passes = 0;
  s.forcedOpening = null;

  if (starter !== null) {
    s.turn = starter;
    return;
  }
  // 1ª rodada: começa quem tem o maior duplo (ou, sem duplos, a peça mais alta)
  let best: { idx: number; tile: Tile; score: number } | null = null;
  s.players.forEach((p, idx) => {
    for (const t of s.hands[p.id]) {
      const score = (t[0] === t[1] ? 100 : 0) + pips(t) * 2 + (t[0] === t[1] ? 0 : t[1] / 10);
      if (!best || score > best.score) best = { idx, tile: t, score };
    }
  });
  const b = best as unknown as { idx: number; tile: Tile };
  s.turn = b.idx;
  s.forcedOpening = b.tile;
}

function setup(players: { id: string; name: string }[], options: DominoOptions, seed: number): DominoState {
  const rng = new Rng(seed);
  const s: DominoState = {
    options,
    players: players.map((p) => ({ id: p.id, name: p.name })),
    rng: 0,
    round: 1,
    hands: {},
    boneyard: [],
    line: [],
    turn: 0,
    passes: 0,
    forcedOpening: null,
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    lastRound: null,
    lastAction: null,
    log: { total: 0, entries: [] },
    winners: null,
  };
  deal(s, rng, null);
  s.rng = rng.state;
  return s;
}

function log(s: DominoState, text: string, by?: string): void {
  s.log = pushLog(s.log, text, by);
}

const names = (s: DominoState, ids: string[]) => s.players.filter((p) => ids.includes(p.id)).map((p) => p.name).join(' e ');

function nextTurn(s: DominoState): void {
  s.turn = (s.turn + 1) % s.players.length;
}

function endRound(s: DominoState, reason: 'batida' | 'fechado', winnerIdx: number | null): void {
  const hands = structuredClone(s.hands);
  let winners: string[] = [];
  let points = 0;

  if (reason === 'fechado') {
    // menor soma (por dupla, se jogando em duplas) vence
    const totals = new Map<number, number>();
    s.players.forEach((p, i) => totals.set(teamOf(s, i), (totals.get(teamOf(s, i)) ?? 0) + s.hands[p.id].reduce((a, t) => a + pips(t), 0)));
    const min = Math.min(...totals.values());
    const best = [...totals.entries()].filter(([, v]) => v === min);
    if (best.length === 1) {
      const team = best[0][0];
      winnerIdx = s.players.findIndex((_, i) => teamOf(s, i) === team);
    } else winnerIdx = null;
  }

  if (winnerIdx !== null) {
    winners = teamMembers(s, winnerIdx);
    points = s.players.filter((p) => !winners.includes(p.id)).reduce((acc, p) => acc + s.hands[p.id].reduce((a, t) => a + pips(t), 0), 0);
    for (const w of winners) s.scores[w] += points;
  }

  s.lastRound = { round: s.round, reason, winners, points, hands };
  const how = reason === 'batida' ? `${names(s, [s.players[winnerIdx!].id])} bateu` : 'Jogo fechado';
  log(s, winners.length ? `Rodada ${s.round}: ${how}. ${names(s, winners)} +${points} pontos.` : `Rodada ${s.round}: ${how}, empate. Ninguém pontua.`);
  const champs = s.players.filter((p) => s.scores[p.id] >= s.options.pointsToWin);
  if (champs.length > 0) {
    const max = Math.max(...champs.map((p) => s.scores[p.id]));
    s.winners = champs.filter((p) => s.scores[p.id] === max).map((p) => p.id);
    log(s, `${names(s, s.winners)} venceu a partida com ${max} pontos!`);
    return;
  }

  // nova rodada: começa o vencedor (em empate, quem começou a rodada anterior segue a vez)
  const rng = new Rng(s.rng);
  s.round++;
  const starter = winnerIdx ?? s.turn;
  deal(s, rng, starter);
  s.rng = rng.state;
}

function applyAction(s: DominoState, pid: string, a: DominoAction): DominoState | { error: string } {
  const idx = s.players.findIndex((p) => p.id === pid);
  if (idx !== s.turn) return { error: 'Não é a sua vez.' };
  const hand = s.hands[pid];
  const name = s.players[idx].name;

  switch (a.type) {
    case 'play': {
      if (!Array.isArray(a.tile) || a.tile.length !== 2) return { error: 'Peça inválida.' };
      const tile: Tile = [Math.min(a.tile[0], a.tile[1]), Math.max(a.tile[0], a.tile[1])];
      const hi = hand.findIndex((t) => sameTile(t, tile));
      if (hi < 0) return { error: 'Você não tem essa peça.' };
      const sides = playableSides(s, tile);
      if (!sides.includes(a.side)) return { error: 'Essa peça não encaixa nesse lado.' };
      hand.splice(hi, 1);
      const e = ends(s);
      if (!e) s.line.push({ tile, shown: [tile[0], tile[1]], by: pid });
      else if (a.side === 'left') s.line.unshift({ tile, shown: tile[1] === e.left ? [tile[0], tile[1]] : [tile[1], tile[0]], by: pid });
      else s.line.push({ tile, shown: tile[0] === e.right ? [tile[0], tile[1]] : [tile[1], tile[0]], by: pid });
      s.forcedOpening = null;
      s.passes = 0;
      s.lastAction = { playerId: pid, text: `${name} jogou ${tileLabel(tile)}` };
      log(s, `${name} ${e ? `jogou ${tileLabel(tile)} na ponta ${a.side === 'left' ? 'esquerda' : 'direita'}` : `abriu com ${tileLabel(tile)}`}.`, pid);
      if (hand.length === 0) {
        endRound(s, 'batida', idx);
        return s;
      }
      nextTurn(s);
      return s;
    }
    case 'draw': {
      if (s.options.mode !== 'compra') return { error: 'No modo bloqueio não se compra peças.' };
      if (hasPlay(s, pid)) return { error: 'Você tem peça para jogar.' };
      if (s.boneyard.length === 0) return { error: 'O monte acabou; passe a vez.' };
      hand.push(s.boneyard.pop()!);
      s.lastAction = { playerId: pid, text: `${name} comprou uma peça` };
      log(s, `${name} comprou uma peça do monte.`, pid);
      return s;
    }
    case 'pass': {
      if (hasPlay(s, pid)) return { error: 'Você tem peça para jogar.' };
      if (s.options.mode === 'compra' && s.boneyard.length > 0) return { error: 'Compre do monte antes de passar.' };
      s.passes++;
      s.lastAction = { playerId: pid, text: `${name} passou` };
      log(s, `${name} passou a vez.`, pid);
      if (s.passes >= s.players.length) {
        endRound(s, 'fechado', null);
        return s;
      }
      nextTurn(s);
      return s;
    }
    default:
      return { error: 'Ação inválida.' };
  }
}

function legalActions(s: DominoState, pid: string): DominoAction[] {
  if (s.winners || s.players[s.turn].id !== pid) return [];
  const out: DominoAction[] = [];
  for (const t of s.hands[pid]) for (const side of playableSides(s, t)) out.push({ type: 'play', tile: t, side });
  if (out.length > 0) return out;
  if (s.options.mode === 'compra' && s.boneyard.length > 0) return [{ type: 'draw' }];
  return [{ type: 'pass' }];
}

export interface DominoView {
  players: { id: string; name: string; tiles: number; score: number; team: number }[];
  myHand: Tile[] | null;
  line: PlacedTile[];
  ends: { left: number; right: number } | null;
  boneyard: number;
  turn: string;
  round: number;
  options: DominoOptions;
  forcedOpening: Tile | null;
  lastRound: RoundSummary | null;
  lastAction: DominoState['lastAction'];
  winners: string[] | null;
}

function status(s: DominoState): GameStatus {
  if (s.winners) {
    const names = s.players.filter((p) => s.winners!.includes(p.id)).map((p) => p.name);
    return { phase: 'finished', currentPlayers: [], winners: s.winners, scores: s.scores, message: `${names.join(' e ')} venceu!` };
  }
  const cur = s.players[s.turn];
  return { phase: 'playing', currentPlayers: [cur.id], scores: s.scores, message: `Vez de ${cur.name}` };
}

export const domino: GameDefinition<DominoState, DominoAction, DominoOptions> = {
  id: 'domino',
  name: 'Dominó',
  description: 'Dominó duplo-6 clássico, em modo bloqueio ou com compra, individual ou em duplas.',
  minPlayers: 2,
  maxPlayers: 4,
  optionsSchema: [
    {
      type: 'select',
      key: 'mode',
      label: 'Modo',
      default: 'bloqueio',
      choices: [
        { value: 'bloqueio', label: 'Bloqueio (sem compra)' },
        { value: 'compra', label: 'Com compra (monte)' },
      ],
      description: 'Com compra, quem não tem peça compra do monte até poder jogar.',
    },
    {
      type: 'select',
      key: 'pointsToWin',
      label: 'Pontos para vencer',
      default: 100,
      choices: [
        { value: 50, label: '50 pontos' },
        { value: 100, label: '100 pontos' },
        { value: 150, label: '150 pontos' },
      ],
    },
    {
      type: 'boolean',
      key: 'teams',
      label: 'Jogar em duplas',
      default: false,
      description: 'Só com 4 jogadores. Parceiros sentam em lugares alternados (1º e 3º, 2º e 4º).',
      visibleWhen: (_o, n) => n === 4,
    },
  ],
  rulesSummary(o, n) {
    const lines = [
      'Dominó duplo-6: 28 peças, 7 para cada jogador.',
      o.mode === 'compra'
        ? n === 4
          ? 'Modo com compra — mas com 4 jogadores não sobra monte, então quem não tem peça passa.'
          : 'Modo com compra: sem peça para jogar, compre do monte até poder; monte vazio, passe.'
        : 'Modo bloqueio: sem peça para jogar, passe a vez.',
      'Na 1ª rodada começa quem tem o maior duplo, que deve ser jogado. Nas seguintes, começa o vencedor da rodada anterior.',
      'Batida: quem acabar as peças ganha a soma dos pontos das peças dos adversários.',
      'Jogo fechado (ninguém consegue jogar): vence quem tiver a menor soma na mão e ganha os pontos dos demais.',
      `Vence quem chegar a ${o.pointsToWin} pontos.`,
    ];
    if (o.teams && n === 4) lines.push('Em duplas: 1º e 3º jogadores contra 2º e 4º; os pontos são da dupla.');
    return lines;
  },
  seatLabel: (seat, o, n) => (o.teams && n === 4 ? (seat % 2 === 0 ? 'Dupla A' : 'Dupla B') : null),
  validateConfig(o, n) {
    if (o.teams && n !== 4) return 'Duplas exigem exatamente 4 jogadores.';
    return null;
  },
  setup: ({ players, options, seed }) => setup(players, { ...options, teams: Boolean(options.teams) && players.length === 4 }, seed),
  getPlayerView(s, pid): DominoView {
    return {
      players: s.players.map((p, i) => ({ id: p.id, name: p.name, tiles: s.hands[p.id].length, score: s.scores[p.id], team: teamOf(s, i) })),
      myHand: pid && s.hands[pid] ? s.hands[pid] : null,
      line: s.line,
      ends: ends(s),
      boneyard: s.boneyard.length,
      turn: s.players[s.turn].id,
      round: s.round,
      options: s.options,
      forcedOpening: s.forcedOpening && pid === s.players[s.turn].id ? s.forcedOpening : null,
      lastRound: s.lastRound,
      lastAction: s.lastAction,
      winners: s.winners,
    };
  },
  getLegalActions: legalActions,
  applyAction,
  getStatus: status,
  getLog: (s) => toGameLog(s.log),
};
