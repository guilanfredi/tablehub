import { Rng, type GameDefinition, type GameStatus } from '@tablehub/game-sdk';

export const RANKS = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'] as const;
/** Ordem de força dos naipes para as manilhas (do mais fraco ao zap). */
export const SUITS = ['ouros', 'espadas', 'copas', 'paus'] as const;
export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];
export interface Card {
  rank: Rank;
  suit: Suit;
}

export const BET_LEVELS = [1, 3, 6, 9, 12] as const;
export const BET_NAMES: Record<number, string> = { 3: 'Truco', 6: 'Seis', 9: 'Nove', 12: 'Doze' };

export interface TrucoOptions {
  pointsToWin: number;
  maoDeOnze: boolean;
  maoDeFerro: boolean;
  [k: string]: string | number | boolean;
}

export type TrucoAction =
  | { type: 'play'; index: number; faceDown?: boolean }
  | { type: 'truco' }
  | { type: 'accept' }
  | { type: 'run' }
  | { type: 'raise' }
  | { type: 'onze'; play: boolean };

export interface Play {
  playerId: string;
  card: Card;
  faceDown: boolean;
}

export interface Trick {
  plays: Play[];
  /** Time vencedor ou null em caso de empate ("cangou"). */
  winnerTeam: number | null;
  winnerPlayer: string | null;
}

export type Special = 'normal' | 'maoDeOnze' | 'maoDeFerro';

export interface HandState {
  number: number;
  hands: Record<string, Card[]>;
  vira: Card;
  manilha: Rank;
  turn: number;
  current: Play[];
  tricks: Trick[];
  value: number;
  /** Time que fez o último aumento aceito (não pode pedir o próximo). */
  lastRaiserTeam: number | null;
  pending: { by: string; team: number; to: number } | null;
  special: Special;
  onzeTeam: number | null;
  onzeDecided: boolean;
}

export interface HandSummary {
  number: number;
  winnerTeam: number | null;
  points: number;
  reason: 'vazas' | 'correu' | 'onze-correu' | 'empate';
  text: string;
}

export interface TrucoState {
  options: TrucoOptions;
  players: { id: string; name: string }[];
  rng: number;
  dealer: number;
  scores: [number, number];
  hand: HandState;
  lastHand: HandSummary | null;
  log: string[];
  winnerTeam: number | null;
}

const teamOf = (idx: number) => idx % 2;

export function manilhaOf(vira: Card): Rank {
  return RANKS[(RANKS.indexOf(vira.rank) + 1) % RANKS.length];
}

export function cardStrength(card: Card, manilha: Rank, faceDown = false): number {
  if (faceDown) return -1;
  if (card.rank === manilha) return 100 + SUITS.indexOf(card.suit);
  return RANKS.indexOf(card.rank);
}

export function deck(): Card[] {
  const out: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) out.push({ rank, suit });
  return out;
}

export function cardLabel(c: Card): string {
  const s = { ouros: '♦', espadas: '♠', copas: '♥', paus: '♣' }[c.suit];
  return `${c.rank}${s}`;
}

function idxOf(s: TrucoState, pid: string): number {
  return s.players.findIndex((p) => p.id === pid);
}

function teamMembers(s: TrucoState, team: number): string[] {
  return s.players.filter((_, i) => teamOf(i) === team).map((p) => p.id);
}

function teamName(s: TrucoState, team: number): string {
  return teamMembers(s, team)
    .map((id) => s.players[idxOf(s, id)].name)
    .join(' e ');
}

