import { Rng, type GameDefinition, type GameStatus } from '@tablehub/game-sdk';
import { catanGraph, generateBoard, RESOURCE_LABEL, RESOURCES, TERRAIN_RESOURCE, type Board, type Resource } from './board';

export type Resources = Record<Resource, number>;
export type DevType = 'knight' | 'victoryPoint' | 'roadBuilding' | 'yearOfPlenty' | 'monopoly';

export const DEV_LABEL: Record<DevType, string> = {
  knight: 'Cavaleiro',
  victoryPoint: 'Ponto de vitória',
  roadBuilding: 'Construção de estradas',
  yearOfPlenty: 'Ano de fartura',
  monopoly: 'Monopólio',
};

export const COSTS: Record<'road' | 'settlement' | 'city' | 'dev', Partial<Resources>> = {
  road: { brick: 1, lumber: 1 },
  settlement: { brick: 1, lumber: 1, wool: 1, grain: 1 },
  city: { grain: 2, ore: 3 },
  dev: { wool: 1, grain: 1, ore: 1 },
};

export const PIECES = { road: 15, settlement: 5, city: 4 };
export const PLAYER_COLORS = ['#d64545', '#2f6fd6', '#e8902a', '#f2f2f2'];

export interface CatanOptions {
  board: 'beginner' | 'random';
  vpToWin: number;
  discardLimit: number;
  [k: string]: string | number | boolean;
}

export type Phase = 'setup' | 'roll' | 'discard' | 'robber' | 'steal' | 'main' | 'roadBuilding' | 'finished';

export interface TradeOffer {
  from: string;
  give: Partial<Resources>;
  get: Partial<Resources>;
  responses: Record<string, 'accept' | 'reject' | null>;
}

export type CatanAction =
  | { type: 'placeSettlement'; vertex: string }
  | { type: 'placeRoad'; edge: string }
  | { type: 'roll' }
  | { type: 'discard'; resources: Partial<Resources> }
  | { type: 'moveRobber'; hex: string }
  | { type: 'steal'; from: string }
  | { type: 'buildRoad'; edge: string }
  | { type: 'buildSettlement'; vertex: string }
  | { type: 'buildCity'; vertex: string }
  | { type: 'buyDev' }
  | { type: 'playKnight' }
  | { type: 'playRoadBuilding' }
  | { type: 'playYearOfPlenty'; resources: [Resource, Resource] }
  | { type: 'playMonopoly'; resource: Resource }
  | { type: 'bankTrade'; give: Resource; get: Resource }
  | { type: 'proposeTrade'; give: Partial<Resources>; get: Partial<Resources> }
  | { type: 'respondTrade'; accept: boolean }
  | { type: 'confirmTrade'; with: string }
  | { type: 'cancelTrade' }
  | { type: 'endTurn' };

export interface Building {
  owner: string;
  kind: 'settlement' | 'city';
}

export interface CatanState {
  options: CatanOptions;
  players: { id: string; name: string; color: string }[];
  rng: number;
  board: Board;
  robber: string;
  buildings: Record<string, Building>;
  roads: Record<string, string>;
  hands: Record<string, Resources>;
  dev: Record<string, { type: DevType; boughtTurn: number }[]>;
  knights: Record<string, number>;
  bank: Resources;
  devDeck: DevType[];
  turn: number;
  turnNumber: number;
  phase: Phase;
  setupIndex: number;
  lastSettlement: string | null;
  dice: [number, number] | null;
  devPlayedThisTurn: boolean;
  pendingDiscards: Record<string, number>;
  afterRobber: 'roll' | 'main';
  stealCandidates: string[];
  freeRoads: number;
  longestRoad: { player: string; length: number } | null;
  largestArmy: { player: string; count: number } | null;
  trade: TradeOffer | null;
  log: string[];
  winner: string | null;
}

const emptyRes = (): Resources => ({ brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 });
const total = (r: Partial<Resources>) => RESOURCES.reduce((a, k) => a + (r[k] ?? 0), 0);
const hasRes = (have: Resources, need: Partial<Resources>) => RESOURCES.every((k) => have[k] >= (need[k] ?? 0));
function moveRes(from: Resources, to: Resources, amount: Partial<Resources>) {
  for (const k of RESOURCES) {
    const n = amount[k] ?? 0;
    from[k] -= n;
    to[k] += n;
  }
}
function validRes(r: unknown): r is Partial<Resources> {
  if (typeof r !== 'object' || r === null) return false;
  return Object.entries(r).every(([k, v]) => (RESOURCES as readonly string[]).includes(k) && Number.isInteger(v) && (v as number) >= 0);
}
const resList = (r: Partial<Resources>) =>
  RESOURCES.filter((k) => (r[k] ?? 0) > 0)
    .map((k) => `${r[k]} ${RESOURCE_LABEL[k]}`)
    .join(', ');

function setupPlayerIndex(s: CatanState): number {
  const n = s.players.length;
  return s.setupIndex < n ? s.setupIndex : 2 * n - 1 - s.setupIndex;
}

function currentId(s: CatanState): string {
  return s.players[s.phase === 'setup' ? setupPlayerIndex(s) : s.turn].id;
}