function newHand(s: TrucoState, rng: Rng, number: number): void {
  const cards = rng.shuffle(deck());
  const hands: Record<string, Card[]> = {};
  for (const p of s.players) hands[p.id] = cards.splice(0, 3);
  const vira = cards.pop()!;
  const target = s.options.pointsToWin - 1;
  const at11 = [0, 1].filter((t) => s.scores[t] === target);
  let special: Special = 'normal';
  let onzeTeam: number | null = null;
  if (at11.length === 2 && s.options.maoDeFerro) special = 'maoDeFerro';
  else if (at11.length === 1 && s.options.maoDeOnze) {
    special = 'maoDeOnze';
    onzeTeam = at11[0];
  }
  s.hand = {
    number,
    hands,
    vira,
    manilha: manilhaOf(vira),
    turn: (s.dealer + 1) % s.players.length,
    current: [],
    tricks: [],
    value: 1,
    lastRaiserTeam: null,
    pending: null,
    special,
    onzeTeam,
    onzeDecided: special !== 'maoDeOnze',
  };
}

function setup(players: { id: string; name: string }[], options: TrucoOptions, seed: number): TrucoState {
  const rng = new Rng(seed);
  const s = {
    options,
    players: players.map((p) => ({ id: p.id, name: p.name })),
    rng: 0,
    dealer: rng.int(players.length),
    scores: [0, 0],
    hand: null as unknown as HandState,
    lastHand: null,
    log: [],
    winnerTeam: null,
  } as TrucoState;
  newHand(s, rng, 1);
  s.rng = rng.state;
  return s;
}

function log(s: TrucoState, msg: string) {
  s.log.push(msg);
  if (s.log.length > 30) s.log.splice(0, s.log.length - 30);
}

function finishHand(s: TrucoState, winnerTeam: number | null, points: number, reason: HandSummary['reason'], text: string) {
  if (winnerTeam !== null) s.scores[winnerTeam] += points;
  s.lastHand = { number: s.hand.number, winnerTeam, points, reason, text };
  log(s, text);
  const champ = [0, 1].find((t) => s.scores[t] >= s.options.pointsToWin);
  if (champ !== undefined) {
    s.winnerTeam = champ;
    return;
  }
  const rng = new Rng(s.rng);
  s.dealer = (s.dealer + 1) % s.players.length;
  newHand(s, rng, s.hand.number + 1);
  s.rng = rng.state;
}

/** Decide o vencedor da mão a partir das vazas. undefined = mão continua; 'none' = ninguém pontua. */
export function handWinner(results: (number | null)[]): number | 'none' | undefined {
  for (const t of [0, 1]) if (results.filter((r) => r === t).length >= 2) return t;
  if (results.length >= 2) {
    const [a, b] = results;
    if (a === null && b !== null) return b;
    if (a !== null && b === null) return a;
  }
  if (results.length === 3) {
    const [a, b, c] = results;
    if (a === null && b === null) return c ?? 'none';
    return c ?? (a as number);
  }
  return undefined;
}

function resolveTrick(s: TrucoState): void {
  const h = s.hand;
  const plays = h.current;
  const strengths = plays.map((p) => cardStrength(p.card, h.manilha, p.faceDown));
  const max = Math.max(...strengths);
  const top = plays.filter((_, i) => strengths[i] === max);
  const teams = new Set(top.map((p) => teamOf(idxOf(s, p.playerId))));
  const winnerTeam = teams.size === 1 ? [...teams][0] : null;
  const winnerPlayer = winnerTeam === null ? null : top[0].playerId;
  h.tricks.push({ plays, winnerTeam, winnerPlayer });
  h.current = [];
  log(s, winnerTeam === null ? `Vaza ${h.tricks.length}: empate (cangou)` : `Vaza ${h.tricks.length}: ${s.players[idxOf(s, winnerPlayer!)].name}`);

  const result = handWinner(h.tricks.map((t) => t.winnerTeam));
  if (result !== undefined) {
    if (result === 'none') finishHand(s, null, 0, 'empate', `Mão ${h.number} empatada: ninguém pontua.`);
    else finishHand(s, result, h.value, 'vazas', `${teamName(s, result)} ganhou a mão (+${h.value}).`);
    return;
  }
  // próxima vaza começa com quem venceu; em empate, com quem jogou a maior carta primeiro
  h.turn = idxOf(s, winnerPlayer ?? top[0].playerId);
}