function nameOf(s: CatanState, pid: string): string {
  return s.players.find((p) => p.id === pid)?.name ?? pid;
}

function log(s: CatanState, msg: string) {
  s.log.push(msg);
  if (s.log.length > 40) s.log.splice(0, s.log.length - 40);
}

// ---------- Geometria e regras de colocação ----------

function vertexFreeByDistance(s: CatanState, v: string): boolean {
  const g = catanGraph();
  if (s.buildings[v]) return false;
  return g.vertices[v].neighbors.every((n) => !s.buildings[n]);
}

function roadConnects(s: CatanState, pid: string, edge: string): boolean {
  const g = catanGraph();
  const e = g.edges[edge];
  if (!e || s.roads[edge]) return false;
  return e.vertices.some((v) => {
    const b = s.buildings[v];
    if (b && b.owner === pid) return true;
    if (b && b.owner !== pid) return false; // não passa por construção adversária
    return g.vertices[v].edges.some((other) => other !== edge && s.roads[other] === pid);
  });
}

function legalRoadEdges(s: CatanState, pid: string): string[] {
  return catanGraph().edgeOrder.filter((e) => roadConnects(s, pid, e));
}

function legalSettlementVertices(s: CatanState, pid: string, setup: boolean): string[] {
  const g = catanGraph();
  return g.vertexOrder.filter((v) => {
    if (!vertexFreeByDistance(s, v)) return false;
    if (setup) return true;
    return g.vertices[v].edges.some((e) => s.roads[e] === pid);
  });
}

function legalCityVertices(s: CatanState, pid: string): string[] {
  return Object.entries(s.buildings)
    .filter(([, b]) => b.owner === pid && b.kind === 'settlement')
    .map(([v]) => v);
}

function piecesLeft(s: CatanState, pid: string) {
  const mine = Object.values(s.buildings).filter((b) => b.owner === pid);
  return {
    road: PIECES.road - Object.values(s.roads).filter((o) => o === pid).length,
    settlement: PIECES.settlement - mine.filter((b) => b.kind === 'settlement').length,
    city: PIECES.city - mine.filter((b) => b.kind === 'city').length,
  };
}

export function tradeRates(s: CatanState, pid: string): Resources {
  const rates: Resources = { brick: 4, lumber: 4, wool: 4, grain: 4, ore: 4 };
  for (const port of s.board.ports) {
    if (!port.vertices.some((v) => s.buildings[v]?.owner === pid)) continue;
    for (const r of RESOURCES) {
      if (port.type === 'any') rates[r] = Math.min(rates[r], 3);
      else if (port.type === r) rates[r] = 2;
    }
  }
  return rates;
}

/** Maior estrada contínua do jogador (construções adversárias interrompem). */
export function longestRoadLength(s: CatanState, pid: string): number {
  const g = catanGraph();
  const myEdges = Object.keys(s.roads).filter((e) => s.roads[e] === pid);
  if (myEdges.length === 0) return 0;
  let best = 0;
  const visited = new Set<string>();
  const dfs = (v: string, len: number) => {
    best = Math.max(best, len);
    const b = s.buildings[v];
    if (len > 0 && b && b.owner !== pid) return;
    for (const e of g.vertices[v].edges) {
      if (s.roads[e] !== pid || visited.has(e)) continue;
      visited.add(e);
      const [a, c] = g.edges[e].vertices;
      dfs(a === v ? c : a, len + 1);
      visited.delete(e);
    }
  };
  const starts = new Set(myEdges.flatMap((e) => g.edges[e].vertices));
  for (const v of starts) dfs(v, 0);
  return best;
}

function updateLongestRoad(s: CatanState) {
  const lengths = s.players.map((p) => ({ id: p.id, len: longestRoadLength(s, p.id) }));
  const max = Math.max(...lengths.map((l) => l.len));
  const holder = s.longestRoad?.player ?? null;
  const prev = s.longestRoad;
  if (max < 5) s.longestRoad = null;
  else {
    const top = lengths.filter((l) => l.len === max);
    if (holder && top.some((t) => t.id === holder)) s.longestRoad = { player: holder, length: max };
    else if (top.length === 1) s.longestRoad = { player: top[0].id, length: max };
    else s.longestRoad = null;
  }
  if (s.longestRoad?.player !== prev?.player && s.longestRoad) log(s, `${nameOf(s, s.longestRoad.player)} tem a Maior Estrada (${s.longestRoad.length}).`);
}

function updateLargestArmy(s: CatanState, pid: string) {
  const k = s.knights[pid];
  if (k >= 3 && (!s.largestArmy || (s.largestArmy.player !== pid && k > s.largestArmy.count))) {
    s.largestArmy = { player: pid, count: k };
    log(s, `${nameOf(s, pid)} tem o Maior Exército (${k}).`);
  } else if (s.largestArmy?.player === pid) s.largestArmy.count = k;
}

export function victoryPoints(s: CatanState, pid: string, includeHidden: boolean): number {
  let vp = 0;
  for (const b of Object.values(s.buildings)) if (b.owner === pid) vp += b.kind === 'city' ? 2 : 1;
  if (s.longestRoad?.player === pid) vp += 2;
  if (s.largestArmy?.player === pid) vp += 2;
  if (includeHidden) vp += s.dev[pid].filter((d) => d.type === 'victoryPoint').length;
  return vp;
}

function checkWin(s: CatanState) {
  const pid = s.players[s.turn].id;
  if (s.phase === 'setup' || s.winner) return;
  if (victoryPoints(s, pid, true) >= s.options.vpToWin) {
    s.winner = pid;
    s.phase = 'finished';
    s.trade = null;
    log(s, `${nameOf(s, pid)} venceu com ${victoryPoints(s, pid, true)} pontos!`);
  }
}

// ---------- Setup ----------

function setup(players: { id: string; name: string }[], options: CatanOptions, seed: number): CatanState {
  const rng = new Rng(seed);
  const board = generateBoard(options.board, rng);
  const desert = board.hexes.find((h) => h.terrain === 'desert')!;
  const devDeck = rng.shuffle<DevType>([
    ...Array<DevType>(14).fill('knight'),
    ...Array<DevType>(5).fill('victoryPoint'),
    ...Array<DevType>(2).fill('roadBuilding'),
    ...Array<DevType>(2).fill('yearOfPlenty'),
    ...Array<DevType>(2).fill('monopoly'),
  ]);
  const order = rng.shuffle(players);
  const s: CatanState = {
    options,
    players: order.map((p, i) => ({ id: p.id, name: p.name, color: PLAYER_COLORS[i] })),
    rng: 0,
    board,
    robber: desert.id,
    buildings: {},
    roads: {},
    hands: Object.fromEntries(players.map((p) => [p.id, emptyRes()])),
    dev: Object.fromEntries(players.map((p) => [p.id, []])),
    knights: Object.fromEntries(players.map((p) => [p.id, 0])),
    bank: { brick: 19, lumber: 19, wool: 19, grain: 19, ore: 19 },
    devDeck,
    turn: 0,
    turnNumber: 0,
    phase: 'setup',
    setupIndex: 0,
    lastSettlement: null,
    dice: null,
    devPlayedThisTurn: false,
    pendingDiscards: {},
    afterRobber: 'main',
    stealCandidates: [],
    freeRoads: 0,
    longestRoad: null,
    largestArmy: null,
    trade: null,
    log: [`Ordem de jogo: ${order.map((p) => p.name).join(', ')}.`],
    winner: null,
  };
  s.rng = rng.state;
  return s;
}

// ---------- Produção, ladrão ----------

function produce(s: CatanState, roll: number) {
  const g = catanGraph();
  const demand: Record<Resource, Record<string, number>> = { brick: {}, lumber: {}, wool: {}, grain: {}, ore: {} };
  for (const h of s.board.hexes) {
    if (h.number !== roll || h.id === s.robber) continue;
    const res = TERRAIN_RESOURCE[h.terrain];
    if (!res) continue;
    for (const v of g.hexes[h.id].vertices) {
      const b = s.buildings[v];
      if (b) demand[res][b.owner] = (demand[res][b.owner] ?? 0) + (b.kind === 'city' ? 2 : 1);
    }
  }
  const gains: string[] = [];
  for (const r of RESOURCES) {
    const entries = Object.entries(demand[r]);
    const need = entries.reduce((a, [, n]) => a + n, 0);
    if (need === 0) continue;
    if (need > s.bank[r]) {
      if (entries.length === 1) {
        const [pid] = entries[0];
        const n = s.bank[r];
        s.hands[pid][r] += n;
        s.bank[r] = 0;
        if (n > 0) gains.push(`${nameOf(s, pid)} +${n} ${RESOURCE_LABEL[r]}`);
      } else log(s, `O banco não tem ${RESOURCE_LABEL[r]} suficiente: ninguém recebe.`);
      continue;
    }
    for (const [pid, n] of entries) {
      s.hands[pid][r] += n;
      s.bank[r] -= n;
      gains.push(`${nameOf(s, pid)} +${n} ${RESOURCE_LABEL[r]}`);
    }
  }
  if (gains.length) log(s, gains.join('; '));
}

function stealCandidates(s: CatanState, hex: string, thief: string): string[] {
  const g = catanGraph();
  const owners = new Set<string>();
  for (const v of g.hexes[hex].vertices) {
    const b = s.buildings[v];
    if (b && b.owner !== thief && total(s.hands[b.owner]) > 0) owners.add(b.owner);
  }
  return s.players.map((p) => p.id).filter((id) => owners.has(id));
}

function doSteal(s: CatanState, thief: string, victim: string) {
  const rng = new Rng(s.rng);
  const pool = RESOURCES.flatMap((r) => Array<Resource>(s.hands[victim][r]).fill(r));
  if (pool.length > 0) {
    const r = rng.pick(pool);
    s.hands[victim][r]--;
    s.hands[thief][r]++;
    log(s, `${nameOf(s, thief)} roubou uma carta de ${nameOf(s, victim)}.`);
  }
  s.rng = rng.state;
}

function finishRobber(s: CatanState) {
  s.stealCandidates = [];
  s.phase = s.afterRobber;
}

// ---------- Ações ----------

type Res = CatanState | { error: string };