function canRequestTruco(s: TrucoState, team: number): boolean {
  const h = s.hand;
  return h.special === 'normal' && !h.pending && h.value < 12 && h.lastRaiserTeam !== team;
}

function nextLevel(v: number): number {
  return BET_LEVELS[BET_LEVELS.indexOf(v as (typeof BET_LEVELS)[number]) + 1];
}

function currentPlayers(s: TrucoState): string[] {
  if (s.winnerTeam !== null) return [];
  const h = s.hand;
  if (!h.onzeDecided && h.onzeTeam !== null) return teamMembers(s, h.onzeTeam);
  if (h.pending) return teamMembers(s, 1 - h.pending.team);
  return [s.players[h.turn].id];
}

function applyAction(s: TrucoState, pid: string, a: TrucoAction): TrucoState | { error: string } {
  const idx = idxOf(s, pid);
  if (idx < 0) return { error: 'Você não está nesta partida.' };
  const team = teamOf(idx);
  const h = s.hand;
  const name = s.players[idx].name;

  if (!h.onzeDecided) {
    if (a.type !== 'onze' || h.onzeTeam !== team) return { error: 'Aguardando a decisão da mão de onze.' };
    if (a.play) {
      h.onzeDecided = true;
      h.value = 3;
      log(s, `${teamName(s, team)} aceitou jogar a mão de onze (vale 3).`);
    } else {
      finishHand(s, 1 - team, 1, 'onze-correu', `${teamName(s, team)} correu da mão de onze (+1 para ${teamName(s, 1 - team)}).`);
    }
    return s;
  }

  if (h.pending) {
    if (team === h.pending.team) return { error: 'Aguardando a resposta dos adversários.' };
    const p = h.pending;
    if (a.type === 'accept') {
      h.value = p.to;
      h.lastRaiserTeam = p.team;
      h.pending = null;
      log(s, `${name} aceitou (${BET_NAMES[p.to]}).`);
      return s;
    }
    if (a.type === 'run') {
      finishHand(s, p.team, h.value, 'correu', `${name} correu do ${BET_NAMES[p.to]} (+${h.value} para ${teamName(s, p.team)}).`);
      return s;
    }
    if (a.type === 'raise') {
      if (p.to >= 12) return { error: 'Não dá para aumentar além de doze.' };
      h.value = p.to; // aumentar implica aceitar o pedido anterior
      h.lastRaiserTeam = p.team;
      h.pending = { by: pid, team, to: nextLevel(p.to) };
      log(s, `${name} pediu ${BET_NAMES[h.pending.to]}!`);
      return s;
    }
    return { error: 'Responda ao pedido: aceitar, correr ou aumentar.' };
  }

  if (idx !== h.turn) return { error: 'Não é a sua vez.' };

  if (a.type === 'truco') {
    if (!canRequestTruco(s, team)) return { error: 'Você não pode pedir aumento agora.' };
    h.pending = { by: pid, team, to: nextLevel(h.value) };
    log(s, `${name} pediu ${BET_NAMES[h.pending.to]}!`);
    return s;
  }

  if (a.type === 'play') {
    const hand = h.hands[pid];
    if (!Number.isInteger(a.index) || a.index < 0 || a.index >= hand.length) return { error: 'Carta inválida.' };
    const faceDown = Boolean(a.faceDown);
    if (faceDown && (h.tricks.length === 0 || h.special === 'maoDeFerro')) return { error: 'Só é possível jogar encoberta a partir da segunda vaza.' };
    const [card] = hand.splice(a.index, 1);
    h.current.push({ playerId: pid, card, faceDown });
    log(s, `${name} jogou ${faceDown ? 'uma carta encoberta' : cardLabel(card)}`);
    if (h.current.length === s.players.length) resolveTrick(s);
    else h.turn = (h.turn + 1) % s.players.length;
    return s;
  }

  return { error: 'Ação inválida.' };
}