function pay(s: CatanState, pid: string, cost: Partial<Resources>) {
  moveRes(s.hands[pid], s.bank, cost);
}

function applyAction(s: CatanState, pid: string, a: CatanAction): Res {
  const me = currentId(s);
  const isTurn = pid === me;

  // respostas a uma oferta de troca e descartes podem vir de outros jogadores
  if (a.type === 'respondTrade') {
    if (!s.trade || pid === s.trade.from || s.trade.responses[pid] === undefined) return { error: 'Não há oferta para você responder.' };
    if (a.accept && !hasRes(s.hands[pid], s.trade.get)) return { error: 'Você não tem os recursos pedidos.' };
    s.trade.responses[pid] = a.accept ? 'accept' : 'reject';
    log(s, `${nameOf(s, pid)} ${a.accept ? 'aceitou' : 'recusou'} a troca.`);
    return s;
  }
  if (a.type === 'discard') {
    if (s.phase !== 'discard' || !s.pendingDiscards[pid]) return { error: 'Você não precisa descartar.' };
    if (!validRes(a.resources) || total(a.resources) !== s.pendingDiscards[pid] || !hasRes(s.hands[pid], a.resources)) {
      return { error: `Descarte exatamente ${s.pendingDiscards[pid]} cartas que você possui.` };
    }
    moveRes(s.hands[pid], s.bank, a.resources);
    delete s.pendingDiscards[pid];
    log(s, `${nameOf(s, pid)} descartou ${total(a.resources)} cartas.`);
    if (Object.keys(s.pendingDiscards).length === 0) s.phase = 'robber';
    return s;
  }

  if (!isTurn) return { error: 'Não é a sua vez.' };
  if (s.trade && !['confirmTrade', 'cancelTrade'].includes(a.type)) return { error: 'Finalize ou cancele a oferta de troca primeiro.' };

  switch (s.phase) {
    case 'setup':
      return applySetup(s, pid, a);
    case 'roll':
      if (a.type === 'roll') return doRoll(s, pid);
      if (a.type === 'playKnight') return playKnight(s, pid);
      return { error: 'Role os dados.' };
    case 'robber': {
      if (a.type !== 'moveRobber') return { error: 'Mova o ladrão.' };
      if (!s.board.hexes.some((h) => h.id === a.hex) || a.hex === s.robber) return { error: 'Escolha outro hexágono para o ladrão.' };
      s.robber = a.hex;
      log(s, `${nameOf(s, pid)} moveu o ladrão.`);
      const c = stealCandidates(s, a.hex, pid);
      if (c.length === 0) finishRobber(s);
      else if (c.length === 1) {
        doSteal(s, pid, c[0]);
        finishRobber(s);
      } else {
        s.stealCandidates = c;
        s.phase = 'steal';
      }
      return s;
    }
    case 'steal':
      if (a.type !== 'steal' || !s.stealCandidates.includes(a.from)) return { error: 'Escolha de quem roubar.' };
      doSteal(s, pid, a.from);
      finishRobber(s);
      return s;
    case 'roadBuilding': {
      if (a.type !== 'buildRoad') return { error: 'Coloque as estradas gratuitas.' };
      if (!roadConnects(s, pid, a.edge)) return { error: 'Estrada inválida.' };
      s.roads[a.edge] = pid;
      s.freeRoads--;
      updateLongestRoad(s);
      if (s.freeRoads <= 0 || piecesLeft(s, pid).road === 0 || legalRoadEdges(s, pid).length === 0) {
        s.freeRoads = 0;
        s.phase = 'main';
      }
      checkWin(s);
      return s;
    }
    case 'main':
      return applyMain(s, pid, a);
    default:
      return { error: 'Ação inválida neste momento.' };
  }
}

function applySetup(s: CatanState, pid: string, a: CatanAction): Res {
  const g = catanGraph();
  if (s.lastSettlement === null) {
    if (a.type !== 'placeSettlement') return { error: 'Coloque uma aldeia.' };
    if (!g.vertices[a.vertex] || !vertexFreeByDistance(s, a.vertex)) return { error: 'Local inválido (respeite a distância entre aldeias).' };
    s.buildings[a.vertex] = { owner: pid, kind: 'settlement' };
    s.lastSettlement = a.vertex;
    if (s.setupIndex >= s.players.length) {
      // segunda aldeia: recebe recursos dos hexágonos vizinhos
      const got = emptyRes();
      for (const hid of g.vertices[a.vertex].hexes) {
        const res = TERRAIN_RESOURCE[s.board.hexes.find((h) => h.id === hid)!.terrain];
        if (res && s.bank[res] > 0) {
          got[res]++;
          s.bank[res]--;
        }
      }
      moveRes(emptyRes(), s.hands[pid], got);
      if (total(got)) log(s, `${nameOf(s, pid)} recebeu ${resList(got)}.`);
    }
    return s;
  }
  if (a.type !== 'placeRoad') return { error: 'Coloque uma estrada ligada à aldeia.' };
  if (!g.vertices[s.lastSettlement].edges.includes(a.edge) || s.roads[a.edge]) return { error: 'A estrada deve sair da aldeia recém-colocada.' };
  s.roads[a.edge] = pid;
  s.lastSettlement = null;
  s.setupIndex++;
  if (s.setupIndex >= 2 * s.players.length) {
    s.phase = 'roll';
    s.turn = 0;
    s.turnNumber = 1;
    log(s, `Fim da preparação. Vez de ${s.players[0].name}.`);
  }
  return s;
}