function legalActions(s: TrucoState, pid: string): TrucoAction[] {
  if (!currentPlayers(s).includes(pid)) return [];
  const h = s.hand;
  const idx = idxOf(s, pid);
  const team = teamOf(idx);
  if (!h.onzeDecided) return [{ type: 'onze', play: true }, { type: 'onze', play: false }];
  if (h.pending) {
    const out: TrucoAction[] = [{ type: 'accept' }, { type: 'run' }];
    if (h.pending.to < 12) out.push({ type: 'raise' });
    return out;
  }
  const out: TrucoAction[] = h.hands[pid].map((_, index) => ({ type: 'play', index }));
  if (h.tricks.length > 0 && h.special !== 'maoDeFerro') h.hands[pid].forEach((_, index) => out.push({ type: 'play', index, faceDown: true }));
  if (canRequestTruco(s, team)) out.push({ type: 'truco' });
  return out;
}

export interface TrucoView {
  players: { id: string; name: string; team: number; cards: number }[];
  me: string | null;
  myTeam: number | null;
  /** null quando o jogador não pode ver as próprias cartas (mão de ferro). */
  myHand: Card[] | null;
  partnerHand: { playerId: string; cards: Card[] } | null;
  vira: Card;
  manilha: Rank;
  current: { playerId: string; card: Card | null; faceDown: boolean }[];
  tricks: { plays: { playerId: string; card: Card | null; faceDown: boolean }[]; winnerTeam: number | null; winnerPlayer: string | null }[];
  value: number;
  pending: HandState['pending'];
  special: Special;
  onzeTeam: number | null;
  onzeDecided: boolean;
  canRaise: boolean;
  nextBet: number | null;
  scores: [number, number];
  turn: string;
  dealer: string;
  handNumber: number;
  lastHand: HandSummary | null;
  log: string[];
  winnerTeam: number | null;
  pointsToWin: number;
}

function maskPlay(p: Play) {
  return { playerId: p.playerId, card: p.faceDown ? null : p.card, faceDown: p.faceDown };
}

function getPlayerView(s: TrucoState, pid: string | null): TrucoView {
  const h = s.hand;
  const idx = pid ? idxOf(s, pid) : -1;
  const myTeam = idx >= 0 ? teamOf(idx) : null;
  let partnerHand: TrucoView['partnerHand'] = null;
  if (idx >= 0 && s.players.length === 4 && h.special === 'maoDeOnze' && !h.onzeDecided && h.onzeTeam === myTeam) {
    const partner = s.players[(idx + 2) % 4];
    partnerHand = { playerId: partner.id, cards: h.hands[partner.id] };
  }
  return {
    players: s.players.map((p, i) => ({ id: p.id, name: p.name, team: teamOf(i), cards: h.hands[p.id].length })),
    me: idx >= 0 ? pid : null,
    myTeam,
    myHand: idx >= 0 && h.special !== 'maoDeFerro' ? h.hands[pid!] : null,
    partnerHand,
    vira: h.vira,
    manilha: h.manilha,
    current: h.current.map(maskPlay),
    tricks: h.tricks.map((t) => ({ plays: t.plays.map(maskPlay), winnerTeam: t.winnerTeam, winnerPlayer: t.winnerPlayer })),
    value: h.value,
    pending: h.pending,
    special: h.special,
    onzeTeam: h.onzeTeam,
    onzeDecided: h.onzeDecided,
    canRaise: myTeam !== null && h.turn === idx && canRequestTruco(s, myTeam),
    nextBet: h.value < 12 ? nextLevel(h.pending ? h.pending.to : h.value) ?? null : null,
    scores: s.scores,
    turn: s.players[h.turn].id,
    dealer: s.players[s.dealer].id,
    handNumber: h.number,
    lastHand: s.lastHand,
    log: s.log,
    winnerTeam: s.winnerTeam,
    pointsToWin: s.options.pointsToWin,
  };
}