function doRoll(s: CatanState, pid: string): Res {
  const rng = new Rng(s.rng);
  const d: [number, number] = [rng.dice(), rng.dice()];
  s.rng = rng.state;
  s.dice = d;
  const sum = d[0] + d[1];
  log(s, `${nameOf(s, pid)} rolou ${sum}.`);
  if (sum === 7) {
    s.pendingDiscards = {};
    for (const p of s.players) {
      const t = total(s.hands[p.id]);
      if (t > s.options.discardLimit) s.pendingDiscards[p.id] = Math.floor(t / 2);
    }
    s.afterRobber = 'main';
    s.phase = Object.keys(s.pendingDiscards).length > 0 ? 'discard' : 'robber';
    return s;
  }
  produce(s, sum);
  s.phase = 'main';
  return s;
}

function canPlayDev(s: CatanState, pid: string, type: DevType): string | null {
  if (s.devPlayedThisTurn) return 'Só uma carta de desenvolvimento por turno.';
  if (!s.dev[pid].some((d) => d.type === type && d.boughtTurn < s.turnNumber)) return 'Você não tem essa carta (ou comprou neste turno).';
  return null;
}

function useDev(s: CatanState, pid: string, type: DevType) {
  const i = s.dev[pid].findIndex((d) => d.type === type && d.boughtTurn < s.turnNumber);
  s.dev[pid].splice(i, 1);
  s.devPlayedThisTurn = true;
}

function playKnight(s: CatanState, pid: string): Res {
  const err = canPlayDev(s, pid, 'knight');
  if (err) return { error: err };
  useDev(s, pid, 'knight');
  s.knights[pid]++;
  log(s, `${nameOf(s, pid)} jogou um Cavaleiro.`);
  updateLargestArmy(s, pid);
  s.afterRobber = s.phase === 'roll' ? 'roll' : 'main';
  s.phase = 'robber';
  checkWin(s);
  return s;
}

function applyMain(s: CatanState, pid: string, a: CatanAction): Res {
  const hand = s.hands[pid];
  const left = piecesLeft(s, pid);
  switch (a.type) {
    case 'buildRoad':
      if (!hasRes(hand, COSTS.road)) return { error: 'Recursos insuficientes para estrada.' };
      if (left.road <= 0) return { error: 'Você não tem mais estradas.' };
      if (!roadConnects(s, pid, a.edge)) return { error: 'A estrada precisa se ligar à sua rede.' };
      pay(s, pid, COSTS.road);
      s.roads[a.edge] = pid;
      updateLongestRoad(s);
      break;
    case 'buildSettlement':
      if (!hasRes(hand, COSTS.settlement)) return { error: 'Recursos insuficientes para aldeia.' };
      if (left.settlement <= 0) return { error: 'Você não tem mais aldeias.' };
      if (!legalSettlementVertices(s, pid, false).includes(a.vertex)) return { error: 'Local inválido para aldeia.' };
      pay(s, pid, COSTS.settlement);
      s.buildings[a.vertex] = { owner: pid, kind: 'settlement' };
      log(s, `${nameOf(s, pid)} construiu uma aldeia.`);
      updateLongestRoad(s);
      break;
    case 'buildCity':
      if (!hasRes(hand, COSTS.city)) return { error: 'Recursos insuficientes para cidade.' };
      if (left.city <= 0) return { error: 'Você não tem mais cidades.' };
      if (s.buildings[a.vertex]?.owner !== pid || s.buildings[a.vertex].kind !== 'settlement') return { error: 'Escolha uma aldeia sua.' };
      pay(s, pid, COSTS.city);
      s.buildings[a.vertex] = { owner: pid, kind: 'city' };
      log(s, `${nameOf(s, pid)} construiu uma cidade.`);
      break;
    case 'buyDev': {
      if (!hasRes(hand, COSTS.dev)) return { error: 'Recursos insuficientes.' };
      if (s.devDeck.length === 0) return { error: 'Acabaram as cartas de desenvolvimento.' };
      pay(s, pid, COSTS.dev);
      s.dev[pid].push({ type: s.devDeck.pop()!, boughtTurn: s.turnNumber });
      log(s, `${nameOf(s, pid)} comprou uma carta de desenvolvimento.`);
      break;
    }
    case 'playKnight':
      return playKnight(s, pid);
    case 'playRoadBuilding': {
      const err = canPlayDev(s, pid, 'roadBuilding');
      if (err) return { error: err };
      if (left.road === 0 || legalRoadEdges(s, pid).length === 0) return { error: 'Não há onde construir estradas.' };
      useDev(s, pid, 'roadBuilding');
      s.freeRoads = Math.min(2, left.road);
      s.phase = 'roadBuilding';
      log(s, `${nameOf(s, pid)} jogou Construção de estradas.`);
      break;
    }
    case 'playYearOfPlenty': {
      const err = canPlayDev(s, pid, 'yearOfPlenty');
      if (err) return { error: err };
      const rs = a.resources;
      if (!Array.isArray(rs) || rs.length !== 2 || !rs.every((r) => RESOURCES.includes(r))) return { error: 'Escolha 2 recursos.' };
      const want = emptyRes();
      for (const r of rs) want[r]++;
      if (!hasRes(s.bank, want)) return { error: 'O banco não tem esses recursos.' };
      useDev(s, pid, 'yearOfPlenty');
      moveRes(s.bank, hand, want);
      log(s, `${nameOf(s, pid)} jogou Ano de fartura (${resList(want)}).`);
      break;
    }
    case 'playMonopoly': {
      const err = canPlayDev(s, pid, 'monopoly');
      if (err) return { error: err };
      if (!RESOURCES.includes(a.resource)) return { error: 'Recurso inválido.' };
      useDev(s, pid, 'monopoly');
      let n = 0;
      for (const p of s.players) {
        if (p.id === pid) continue;
        n += s.hands[p.id][a.resource];
        hand[a.resource] += s.hands[p.id][a.resource];
        s.hands[p.id][a.resource] = 0;
      }
      log(s, `${nameOf(s, pid)} jogou Monopólio de ${RESOURCE_LABEL[a.resource]} e levou ${n}.`);
      break;
    }
    case 'bankTrade': {
      if (!RESOURCES.includes(a.give) || !RESOURCES.includes(a.get) || a.give === a.get) return { error: 'Troca inválida.' };
      const rate = tradeRates(s, pid)[a.give];
      if (hand[a.give] < rate) return { error: `Você precisa de ${rate} ${RESOURCE_LABEL[a.give]}.` };
      if (s.bank[a.get] < 1) return { error: 'O banco não tem esse recurso.' };
      hand[a.give] -= rate;
      s.bank[a.give] += rate;
      hand[a.get]++;
      s.bank[a.get]--;
      log(s, `${nameOf(s, pid)} trocou ${rate} ${RESOURCE_LABEL[a.give]} por 1 ${RESOURCE_LABEL[a.get]} com o banco.`);
      break;
    }
    case 'proposeTrade': {
      if (!validRes(a.give) || !validRes(a.get) || total(a.give) === 0 || total(a.get) === 0) return { error: 'Oferta inválida.' };
      if (RESOURCES.some((r) => (a.give[r] ?? 0) > 0 && (a.get[r] ?? 0) > 0)) return { error: 'Não ofereça e peça o mesmo recurso.' };
      if (!hasRes(hand, a.give)) return { error: 'Você não tem o que está oferecendo.' };
      s.trade = { from: pid, give: a.give, get: a.get, responses: Object.fromEntries(s.players.filter((p) => p.id !== pid).map((p) => [p.id, null])) };
      log(s, `${nameOf(s, pid)} oferece ${resList(a.give)} por ${resList(a.get)}.`);
      break;
    }
    case 'confirmTrade': {
      const t = s.trade;
      if (!t) return { error: 'Não há oferta aberta.' };
      if (t.responses[a.with] !== 'accept') return { error: 'Esse jogador não aceitou a oferta.' };
      if (!hasRes(hand, t.give) || !hasRes(s.hands[a.with], t.get)) return { error: 'Alguém não tem mais os recursos da troca.' };
      moveRes(hand, s.hands[a.with], t.give);
      moveRes(s.hands[a.with], hand, t.get);
      log(s, `${nameOf(s, pid)} trocou com ${nameOf(s, a.with)}.`);
      s.trade = null;
      break;
    }
    case 'cancelTrade':
      if (!s.trade) return { error: 'Não há oferta aberta.' };
      s.trade = null;
      log(s, `${nameOf(s, pid)} cancelou a oferta.`);
      break;
    case 'endTurn':
      s.turn = (s.turn + 1) % s.players.length;
      s.turnNumber++;
      s.phase = 'roll';
      s.dice = null;
      s.devPlayedThisTurn = false;
      s.trade = null;
      log(s, `Vez de ${s.players[s.turn].name}.`);
      return s;
    default:
      return { error: 'Ação inválida.' };
  }
  checkWin(s);
  return s;
}

// ---------- Ações legais ----------

function suggestDiscard(hand: Resources, n: number): Partial<Resources> {
  const h = { ...hand };
  const out: Partial<Resources> = {};
  for (let i = 0; i < n; i++) {
    const r = RESOURCES.slice().sort((a, b) => h[b] - h[a])[0];
    h[r]--;
    out[r] = (out[r] ?? 0) + 1;
  }
  return out;
}