function getStatus(s: TrucoState): GameStatus {
  const scores = Object.fromEntries(s.players.map((p, i) => [p.id, s.scores[teamOf(i)]]));
  if (s.winnerTeam !== null) {
    return {
      phase: 'finished',
      currentPlayers: [],
      winners: teamMembers(s, s.winnerTeam),
      scores,
      message: `${teamName(s, s.winnerTeam)} venceu ${s.scores[s.winnerTeam]} a ${s.scores[1 - s.winnerTeam]}!`,
    };
  }
  const cur = currentPlayers(s);
  const h = s.hand;
  let message = `Vez de ${s.players[h.turn].name}`;
  if (!h.onzeDecided && h.onzeTeam !== null) message = `Mão de onze: ${teamName(s, h.onzeTeam)} decide se joga`;
  else if (h.pending) message = `${BET_NAMES[h.pending.to]}! ${teamName(s, 1 - h.pending.team)} deve responder`;
  return { phase: 'playing', currentPlayers: cur, scores, message };
}

export const trucoPaulista: GameDefinition<TrucoState, TrucoAction, TrucoOptions> = {
  id: 'truco-paulista',
  name: 'Truco',
  description: 'Truco com baralho sujo, vira e manilhas variáveis. Individual (2) ou em duplas (4).',
  minPlayers: 2,
  maxPlayers: 4,
  optionsSchema: [
    {
      type: 'select',
      key: 'pointsToWin',
      label: 'Pontos para vencer',
      default: 12,
      choices: [
        { value: 12, label: '12 pontos' },
        { value: 24, label: '24 pontos' },
      ],
    },
    { type: 'boolean', key: 'maoDeOnze', label: 'Mão de onze', default: true, description: 'Time com 11 pontos decide se joga a mão (vale 3) ou corre (adversário ganha 1).' },
    { type: 'boolean', key: 'maoDeFerro', label: 'Mão de ferro', default: true, description: 'Com 11 a 11, todos jogam sem ver as próprias cartas.' },
  ],
  rulesSummary(o, n) {
    const target = Number(o.pointsToWin);
    const lines = [
      n === 4 ? '4 jogadores em duplas: parceiros sentam em lugares alternados (1º e 3º contra 2º e 4º).' : '2 jogadores, um contra o outro.',
      'Baralho de 40 cartas (sem 8, 9 e 10). Ordem: 4 5 6 7 Q J K A 2 3.',
      'A vira define a manilha (carta seguinte à vira). Força das manilhas: ♣ zap > ♥ copas > ♠ espadas > ♦ ouros.',
      'Cada mão tem 3 cartas e vale 1 ponto; vence quem ganhar 2 das 3 vazas. Empate na 1ª vaza: decide a 2ª; empate depois: vale quem ganhou a 1ª.',
      'Na sua vez você pode pedir Truco (3) → Seis (6) → Nove (9) → Doze (12). O adversário aceita, corre ou aumenta.',
      'A partir da 2ª vaza é possível jogar uma carta encoberta (vale menos que qualquer carta).',
      `Vence quem fizer ${target} pontos.`,
    ];
    if (o.maoDeOnze) lines.push(`Mão de onze: quem tem ${target - 1} pontos vê as cartas do parceiro e decide se joga (vale 3) ou corre (+1 para o adversário). Não há truco nessa mão.`);
    if (o.maoDeFerro) lines.push(`Mão de ferro: com ${target - 1} a ${target - 1}, todos jogam sem ver as próprias cartas e não há truco.`);
    return lines;
  },
  seatLabel: (seat, _o, n) => (n === 4 ? (seat % 2 === 0 ? 'Dupla A' : 'Dupla B') : null),
  validateConfig(_o, n) {
    if (n !== 2 && n !== 4) return 'Truco é jogado com 2 ou 4 jogadores.';
    return null;
  },
  setup: ({ players, options, seed }) =>
    setup(players, { pointsToWin: Number(options.pointsToWin), maoDeOnze: Boolean(options.maoDeOnze), maoDeFerro: Boolean(options.maoDeFerro) }, seed),
  getPlayerView,
  getLegalActions: legalActions,
  applyAction,
  getStatus,
};