function legalActions(s: CatanState, pid: string): CatanAction[] {
  if (s.winner) return [];
  if (s.phase === 'discard') return s.pendingDiscards[pid] ? [{ type: 'discard', resources: suggestDiscard(s.hands[pid], s.pendingDiscards[pid]) }] : [];
  if (s.trade) {
    if (pid === s.trade.from) {
      const out: CatanAction[] = [{ type: 'cancelTrade' }];
      for (const [p, r] of Object.entries(s.trade.responses)) if (r === 'accept') out.push({ type: 'confirmTrade', with: p });
      return out;
    }
    if (s.trade.responses[pid] !== null) return [];
    const out: CatanAction[] = [{ type: 'respondTrade', accept: false }];
    if (hasRes(s.hands[pid], s.trade.get)) out.push({ type: 'respondTrade', accept: true });
    return out;
  }
  if (pid !== currentId(s)) return [];
  const hand = s.hands[pid];
  const hasDev = (t: DevType) => !s.devPlayedThisTurn && s.dev[pid].some((d) => d.type === t && d.boughtTurn < s.turnNumber);

  switch (s.phase) {
    case 'setup':
      if (s.lastSettlement === null) return legalSettlementVertices(s, pid, true).map((vertex) => ({ type: 'placeSettlement', vertex }));
      return catanGraph()
        .vertices[s.lastSettlement].edges.filter((e) => !s.roads[e])
        .map((edge) => ({ type: 'placeRoad', edge }));
    case 'roll': {
      const out: CatanAction[] = [{ type: 'roll' }];
      if (hasDev('knight')) out.push({ type: 'playKnight' });
      return out;
    }
    case 'robber':
      return s.board.hexes.filter((h) => h.id !== s.robber).map((h) => ({ type: 'moveRobber', hex: h.id }));
    case 'steal':
      return s.stealCandidates.map((from) => ({ type: 'steal', from }));
    case 'roadBuilding':
      return legalRoadEdges(s, pid).map((edge) => ({ type: 'buildRoad', edge }));
    case 'main': {
      const out: CatanAction[] = [{ type: 'endTurn' }];
      const left = piecesLeft(s, pid);
      if (hasRes(hand, COSTS.road) && left.road > 0) for (const edge of legalRoadEdges(s, pid)) out.push({ type: 'buildRoad', edge });
      if (hasRes(hand, COSTS.settlement) && left.settlement > 0) for (const vertex of legalSettlementVertices(s, pid, false)) out.push({ type: 'buildSettlement', vertex });
      if (hasRes(hand, COSTS.city) && left.city > 0) for (const vertex of legalCityVertices(s, pid)) out.push({ type: 'buildCity', vertex });
      if (hasRes(hand, COSTS.dev) && s.devDeck.length > 0) out.push({ type: 'buyDev' });
      if (hasDev('knight')) out.push({ type: 'playKnight' });
      if (hasDev('roadBuilding') && left.road > 0 && legalRoadEdges(s, pid).length > 0) out.push({ type: 'playRoadBuilding' });
      if (hasDev('monopoly')) for (const resource of RESOURCES) out.push({ type: 'playMonopoly', resource });
      if (hasDev('yearOfPlenty')) {
        for (let i = 0; i < RESOURCES.length; i++)
          for (let j = i; j < RESOURCES.length; j++) {
            const want = emptyRes();
            want[RESOURCES[i]]++;
            want[RESOURCES[j]]++;
            if (hasRes(s.bank, want)) out.push({ type: 'playYearOfPlenty', resources: [RESOURCES[i], RESOURCES[j]] });
          }
      }
      const rates = tradeRates(s, pid);
      for (const give of RESOURCES) {
        if (hand[give] < rates[give]) continue;
        for (const get of RESOURCES) if (get !== give && s.bank[get] > 0) out.push({ type: 'bankTrade', give, get });
      }
      // ofertas simples 1:1 (a interface permite qualquer combinação)
      RESOURCES.forEach((give, i) => {
        if (hand[give] > 0) out.push({ type: 'proposeTrade', give: { [give]: 1 }, get: { [RESOURCES[(i + 1) % 5]]: 1 } });
      });
      return out;
    }
    default:
      return [];
  }
}

// ---------- View ----------

export interface CatanPlayerView {
  id: string;
  name: string;
  color: string;
  resourceCount: number;
  devCount: number;
  knights: number;
  publicVp: number;
  roadLength: number;
  pieces: { road: number; settlement: number; city: number };
}

export interface CatanView {
  players: CatanPlayerView[];
  me: string | null;
  myHand: Resources | null;
  myDev: { type: DevType; playable: boolean }[];
  myVp: number | null;
  myRates: Resources | null;
  board: Board;
  robber: string;
  buildings: Record<string, Building>;
  roads: Record<string, string>;
  bank: Resources;
  devDeckCount: number;
  current: string;
  phase: Phase;
  setupStep: 'settlement' | 'road' | null;
  lastSettlement: string | null;
  dice: [number, number] | null;
  pendingDiscards: Record<string, number>;
  stealCandidates: string[];
  freeRoads: number;
  longestRoad: CatanState['longestRoad'];
  largestArmy: CatanState['largestArmy'];
  trade: TradeOffer | null;
  devPlayedThisTurn: boolean;
  log: string[];
  winner: string | null;
  vpToWin: number;
}

function getPlayerView(s: CatanState, pid: string | null): CatanView {
  const isPlayer = pid !== null && s.hands[pid] !== undefined;
  return {
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      resourceCount: total(s.hands[p.id]),
      devCount: s.dev[p.id].length,
      knights: s.knights[p.id],
      publicVp: victoryPoints(s, p.id, s.winner !== null),
      roadLength: longestRoadLength(s, p.id),
      pieces: piecesLeft(s, p.id),
    })),
    me: isPlayer ? pid : null,
    myHand: isPlayer ? s.hands[pid] : null,
    myDev: isPlayer ? s.dev[pid].map((d) => ({ type: d.type, playable: d.type !== 'victoryPoint' && d.boughtTurn < s.turnNumber && !s.devPlayedThisTurn })) : [],
    myVp: isPlayer ? victoryPoints(s, pid, true) : null,
    myRates: isPlayer ? tradeRates(s, pid) : null,
    board: s.board,
    robber: s.robber,
    buildings: s.buildings,
    roads: s.roads,
    bank: s.bank,
    devDeckCount: s.devDeck.length,
    current: currentId(s),
    phase: s.phase,
    setupStep: s.phase === 'setup' ? (s.lastSettlement === null ? 'settlement' : 'road') : null,
    lastSettlement: s.lastSettlement,
    dice: s.dice,
    pendingDiscards: s.pendingDiscards,
    stealCandidates: s.stealCandidates,
    freeRoads: s.freeRoads,
    longestRoad: s.longestRoad,
    largestArmy: s.largestArmy,
    trade: s.trade,
    devPlayedThisTurn: s.devPlayedThisTurn,
    log: s.log,
    winner: s.winner,
    vpToWin: s.options.vpToWin,
  };
}

function getStatus(s: CatanState): GameStatus {
  const scores = Object.fromEntries(s.players.map((p) => [p.id, victoryPoints(s, p.id, s.winner !== null)]));
  if (s.winner) return { phase: 'finished', currentPlayers: [], winners: [s.winner], scores, message: `${nameOf(s, s.winner)} venceu!` };
  const cur = currentId(s);
  let currentPlayers = [cur];
  let message = `Vez de ${nameOf(s, cur)}`;
  if (s.phase === 'discard') {
    currentPlayers = Object.keys(s.pendingDiscards);
    message = 'Jogadores com muitas cartas devem descartar metade';
  } else if (s.trade) {
    currentPlayers = [cur, ...Object.entries(s.trade.responses).filter(([, r]) => r === null).map(([p]) => p)];
    message = `${nameOf(s, cur)} propôs uma troca`;
  } else if (s.phase === 'setup') message = `${nameOf(s, cur)}: coloque ${s.lastSettlement === null ? 'uma aldeia' : 'uma estrada'}`;
  else if (s.phase === 'robber') message = `${nameOf(s, cur)} deve mover o ladrão`;
  else if (s.phase === 'steal') message = `${nameOf(s, cur)} escolhe de quem roubar`;
  return { phase: 'playing', currentPlayers, scores, message };
}

export const catan: GameDefinition<CatanState, CatanAction, CatanOptions> = {
  id: 'catan',
  name: 'Catan',
  description: 'Colonize a ilha: colete recursos, construa estradas, aldeias e cidades e negocie com os outros jogadores.',
  minPlayers: 3,
  maxPlayers: 4,
  optionsSchema: [
    {
      type: 'select',
      key: 'board',
      label: 'Tabuleiro',
      default: 'beginner',
      choices: [
        { value: 'beginner', label: 'Iniciante (fixo)' },
        { value: 'random', label: 'Aleatório' },
      ],
    },
    { type: 'number', key: 'vpToWin', label: 'Pontos de vitória para vencer', default: 10, min: 8, max: 12, step: 1 },
    { type: 'number', key: 'discardLimit', label: 'Limite de cartas no 7', default: 7, min: 7, max: 12, step: 1, description: 'Quem tiver mais cartas que isso quando sair 7 descarta metade.' },
  ],
  rulesSummary(o) {
    return [
      `Tabuleiro ${o.board === 'random' ? 'aleatório (sem 6 e 8 vizinhos)' : 'para iniciantes'}; 19 terrenos, 9 portos.`,
      'Preparação: cada jogador coloca 1 aldeia + 1 estrada, e depois outra aldeia + estrada na ordem inversa (a 2ª aldeia já produz).',
      'No seu turno: role os dados; todos com construções nos terrenos sorteados recebem recursos.',
      `Saiu 7: quem tem mais de ${o.discardLimit} cartas descarta metade, e você move o ladrão e rouba 1 carta de um vizinho.`,
      'Custos: Estrada = tijolo + madeira; Aldeia = tijolo + madeira + lã + trigo; Cidade = 2 trigo + 3 minério; Carta = lã + trigo + minério.',
      'Aldeias precisam ficar a pelo menos 2 cruzamentos de distância de qualquer outra.',
      'Troque com o banco (4:1, ou 3:1 / 2:1 em portos) e com os outros jogadores.',
      'Maior Estrada (5+) e Maior Exército (3+ cavaleiros) valem 2 pontos cada.',
      `Vence quem chegar a ${o.vpToWin} pontos no próprio turno.`,
    ];
  },
  validateConfig: () => null,
  setup: ({ players, options, seed }) =>
    setup(
      players,
      { board: options.board === 'random' ? 'random' : 'beginner', vpToWin: Number(options.vpToWin), discardLimit: Number(options.discardLimit) },
      seed,
    ),
  getPlayerView,
  getLegalActions: legalActions,
  applyAction,
  getStatus,
};
