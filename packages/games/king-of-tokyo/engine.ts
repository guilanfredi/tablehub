import { Rng, type GameDefinition, type GameStatus } from '@tablehub/game-sdk';
import { CARD_BY_ID, fullDeck } from './cards';

export * from './cards';

export interface KingOfTokyoOptions {
  powerCards: boolean;
  [k: string]: string | number | boolean;
}

export type Face = '1' | '2' | '3' | 'energy' | 'claw' | 'heart';
export const FACES: Face[] = ['1', '2', '3', 'energy', 'claw', 'heart'];
export type Place = 'out' | 'city' | 'bay';

export const MONSTERS = ['Alienoid', 'Cyber Kitty', 'Gigazaur', 'Meka Dragon', 'Space Penguin', 'The King'];

export interface Die {
  face: Face;
  kept: boolean;
  /** Dado verde (Cabeça Extra). */
  green?: boolean;
}

export interface OwnedCard {
  id: string;
  /** Cargas da Nuvem de Fumaça (também na cópia do Imitador). */
  charges?: number;
  /** Energia guardada na Bateria de Monstros. */
  energy?: number;
  /** Imitador: id da Constante copiada. */
  copy?: string | null;
}

export interface Monster {
  id: string;
  name: string;
  monster: string;
  hp: number;
  vp: number;
  energy: number;
  alive: boolean;
  place: Place;
  cards: OwnedCard[];
  poison: number;
  shrink: number;
  /** Asas ativas até o fim do turno atual. */
  shielded: boolean;
  /** Turnos extras a jogar depois do turno atual. */
  extraTurns: ('furor' | 'freeze')[];
}

export interface TurnState {
  rollsUsed: number;
  rollsMax: number;
  herdUsed: boolean;
  onivoroUsed: boolean;
  probed: string[];
  dealtDamage: boolean;
  /** Ocupantes de Tóquio que perderam Vida para o ataque deste turno. */
  attackHit: string[];
  /** Vida perdida para as garras deste turno (Jatos). */
  clawLoss: Record<string, number>;
  /** Quem cedeu cada lugar com Escavando. */
  burrowed: { city?: string; bay?: string };
  heartsLeft: number;
  /** Dados a menos por Congelar o Tempo. */
  freeze: number;
}

/** Passos pendentes da resolução (fila serializável). */
export type Effect =
  | { k: 'damage'; hits: { pid: string; n: number }[]; src: string | null; attack?: boolean; noBreath?: boolean; asked?: boolean }
  | { k: 'healRay' }
  | { k: 'selfHeal' }
  | { k: 'attack' }
  | { k: 'yield' }
  | { k: 'enter' }
  | { k: 'toBuy' }
  | { k: 'endTurn' }
  | { k: 'finish' }
  | { k: 'opportunist'; slot: number; card: string; asked: string[] };

export type Pending =
  | { type: 'wings'; players: string[] }
  | { type: 'yield'; players: string[] }
  | { type: 'opportunist'; players: string[]; slot: number }
  | { type: 'probe'; players: string[] }
  | { type: 'healRay'; players: string[] }
  | { type: 'battery'; players: string[] }
  | { type: 'mimic'; players: string[] };

export type KingOfTokyoAction =
  | { type: 'roll'; keep?: number[] }
  | { type: 'resolve' }
  | { type: 'yield'; leave: boolean }
  | { type: 'wings'; use: boolean }
  | { type: 'opportunist'; buy: boolean }
  | { type: 'probe'; die: number | null }
  | { type: 'healRay'; target: string | null; amount?: number }
  | { type: 'battery'; amount: number }
  | { type: 'mimic'; cardId: string | null }
  | { type: 'buy'; cardId: string; from?: string }
  | { type: 'buyTop' }
  | { type: 'sweep' }
  | { type: 'endTurn' }
  | { type: 'quickHeal' }
  | { type: 'stretch'; die: number; face: Face }
  | { type: 'twist'; die: number; face: Face }
  | { type: 'herd'; die: number }
  | { type: 'stalk' }
  | { type: 'smoke' }
  | { type: 'telepath' }
  | { type: 'metamorph'; cardId: string };

export type Phase = 'roll' | 'resolving' | 'buy';

export interface KingOfTokyoState {
  options: KingOfTokyoOptions;
  players: { id: string; name: string }[];
  monsters: Record<string, Monster>;
  rng: number;
  turn: number;
  phase: Phase;
  dice: Die[];
  ts: TurnState;
  market: (string | null)[];
  deck: string[];
  discard: string[];
  queue: Effect[];
  pending: Pending | null;
  /** Respostas já dadas na janela simultânea atual. */
  answers: Record<string, boolean>;
  log: string[];
  winners: string[] | null;
}

const WIN_VP = 20;
const LOG_MAX = 40;

// ---------- utilitários ----------

const cur = (s: KingOfTokyoState) => s.monsters[s.players[s.turn].id];
const alive = (s: KingOfTokyoState) => s.players.map((p) => s.monsters[p.id]).filter((m) => m.alive);
const inTokyo = (m: Monster) => m.place !== 'out';
const bayOpen = (s: KingOfTokyoState) => alive(s).length >= 5;
const occupant = (s: KingOfTokyoState, place: Place) => alive(s).find((m) => m.place === place) ?? null;
const cardName = (id: string) => CARD_BY_ID[id]?.name ?? id;

function log(s: KingOfTokyoState, text: string) {
  s.log.push(text);
  if (s.log.length > LOG_MAX) s.log.splice(0, s.log.length - LOG_MAX);
}

/** Quantas vezes o monstro tem o efeito da carta (cópias do Imitador incluídas). */
export function count(m: Monster, id: string): number {
  let n = 0;
  for (const c of m.cards) {
    if (c.id === id) n++;
    if (c.id === 'imitador' && c.copy === id) n++;
  }
  return n;
}

export function maxHp(m: Monster): number {
  return 10 + 2 * count(m, 'ainda-maior');
}

function withRng<T>(s: KingOfTokyoState, f: (r: Rng) => T): T {
  const r = new Rng(s.rng);
  const out = f(r);
  s.rng = r.state;
  return out;
}

const rollFace = (r: Rng): Face => FACES[r.int(6)];

function gainEnergy(m: Monster, n: number) {
  if (n <= 0) return;
  m.energy += n + count(m, 'amigo-das-criancas');
}

function heal(m: Monster, n: number): number {
  if (n <= 0 || !m.alive) return 0;
  const before = m.hp;
  m.hp = Math.min(maxHp(m), m.hp + n + count(m, 'regeneracao'));
  return m.hp - before;
}

function clampHp(m: Monster) {
  m.hp = Math.min(m.hp, maxHp(m));
}

export function cardCost(m: Monster, id: string): number {
  return Math.max(0, CARD_BY_ID[id].cost - count(m, 'metabolismo-alienigena'));
}

function diceCount(s: KingOfTokyoState, m: Monster): number {
  return Math.max(0, 6 + count(m, 'cabeca-extra') - m.shrink - s.ts.freeze);
}

/** Remove uma carta da frente de um monstro e acerta efeitos ligados a ela. */
function removeCard(s: KingOfTokyoState, m: Monster, index: number, toDiscard = true) {
  const [c] = m.cards.splice(index, 1);
  if (toDiscard) s.discard.push(c.id);
  clampHp(m);
  removeOrphans(s);
}

/** Cópias do Imitador cuja carta original saiu de jogo voltam ao dono. */
function removeOrphans(s: KingOfTokyoState) {
  const inPlay = new Set(alive(s).flatMap((x) => x.cards.map((k) => k.id)));
  for (const x of Object.values(s.monsters)) {
    for (const k of x.cards) {
      if (k.id === 'imitador' && k.copy && !inPlay.has(k.copy)) {
        log(s, `O Imitador de ${x.name} perdeu a cópia de ${cardName(k.copy)}.`);
        k.copy = null;
        delete k.charges;
        clampHp(x);
      }
    }
  }
}

/** Gasta o efeito de uma carta (Reviravolta, Nuvem, Sonda), preferindo o original à cópia. */
function useUp(s: KingOfTokyoState, m: Monster, id: string) {
  const i = m.cards.findIndex((c) => c.id === id);
  if (i >= 0) return removeCard(s, m, i);
  const k = m.cards.find((c) => c.id === 'imitador' && c.copy === id);
  if (k) {
    k.copy = null;
    delete k.charges;
  }
}

// ---------- preparação ----------

function freshTurnState(): TurnState {
  return { rollsUsed: 0, rollsMax: 3, herdUsed: false, onivoroUsed: false, probed: [], dealtDamage: false, attackHit: [], clawLoss: {}, burrowed: {}, heartsLeft: 0, freeze: 0 };
}

function setup(players: { id: string; name: string }[], options: KingOfTokyoOptions, seed: number): KingOfTokyoState {
  const rng = new Rng(seed);
  const s: KingOfTokyoState = {
    options,
    players: players.map((p) => ({ id: p.id, name: p.name })),
    monsters: {},
    rng: 0,
    turn: 0,
    phase: 'roll',
    dice: [],
    ts: freshTurnState(),
    market: [],
    deck: [],
    discard: [],
    queue: [],
    pending: null,
    answers: {},
    log: [],
    winners: null,
  };
  players.forEach((p, i) => {
    s.monsters[p.id] = { id: p.id, name: p.name, monster: MONSTERS[i % MONSTERS.length], hp: 10, vp: 0, energy: 0, alive: true, place: 'out', cards: [], poison: 0, shrink: 0, shielded: false, extraTurns: [] };
  });
  if (options.powerCards) {
    s.deck = rng.shuffle(fullDeck());
    s.market = s.deck.splice(0, 3);
  }
  // primeiro jogador: quem tirar mais garras (desempate rolando de novo)
  let tied = s.players.map((_, i) => i);
  while (tied.length > 1) {
    const claws = tied.map((i) => {
      const n = Array.from({ length: 6 }, () => rollFace(rng)).filter((f) => f === 'claw').length;
      return { i, n };
    });
    s.log.push('Sorteio do 1º jogador: ' + claws.map((c) => `${s.players[c.i].name} ${c.n} garra(s)`).join(', ') + '.');
    const best = Math.max(...claws.map((c) => c.n));
    tied = claws.filter((c) => c.n === best).map((c) => c.i);
  }
  s.turn = tied[0];
  s.rng = rng.state;
  startTurn(s, 0);
  return s;
}

function startTurn(s: KingOfTokyoState, freeze: number) {
  const m = cur(s);
  s.ts = freshTurnState();
  s.ts.freeze = freeze;
  s.ts.rollsMax = 3 + count(m, 'cerebro-gigante');
  s.phase = 'roll';
  s.dice = [];
  log(s, `Vez de ${m.name}${freeze ? ' (turno extra de Congelar o Tempo)' : ''}.`);
  // Bateria de Monstros devolve 2 energia por turno
  for (let i = m.cards.length - 1; i >= 0; i--) {
    const c = m.cards[i];
    if (c.id !== 'bateria-de-monstros') continue;
    const take = Math.min(2, c.energy ?? 0);
    c.energy = (c.energy ?? 0) - take;
    m.energy += take;
    if (take) log(s, `${m.name} pegou ${take} energia da Bateria de Monstros.`);
    if (!c.energy) removeCard(s, m, i);
  }
  if (inTokyo(m)) {
    m.vp += 2 + count(m, 'urbanivoro');
    log(s, `${m.name} começou o turno em Tóquio: +${2 + count(m, 'urbanivoro')} PV.`);
  }
}

// ---------- fila de efeitos ----------

function push(s: KingOfTokyoState, ...effects: Effect[]) {
  s.queue.unshift(...effects);
}

function run(s: KingOfTokyoState) {
  while (!s.pending && !s.winners && s.queue.length > 0) {
    const e = s.queue[0];
    const done = step(s, e);
    if (done) {
      const i = s.queue.indexOf(e);
      if (i >= 0) s.queue.splice(i, 1);
    }
    // o jogador da vez eliminado no meio do turno (ex.: carta que fere o comprador) encerra o turno
    if (!s.pending && !s.winners && s.queue.length === 0 && s.phase !== 'resolving' && !cur(s).alive) s.queue.push({ k: 'endTurn' });
  }
}

function open(s: KingOfTokyoState, p: Pending) {
  s.pending = p;
  s.answers = {};
}

/** Executa um passo. Retorna `false` se o passo deve continuar na fila (janela aberta). */
function step(s: KingOfTokyoState, e: Effect): boolean {
  switch (e.k) {
    case 'damage':
      return stepDamage(s, e);
    case 'healRay': {
      const m = cur(s);
      const others = alive(s).filter((x) => x.id !== m.id && x.hp < maxHp(x));
      if (count(m, 'raio-de-cura') > 0 && s.ts.heartsLeft > 0 && others.length > 0) {
        s.queue.shift();
        open(s, { type: 'healRay', players: [m.id] });
        return false;
      }
      return true;
    }
    case 'selfHeal': {
      const m = cur(s);
      let h = s.ts.heartsLeft;
      s.ts.heartsLeft = 0;
      if (h > 0 && !inTokyo(m)) {
        // corações removem fichas antes de curar
        const p = Math.min(h, m.poison);
        m.poison -= p;
        h -= p;
        const k = Math.min(h, m.shrink);
        m.shrink -= k;
        h -= k;
        if (p || k) log(s, `${m.name} removeu ${p + k} ficha(s).`);
        const got = heal(m, h);
        if (got) log(s, `${m.name} curou ${got}.`);
      }
      return true;
    }
    case 'attack':
      return stepAttack(s);
    case 'yield': {
      const m = cur(s);
      const who = s.ts.attackHit.filter((id) => s.monsters[id].alive && inTokyo(s.monsters[id]) && id !== m.id);
      if (who.length > 0) {
        s.queue.shift();
        open(s, { type: 'yield', players: who });
        return false;
      }
      return true;
    }
    case 'enter': {
      const m = cur(s);
      if (!m.alive || inTokyo(m)) return true;
      let place: Place | null = null;
      if (!occupant(s, 'city')) place = 'city';
      else if (bayOpen(s) && !occupant(s, 'bay')) place = 'bay';
      if (place) {
        m.place = place;
        m.vp += 1;
        log(s, `${m.name} entrou em ${place === 'city' ? 'Tóquio (Cidade)' : 'Tóquio (Baía)'}: +1 PV.`);
        const burrower = s.ts.burrowed[place];
        if (burrower && s.monsters[burrower].alive) push(s, { k: 'damage', hits: [{ pid: m.id, n: 1 }], src: burrower });
      }
      return true;
    }
    case 'toBuy':
      if (!s.options.powerCards) {
        s.queue.shift();
        push(s, { k: 'endTurn' });
        return false;
      }
      s.phase = 'buy';
      return true;
    case 'endTurn': {
      const m = cur(s);
      s.queue.shift();
      s.phase = 'resolving';
      const after: Effect[] = [];
      if (m.alive && m.poison > 0) after.push({ k: 'damage', hits: [{ pid: m.id, n: m.poison }], src: null });
      push(s, ...after, { k: 'finish' });
      return false;
    }
    case 'finish':
      finishTurn(s);
      return true;
    case 'opportunist':
      return stepOpportunist(s, e);
  }
}

function attackTargets(s: KingOfTokyoState, m: Monster): Monster[] {
  if (count(m, 'halito-de-supernova') > 0) return alive(s).filter((x) => x.id !== m.id);
  return alive(s).filter((x) => x.id !== m.id && inTokyo(x) !== inTokyo(m));
}

/** Dano extra de cartas do atacante quando ele causa dano (Urbanívoro). */
function outgoing(s: KingOfTokyoState, src: Monster, base: number): number {
  if (base <= 0) return 0;
  return base + (inTokyo(src) ? count(src, 'urbanivoro') : 0);
}

function stepAttack(s: KingOfTokyoState): boolean {
  const m = cur(s);
  const claws = s.dice.filter((d) => d.face === 'claw').length;
  const twos = s.dice.filter((d) => d.face === '2').length;
  let n = claws;
  if (claws > 0) {
    n += count(m, 'cauda-com-pontas');
    if (inTokyo(m)) n += count(m, 'escavando');
    if (count(m, 'monstro-alfa')) {
      m.vp += count(m, 'monstro-alfa');
      log(s, `${m.name} atacou: +${count(m, 'monstro-alfa')} PV (Monstro Alfa).`);
    }
  }
  n += count(m, 'ataque-de-acido');
  if (twos >= 3) n += 2 * count(m, 'cerdas-envenenadas');
  n = outgoing(s, m, n);
  const targets = attackTargets(s, m);
  if (n > 0 && targets.length > 0) {
    log(s, `${m.name} atacou ${targets.map((t) => t.name).join(', ')} com ${n} de dano.`);
    push(s, { k: 'damage', hits: targets.map((t) => ({ pid: t.id, n })), src: m.id, attack: true });
  }
  return true;
}

function stepDamage(s: KingOfTokyoState, e: Extract<Effect, { k: 'damage' }>): boolean {
  const hits = e.hits.filter((h) => h.n > 0 && s.monsters[h.pid].alive);
  if (!e.asked) {
    e.asked = true;
    const winged = hits.map((h) => s.monsters[h.pid]).filter((m) => count(m, 'asas') > 0 && !m.shielded && m.energy >= 2);
    if (winged.length > 0) {
      open(s, { type: 'wings', players: winged.map((m) => m.id) });
      return false;
    }
  }
  const src = e.src ? s.monsters[e.src] : null;
  const damaged: string[] = [];
  for (const h of hits) {
    const m = s.monsters[h.pid];
    let n = h.n;
    if (m.shielded) n = 0;
    if (n === 1 && count(m, 'armadura-blindada') > 0) {
      n = 0;
      log(s, `Armadura Blindada de ${m.name} ignorou 1 de dano.`);
    }
    if (n > 0 && count(m, 'camuflagem') > 0) {
      const faces = withRng(s, (r) => Array.from({ length: n }, () => rollFace(r)));
      const saved = faces.filter((f) => f === 'heart').length;
      log(s, `Camuflagem de ${m.name}: ${faces.map(faceLabel).join(' ')} (anulou ${saved}).`);
      n -= saved;
    }
    if (n <= 0) continue;
    const loss = Math.min(n, m.hp);
    m.hp -= loss;
    damaged.push(m.id);
    log(s, `${m.name} sofreu ${n} de dano.`);
    if (loss >= 2 && count(m, 'ele-so-esta-ficando-mais-forte') > 0) gainEnergy(m, count(m, 'ele-so-esta-ficando-mais-forte'));
    if (e.attack) {
      if (!s.ts.attackHit.includes(m.id)) s.ts.attackHit.push(m.id);
      s.ts.clawLoss[m.id] = (s.ts.clawLoss[m.id] ?? 0) + loss;
    }
    if (src && src.id !== m.id) {
      if (src.id === cur(s).id) s.ts.dealtDamage = true;
      m.poison += count(src, 'cuspe-envenenado');
      m.shrink += count(src, 'raio-de-encolhimento');
    }
  }
  s.queue.shift();
  const breath = src && !e.noBreath && damaged.some((id) => id !== src.id) ? count(src, 'sopro-de-fogo') : 0;
  checkDeaths(s);
  if (breath > 0 && src!.alive && !s.winners) {
    const order = s.players.map((p) => s.monsters[p.id]).filter((m) => m.alive);
    const i = order.findIndex((m) => m.id === src!.id);
    const nb = [...new Set([order[(i + 1) % order.length], order[(i - 1 + order.length) % order.length]])].filter((m) => m.id !== src!.id);
    if (nb.length) push(s, { k: 'damage', hits: nb.map((m) => ({ pid: m.id, n: breath })), src: src!.id, noBreath: true });
  }
  return false;
}

function checkDeaths(s: KingOfTokyoState) {
  const dying = s.players.map((p) => s.monsters[p.id]).filter((m) => m.alive && m.hp <= 0);
  if (dying.length === 0) return;
  for (const d of dying) {
    for (const o of alive(s)) {
      if (o.id === d.id || o.hp <= 0) continue;
      const n = count(o, 'devorador-de-mortos');
      if (n) {
        o.vp += 3 * n;
        log(s, `${o.name} ganhou ${3 * n} PV (Devorador de Mortos).`);
      }
    }
  }
  for (const d of dying) {
    const son = count(d, 'ele-tem-um-filho') > 0;
    while (d.cards.length) removeCard(s, d, d.cards.length - 1);
    d.energy = 0;
    d.place = 'out';
    d.shielded = false;
    if (son) {
      d.vp = 0;
      d.hp = 10;
      d.poison = 0;
      d.shrink = 0;
      log(s, `${d.name} chegou a 0 de Vida, mas Ele Tem um Filho! Volta com 10 de Vida.`);
    } else {
      d.alive = false;
      d.hp = 0;
      d.extraTurns = [];
      log(s, `${d.name} foi eliminado.`);
    }
  }
  const living = alive(s);
  if (living.length <= 1) {
    s.winners = living.map((m) => m.id);
    s.queue = [];
    s.pending = null;
    log(s, living.length ? `${living[0].name} é o último monstro vivo e venceu!` : 'Todos os monstros foram eliminados: ninguém venceu.');
    return;
  }
  if (living.length <= 4) {
    const bay = occupant(s, 'bay');
    if (bay) {
      bay.place = occupant(s, 'city') ? 'out' : 'city';
      log(s, `Com ${living.length} monstros, a Baía fecha: ${bay.name} ${bay.place === 'city' ? 'vai para a Cidade' : 'sai de Tóquio'}.`);
    }
  }
}

function finishTurn(s: KingOfTokyoState) {
  const m = cur(s);
  if (m.alive) {
    const acc = count(m, 'acumulador-de-energia');
    if (acc && m.energy >= 6) {
      m.vp += acc * Math.floor(m.energy / 6);
      log(s, `${m.name} ganhou ${acc * Math.floor(m.energy / 6)} PV (Acumulador de Energia).`);
    }
    if (count(m, 'energia-solar') && m.energy === 0) gainEnergy(m, count(m, 'energia-solar'));
    if (count(m, 'herbivoro') && !s.ts.dealtDamage) {
      m.vp += count(m, 'herbivoro');
      log(s, `${m.name} ganhou ${count(m, 'herbivoro')} PV (Herbívoro).`);
    }
  }
  const living = alive(s);
  for (const o of living) {
    const n = count(o, 'torcendo-pelo-azarao');
    if (n && living.every((x) => x.id === o.id || o.vp < x.vp)) {
      o.vp += n;
      log(s, `${o.name} ganhou ${n} PV (Torcendo pelo Azarão).`);
    }
  }
  for (const x of Object.values(s.monsters)) x.shielded = false;
  const champs = living.filter((x) => x.vp >= WIN_VP);
  if (champs.length > 0) {
    s.winners = champs.map((x) => x.id);
    log(s, `${champs.map((x) => x.name).join(' e ')} chegou a ${WIN_VP} PV e venceu!`);
    return;
  }
  // turnos extras antes de passar a vez
  if (m.alive && m.extraTurns.length > 0) {
    const kind = m.extraTurns.shift()!;
    startTurn(s, kind === 'freeze' ? s.ts.freeze + 1 : 0);
    return;
  }
  let i = s.turn;
  do i = (i + 1) % s.players.length;
  while (!s.monsters[s.players[i].id].alive);
  s.turn = i;
  startTurn(s, 0);
}

// ---------- compra ----------

function reveal(s: KingOfTokyoState, slot: number) {
  if (s.deck.length === 0 && s.discard.length > 0) {
    s.deck = withRng(s, (r) => r.shuffle(s.discard));
    s.discard = [];
    log(s, 'O baralho acabou: o descarte foi embaralhado.');
  }
  const id = s.deck.shift() ?? null;
  s.market[slot] = id;
  if (id) s.queue.unshift({ k: 'opportunist', slot, card: id, asked: [] });
}

function stepOpportunist(s: KingOfTokyoState, e: Extract<Effect, { k: 'opportunist' }>): boolean {
  const id = s.market[e.slot];
  if (!id || id !== e.card) return true;
  const turnIdx = s.turn;
  const n = s.players.length;
  for (let k = 1; k < n; k++) {
    const p = s.players[(turnIdx + k) % n];
    const m = s.monsters[p.id];
    if (e.asked.includes(m.id)) continue;
    if (!m.alive || count(m, 'oportunista') === 0 || m.energy < cardCost(m, id)) continue;
    e.asked.push(m.id);
    open(s, { type: 'opportunist', players: [m.id], slot: e.slot });
    return false;
  }
  return true;
}

/** Compra uma carta já paga: aplica o efeito e mantém a carta (Constante) ou descarta. */
function acquire(s: KingOfTokyoState, m: Monster, id: string, owned?: OwnedCard) {
  const def = CARD_BY_ID[id];
  const news = count(m, 'equipe-exclusiva-de-jornalismo');
  if (news) m.vp += news;
  log(s, `${m.name} comprou ${def.name}.`);
  if (def.kind === 'keep') {
    const c: OwnedCard = owned ?? { id };
    m.cards.push(c);
    if (!owned) {
      if (id === 'ainda-maior') heal(m, 2);
      if (id === 'nuvem-de-fumaca') c.charges = 3;
      if (id === 'bateria-de-monstros') {
        c.energy = 0;
        open(s, { type: 'battery', players: [m.id] });
      }
      if (id === 'imitador') {
        c.copy = null;
        if (mimicTargets(s, m).length > 0) open(s, { type: 'mimic', players: [m.id] });
      }
    }
    return;
  }
  s.discard.push(id);
  const others = alive(s).filter((x) => x.id !== m.id);
  const hitOthers = (n: number): Effect => ({ k: 'damage', hits: others.map((x) => ({ pid: x.id, n: outgoing(s, m, n) })), src: m.id });
  const hitSelf = (n: number): Effect => ({ k: 'damage', hits: [{ pid: m.id, n }], src: null });
  switch (id) {
    case 'lojinha-da-esquina': m.vp += 1; break;
    case 'trem-metropolitano': m.vp += 2; break;
    case 'predio-residencial': m.vp += 3; break;
    case 'arranha-ceu': m.vp += 4; break;
    case 'vindo-do-alto':
      m.vp += 2;
      if (!inTokyo(m)) {
        const c = occupant(s, 'city');
        if (c) c.place = 'out';
        m.place = 'city';
        log(s, `${m.name} assumiu a Cidade de Tóquio.`);
      }
      break;
    case 'energizar': gainEnergy(m, 9); break;
    case 'ordens-de-evacuacao': for (const x of others) x.vp = Math.max(0, x.vp - 5); break;
    case 'rajada-de-fogo': push(s, hitOthers(2)); break;
    case 'furor': m.extraTurns.push('furor'); break;
    case 'refinaria-de-gas': m.vp += 2; push(s, hitOthers(3)); break;
    case 'cura': heal(m, 2); break;
    case 'bombardeio-das-alturas': {
      // um único efeito: quem cair junto é eliminado ao mesmo tempo
      const e = hitOthers(3) as Extract<Effect, { k: 'damage' }>;
      e.hits.push({ pid: m.id, n: 3 });
      push(s, e);
      break;
    }
    case 'avioes-de-combate': m.vp += 5; push(s, hitSelf(4)); break;
    case 'guarda-nacional': m.vp += 2; push(s, hitSelf(2)); break;
    case 'usina-de-energia-nuclear': m.vp += 2; heal(m, 3); break;
    case 'tanques': m.vp += 4; push(s, hitSelf(3)); break;
    case 'tempestade-gigante':
      m.vp += 2;
      for (const x of others) x.energy -= Math.floor(x.energy / 2);
      break;
  }
}

function mimicTargets(s: KingOfTokyoState, m: Monster): string[] {
  const ids = new Set<string>();
  for (const x of alive(s)) for (const c of x.cards) if (c.id !== 'imitador') ids.add(c.id);
  return [...ids].sort();
}

function setMimic(s: KingOfTokyoState, m: Monster, cardId: string | null) {
  const k = m.cards.find((c) => c.id === 'imitador');
  if (!k) return;
  k.copy = cardId;
  k.charges = cardId === 'nuvem-de-fumaca' ? 3 : undefined;
  if (!k.charges) delete k.charges;
  clampHp(m);
  if (cardId) log(s, `${m.name} copiou ${cardName(cardId)} com o Imitador.`);
}

function canSeeTop(s: KingOfTokyoState, pid: string): boolean {
  const m = s.monsters[pid];
  return !s.pending && s.phase === 'buy' && cur(s).id === pid && count(m, 'criado-no-laboratorio') > 0 && s.deck.length > 0;
}

// ---------- ações ----------

function pendingPlayers(s: KingOfTokyoState): string[] {
  if (!s.pending) return [];
  return s.pending.players.filter((p) => !(p in s.answers));
}

function answer(s: KingOfTokyoState, pid: string) {
  s.answers[pid] = true;
  if (pendingPlayers(s).length === 0) {
    s.pending = null;
    s.answers = {};
  }
}

function afterRoll(s: KingOfTokyoState) {
  const m = cur(s);
  const probers = s.players
    .map((p) => s.monsters[p.id])
    .filter((x) => x.alive && x.id !== m.id && count(x, 'sonda-psiquica') > 0 && !s.ts.probed.includes(x.id));
  if (probers.length > 0 && s.dice.length > 0) open(s, { type: 'probe', players: probers.map((x) => x.id) });
}

function resolveDice(s: KingOfTokyoState) {
  const m = cur(s);
  s.phase = 'resolving';
  const faces = s.dice.map((d) => d.face);
  const n = (f: Face) => faces.filter((x) => x === f).length;
  const parts: string[] = [];
  let vp = 0;
  for (const f of ['1', '2', '3'] as Face[]) {
    const c = n(f);
    if (c >= 3) vp += Number(f) + (c - 3);
  }
  if (n('1') >= 3) {
    vp += 2 * count(m, 'gourmet');
    if (count(m, 'congelar-o-tempo')) m.extraTurns.push('freeze');
  }
  if (count(m, 'onivoro') && !s.ts.onivoroUsed && n('1') && n('2') && n('3')) {
    s.ts.onivoroUsed = true;
    vp += 2 * count(m, 'onivoro');
  }
  if (count(m, 'destruicao-total') && FACES.every((f) => n(f) > 0)) vp += 9 * count(m, 'destruicao-total');
  if (vp) parts.push(`+${vp} PV`);
  m.vp += vp;
  if (n('energy')) {
    gainEnergy(m, n('energy'));
    parts.push(`+${n('energy')} energia`);
  }
  s.ts.heartsLeft = n('heart');
  log(s, `${m.name} resolveu ${faces.map(faceLabel).join(' ') || 'nenhum dado'}${parts.length ? ': ' + parts.join(', ') : ''}.`);
  s.queue.push({ k: 'healRay' }, { k: 'selfHeal' }, { k: 'attack' }, { k: 'yield' }, { k: 'enter' }, { k: 'toBuy' });
}

export function faceLabel(f: Face): string {
  return { '1': '1', '2': '2', '3': '3', energy: 'energia', claw: 'garra', heart: 'coração' }[f];
}

const validDie = (s: KingOfTokyoState, i: unknown): i is number => Number.isInteger(i) && (i as number) >= 0 && (i as number) < s.dice.length;
const validFace = (f: unknown): f is Face => FACES.includes(f as Face);

function applyAction(s: KingOfTokyoState, pid: string, a: KingOfTokyoAction): KingOfTokyoState | { error: string } {
  const r = act(s, pid, a);
  if (r) return { error: r };
  run(s);
  return s;
}

function act(s: KingOfTokyoState, pid: string, a: KingOfTokyoAction): string | null {
  if (s.winners) return 'A partida já terminou.';
  const me = s.monsters[pid];
  if (!me) return 'Você não está nesta partida.';

  // Cura Rápida: na própria vez ou dentro de uma janela em que o jogador já esteja
  if (a.type === 'quickHeal') {
    if (!currentPlayers(s).includes(pid)) return 'Cura Rápida só pode ser usada na sua vez ou numa janela de decisão sua.';
    if (count(me, 'cura-rapida') === 0) return 'Você não tem Cura Rápida.';
    if (me.energy < 2) return 'Energia insuficiente (Cura Rápida custa 2).';
    if (me.hp >= maxHp(me)) return 'Sua Vida já está no máximo.';
    me.energy -= 2;
    heal(me, 1);
    log(s, `${me.name} usou Cura Rápida.`);
    return null;
  }

  if (s.pending) {
    const p = s.pending;
    if (!pendingPlayers(s).includes(pid)) return 'Aguarde a decisão dos outros jogadores.';
    switch (p.type) {
      case 'wings': {
        if (a.type !== 'wings') return 'Decida se usa as Asas.';
        if (a.use) {
          if (me.energy < 2) return 'Energia insuficiente.';
          me.energy -= 2;
          me.shielded = true;
          log(s, `${me.name} usou as Asas: não sofre dano até o fim do turno.`);
        }
        answer(s, pid);
        return null;
      }
      case 'yield': {
        if (a.type !== 'yield') return 'Decida se cede Tóquio.';
        if (a.leave) {
          const from = me.place;
          me.place = 'out';
          log(s, `${me.name} cedeu Tóquio.`);
          if (count(me, 'jatos') && s.ts.clawLoss[pid]) {
            me.hp = Math.min(maxHp(me), me.hp + s.ts.clawLoss[pid]);
            log(s, `${me.name} usou os Jatos e não sofreu o dano.`);
          }
          if (count(me, 'escavando') && from !== 'out') s.ts.burrowed[from as 'city' | 'bay'] = pid;
        } else log(s, `${me.name} ficou em Tóquio.`);
        answer(s, pid);
        return null;
      }
      case 'opportunist': {
        if (a.type !== 'opportunist') return 'Decida se compra a carta revelada.';
        if (a.buy) {
          const id = s.market[p.slot];
          if (!id) return 'A carta não está mais disponível.';
          const cost = cardCost(me, id);
          if (me.energy < cost) return 'Energia insuficiente.';
          me.energy -= cost;
          s.market[p.slot] = null;
          answer(s, pid);
          log(s, `${me.name} usou Oportunista.`);
          acquire(s, me, id);
          reveal(s, p.slot);
          return null;
        }
        answer(s, pid);
        return null;
      }
      case 'probe': {
        if (a.type !== 'probe') return 'Decida se usa a Sonda Psíquica.';
        if (a.die !== null) {
          if (!validDie(s, a.die)) return 'Dado inválido.';
          const f = withRng(s, rollFace);
          log(s, `${me.name} usou a Sonda Psíquica no dado ${a.die + 1}: ${faceLabel(s.dice[a.die].face)} → ${faceLabel(f)}.`);
          s.dice[a.die].face = f;
          s.ts.probed.push(pid);
          if (f === 'heart') {
            useUp(s, me, 'sonda-psiquica');
            log(s, `Saiu coração: ${me.name} descartou a Sonda Psíquica.`);
          }
        }
        answer(s, pid);
        return null;
      }
      case 'healRay': {
        if (a.type !== 'healRay') return 'Decida quem curar com o Raio de Cura.';
        if (a.target === null) {
          answer(s, pid);
          return null;
        }
        const t = s.monsters[a.target];
        if (!t || !t.alive || t.id === pid) return 'Alvo inválido.';
        const amount = Math.floor(Number(a.amount ?? 1));
        if (!(amount >= 1) || amount > s.ts.heartsLeft) return 'Corações insuficientes.';
        if (t.hp >= maxHp(t)) return `${t.name} já está com a Vida no máximo.`;
        const got = Math.min(amount, maxHp(t) - t.hp);
        t.hp += got;
        s.ts.heartsLeft -= got;
        const pay = Math.min(t.energy, 2 * got);
        t.energy -= pay;
        me.energy += pay;
        log(s, `${me.name} curou ${got} de ${t.name} com o Raio de Cura (recebeu ${pay} energia).`);
        const more = s.ts.heartsLeft > 0 && alive(s).some((x) => x.id !== pid && x.hp < maxHp(x));
        if (!more) answer(s, pid);
        return null;
      }
      case 'battery': {
        if (a.type !== 'battery') return 'Escolha quanta energia colocar na Bateria.';
        const n = Math.floor(Number(a.amount));
        if (!(n >= 0) || n > me.energy) return 'Quantidade inválida.';
        const i = me.cards.findIndex((c) => c.id === 'bateria-de-monstros' && c.energy === 0);
        me.energy -= n;
        if (i >= 0) {
          me.cards[i].energy = 2 * n;
          log(s, `${me.name} colocou ${n} energia na Bateria (o banco dobrou para ${2 * n}).`);
          if (n === 0) removeCard(s, me, i);
        }
        answer(s, pid);
        return null;
      }
      case 'mimic': {
        if (a.type !== 'mimic') return 'Escolha a carta a copiar.';
        if (a.cardId !== null && !mimicTargets(s, me).includes(a.cardId)) return 'Carta inválida para o Imitador.';
        setMimic(s, me, a.cardId);
        answer(s, pid);
        return null;
      }
    }
  }

  const m = cur(s);
  if (m.id !== pid) return 'Não é a sua vez.';

  if (s.phase === 'roll') {
    switch (a.type) {
      case 'roll': {
        if (s.ts.rollsUsed >= s.ts.rollsMax) return 'Você não tem mais rolagens.';
        if (s.ts.rollsUsed === 0) {
          const green = count(m, 'cabeca-extra');
          const n = diceCount(s, m);
          s.dice = Array.from({ length: n }, (_, i): Die => (i >= n - green ? { face: '1', kept: false, green: true } : { face: '1', kept: false }));
        } else {
          const keep = Array.isArray(a.keep) ? a.keep : [];
          if (!keep.every((i) => validDie(s, i))) return 'Dado inválido.';
          s.dice.forEach((d, i) => (d.kept = keep.includes(i)));
        }
        withRng(s, (r) => s.dice.forEach((d) => !d.kept && (d.face = rollFace(r))));
        s.ts.rollsUsed++;
        log(s, `${m.name} rolou: ${s.dice.map((d) => faceLabel(d.face)).join(' ') || 'nenhum dado'}.`);
        afterRoll(s);
        return null;
      }
      case 'resolve':
        if (s.ts.rollsUsed === 0) return 'Role os dados antes.';
        resolveDice(s);
        return null;
      case 'stretch': {
        if (!count(m, 'alongado')) return 'Você não tem Alongado.';
        if (s.ts.rollsUsed === 0) return 'Role os dados antes.';
        if (!validDie(s, a.die) || !validFace(a.face)) return 'Dado inválido.';
        if (m.energy < 2) return 'Energia insuficiente (Alongado custa 2).';
        m.energy -= 2;
        s.dice[a.die].face = a.face;
        log(s, `${m.name} usou Alongado: dado ${a.die + 1} virou ${faceLabel(a.face)}.`);
        return null;
      }
      case 'twist': {
        if (!count(m, 'reviravolta')) return 'Você não tem Reviravolta.';
        if (s.ts.rollsUsed === 0) return 'Role os dados antes.';
        if (!validDie(s, a.die) || !validFace(a.face)) return 'Dado inválido.';
        s.dice[a.die].face = a.face;
        log(s, `${m.name} usou Reviravolta: dado ${a.die + 1} virou ${faceLabel(a.face)}.`);
        useUp(s, m, 'reviravolta');
        return null;
      }
      case 'herd': {
        if (!count(m, 'chefe-do-rebanho')) return 'Você não tem Chefe do Rebanho.';
        if (s.ts.herdUsed) return 'Chefe do Rebanho já foi usado neste turno.';
        if (s.ts.rollsUsed === 0) return 'Role os dados antes.';
        if (!validDie(s, a.die)) return 'Dado inválido.';
        s.dice[a.die].face = '1';
        s.ts.herdUsed = true;
        log(s, `${m.name} usou Chefe do Rebanho: dado ${a.die + 1} virou 1.`);
        return null;
      }
      case 'stalk': {
        if (!count(m, 'espreitador')) return 'Você não tem Espreitador.';
        if (s.ts.rollsUsed === 0) return 'Role os dados antes.';
        const threes = s.dice.filter((d) => d.face === '3');
        if (!threes.length) return 'Você não tem dados com 3.';
        withRng(s, (r) => threes.forEach((d) => (d.face = rollFace(r))));
        log(s, `${m.name} rerrolou os 3 (Espreitador): ${s.dice.map((d) => faceLabel(d.face)).join(' ')}.`);
        return null;
      }
      case 'smoke': {
        const c = m.cards.find((k) => (k.id === 'nuvem-de-fumaca' || (k.id === 'imitador' && k.copy === 'nuvem-de-fumaca')) && (k.charges ?? 0) > 0);
        if (!c) return 'Você não tem Nuvem de Fumaça com carga.';
        if (s.ts.rollsUsed === 0 || s.ts.rollsUsed < s.ts.rollsMax) return 'Use a Nuvem de Fumaça quando acabarem as rolagens.';
        c.charges = (c.charges ?? 0) - 1;
        s.ts.rollsMax++;
        log(s, `${m.name} gastou uma carga da Nuvem de Fumaça: +1 rolagem.`);
        if (!c.charges) {
          if (c.id === 'imitador') c.copy = null;
          else removeCard(s, m, m.cards.indexOf(c));
        }
        return null;
      }
      case 'telepath': {
        if (!count(m, 'telepata')) return 'Você não tem Telepata.';
        if (s.ts.rollsUsed === 0 || s.ts.rollsUsed < s.ts.rollsMax) return 'Use o Telepata quando acabarem as rolagens.';
        if (m.energy < 1) return 'Energia insuficiente (Telepata custa 1).';
        m.energy -= 1;
        s.ts.rollsMax++;
        log(s, `${m.name} pagou 1 energia (Telepata): +1 rolagem.`);
        return null;
      }
      case 'mimic': {
        if (s.ts.rollsUsed > 0) return 'O Imitador só muda no início do turno.';
        if (!m.cards.some((c) => c.id === 'imitador')) return 'Você não tem Imitador.';
        if (a.cardId === null || !mimicTargets(s, m).includes(a.cardId)) return 'Carta inválida para o Imitador.';
        if (m.energy < 1) return 'Energia insuficiente (mudar o Imitador custa 1).';
        m.energy -= 1;
        setMimic(s, m, a.cardId);
        return null;
      }
    }
    return 'Ação inválida agora: role os dados ou pare.';
  }

  if (s.phase === 'buy') {
    switch (a.type) {
      case 'buy': {
        if (a.from) {
          if (!count(m, 'tentaculos-parasiticos')) return 'Você não tem Tentáculos Parasíticos.';
          const owner = s.monsters[a.from];
          if (!owner || !owner.alive || owner.id === pid) return 'Monstro inválido.';
          const i = owner.cards.findIndex((c) => c.id === a.cardId);
          if (i < 0) return 'Esse monstro não tem essa carta.';
          const cost = cardCost(m, a.cardId);
          if (m.energy < cost) return `Energia insuficiente (${cardName(a.cardId)} custa ${cost}).`;
          m.energy -= cost;
          owner.energy += cost;
          const [c] = owner.cards.splice(i, 1);
          clampHp(owner);
          acquire(s, m, a.cardId, c);
          removeOrphans(s);
          return null;
        }
        const slot = s.market.indexOf(a.cardId);
        if (slot < 0) return 'Essa carta não está na vitrine.';
        const cost = cardCost(m, a.cardId);
        if (m.energy < cost) return `Energia insuficiente (${cardName(a.cardId)} custa ${cost}).`;
        m.energy -= cost;
        s.market[slot] = null;
        acquire(s, m, a.cardId);
        reveal(s, slot);
        return null;
      }
      case 'buyTop': {
        if (!canSeeTop(s, pid)) return 'Você não pode comprar o topo do baralho.';
        const id = s.deck[0];
        const cost = cardCost(m, id);
        if (m.energy < cost) return `Energia insuficiente (${cardName(id)} custa ${cost}).`;
        m.energy -= cost;
        s.deck.shift();
        acquire(s, m, id);
        return null;
      }
      case 'sweep': {
        if (m.energy < 2) return 'Energia insuficiente (limpar a vitrine custa 2).';
        m.energy -= 2;
        for (const id of s.market) if (id) s.discard.push(id);
        log(s, `${m.name} limpou a vitrine.`);
        s.market = [null, null, null];
        for (let i = 2; i >= 0; i--) reveal(s, i);
        return null;
      }
      case 'metamorph': {
        if (!count(m, 'metamorfose')) return 'Você não tem Metamorfose.';
        const i = m.cards.findIndex((c) => c.id === a.cardId);
        if (i < 0) return 'Você não tem essa carta.';
        const value = CARD_BY_ID[a.cardId].cost;
        removeCard(s, m, i);
        m.energy += value;
        log(s, `${m.name} descartou ${cardName(a.cardId)} (Metamorfose): +${value} energia.`);
        return null;
      }
      case 'endTurn':
        s.queue.push({ k: 'endTurn' });
        return null;
    }
    return 'Ação inválida agora: compre cartas ou encerre o turno.';
  }
  return 'Ação inválida agora.';
}

// ---------- ações legais ----------

function keepOptions(s: KingOfTokyoState): number[][] {
  const out: number[][] = [[]];
  const seen = new Set<string>(['']);
  for (const f of FACES) {
    const idx = s.dice.map((d, i) => (d.face === f ? i : -1)).filter((i) => i >= 0);
    const k = idx.join(',');
    if (idx.length && !seen.has(k)) {
      seen.add(k);
      out.push(idx);
    }
  }
  const kept = s.dice.map((d, i) => (d.kept ? i : -1)).filter((i) => i >= 0);
  if (!seen.has(kept.join(','))) out.push(kept);
  return out;
}

function legalActions(s: KingOfTokyoState, pid: string): KingOfTokyoAction[] {
  if (s.winners || !currentPlayers(s).includes(pid)) return [];
  const me = s.monsters[pid];
  const out: KingOfTokyoAction[] = [];
  if (count(me, 'cura-rapida') && me.energy >= 2 && me.hp < maxHp(me)) out.push({ type: 'quickHeal' });
  if (s.pending) {
    const p = s.pending;
    switch (p.type) {
      case 'wings': out.push({ type: 'wings', use: true }, { type: 'wings', use: false }); break;
      case 'yield': out.push({ type: 'yield', leave: true }, { type: 'yield', leave: false }); break;
      case 'opportunist': out.push({ type: 'opportunist', buy: true }, { type: 'opportunist', buy: false }); break;
      case 'probe': out.push({ type: 'probe', die: null }, ...s.dice.map((_, i) => ({ type: 'probe' as const, die: i }))); break;
      case 'healRay':
        out.push({ type: 'healRay', target: null });
        for (const x of alive(s)) if (x.id !== pid && x.hp < maxHp(x)) out.push({ type: 'healRay', target: x.id, amount: 1 });
        break;
      case 'battery': out.push(...[...new Set([0, Math.floor(me.energy / 2), me.energy])].map((amount) => ({ type: 'battery' as const, amount }))); break;
      case 'mimic': out.push({ type: 'mimic', cardId: null }, ...mimicTargets(s, me).map((cardId) => ({ type: 'mimic' as const, cardId }))); break;
    }
    return out;
  }
  const m = me;
  if (s.phase === 'roll') {
    const t = s.ts;
    if (t.rollsUsed < t.rollsMax) {
      if (t.rollsUsed === 0) out.push({ type: 'roll' });
      else for (const keep of keepOptions(s)) out.push({ type: 'roll', keep });
    }
    if (t.rollsUsed > 0) {
      out.push({ type: 'resolve' });
      const outOfRolls = t.rollsUsed >= t.rollsMax;
      if (outOfRolls && m.cards.some((k) => (k.id === 'nuvem-de-fumaca' || (k.id === 'imitador' && k.copy === 'nuvem-de-fumaca')) && (k.charges ?? 0) > 0)) out.push({ type: 'smoke' });
      if (outOfRolls && count(m, 'telepata') && m.energy >= 1) out.push({ type: 'telepath' });
      if (count(m, 'espreitador') && s.dice.some((d) => d.face === '3')) out.push({ type: 'stalk' });
      const firstNon = (f: Face) => s.dice.findIndex((d) => d.face !== f);
      if (count(m, 'chefe-do-rebanho') && !t.herdUsed && firstNon('1') >= 0) out.push({ type: 'herd', die: firstNon('1') });
      if (count(m, 'alongado') && m.energy >= 2 && firstNon('claw') >= 0) out.push({ type: 'stretch', die: firstNon('claw'), face: 'claw' });
      if (count(m, 'reviravolta') && firstNon('heart') >= 0) out.push({ type: 'twist', die: firstNon('heart'), face: 'heart' });
    } else if (m.cards.some((c) => c.id === 'imitador') && m.energy >= 1) {
      for (const cardId of mimicTargets(s, m)) out.push({ type: 'mimic', cardId });
    }
    return out;
  }
  if (s.phase === 'buy') {
    for (const id of new Set(s.market)) if (id && m.energy >= cardCost(m, id)) out.push({ type: 'buy', cardId: id });
    if (canSeeTop(s, pid) && m.energy >= cardCost(m, s.deck[0])) out.push({ type: 'buyTop' });
    if (m.energy >= 2) out.push({ type: 'sweep' });
    if (count(m, 'tentaculos-parasiticos')) {
      for (const x of alive(s)) {
        if (x.id === pid) continue;
        for (const c of new Set(x.cards.map((k) => k.id))) if (m.energy >= cardCost(m, c)) out.push({ type: 'buy', cardId: c, from: x.id });
      }
    }
    if (count(m, 'metamorfose')) for (const c of new Set(m.cards.map((k) => k.id))) out.push({ type: 'metamorph', cardId: c });
    out.push({ type: 'endTurn' });
  }
  return out;
}

function currentPlayers(s: KingOfTokyoState): string[] {
  if (s.winners) return [];
  if (s.pending) return pendingPlayers(s);
  return [cur(s).id];
}

// ---------- view e status ----------

export interface KingOfTokyoView {
  options: KingOfTokyoOptions;
  players: { id: string; name: string }[];
  monsters: Record<string, Monster & { maxHp: number }>;
  turn: string;
  phase: Phase;
  dice: Die[];
  rollsUsed: number;
  rollsMax: number;
  heartsLeft: number;
  herdUsed: boolean;
  market: (string | null)[];
  deckCount: number;
  /** Topo do baralho, só para o dono de Criado no Laboratório durante a compra. */
  deckTop: string | null;
  discard: string[];
  pending: { type: Pending['type']; players: string[]; slot?: number } | null;
  bay: boolean;
  log: string[];
  winners: string[] | null;
}

function view(s: KingOfTokyoState, pid: string | null): KingOfTokyoView {
  return {
    options: s.options,
    players: s.players,
    monsters: Object.fromEntries(Object.entries(s.monsters).map(([k, m]) => [k, { ...m, maxHp: maxHp(m) }])),
    turn: cur(s).id,
    phase: s.phase,
    dice: s.dice,
    rollsUsed: s.ts.rollsUsed,
    rollsMax: s.ts.rollsMax,
    heartsLeft: s.ts.heartsLeft,
    herdUsed: s.ts.herdUsed,
    market: s.market,
    deckCount: s.deck.length,
    deckTop: pid && canSeeTop(s, pid) ? s.deck[0] : null,
    discard: s.discard,
    pending: s.pending ? { type: s.pending.type, players: pendingPlayers(s), ...(s.pending.type === 'opportunist' ? { slot: s.pending.slot } : {}) } : null,
    bay: bayOpen(s),
    log: s.log,
    winners: s.winners,
  };
}

function getStatus(s: KingOfTokyoState): GameStatus {
  const scores = Object.fromEntries(s.players.map((p) => [p.id, s.monsters[p.id].vp]));
  if (s.winners) {
    const names = s.winners.map((id) => s.monsters[id].name);
    return { phase: 'finished', currentPlayers: [], winners: s.winners, scores, message: names.length ? `${names.join(' e ')} venceu!` : 'Ninguém venceu.' };
  }
  const m = cur(s);
  const players = currentPlayers(s);
  const msgs: Record<Pending['type'], string> = {
    wings: 'Decidindo se usa as Asas',
    yield: 'Decidindo se cede Tóquio',
    opportunist: 'Oportunista: comprar a carta revelada?',
    probe: 'Sonda Psíquica: rerrolar um dado?',
    healRay: 'Raio de Cura: curar outros monstros?',
    battery: 'Bateria de Monstros: quanta energia colocar?',
    mimic: 'Imitador: escolher a carta a copiar',
  };
  if (s.pending) {
    const names = players.map((id) => s.monsters[id].name).join(', ');
    return { phase: 'playing', currentPlayers: players, scores, message: `${msgs[s.pending.type]}: ${names}` };
  }
  return { phase: 'playing', currentPlayers: players, scores, message: `Vez de ${m.name}` };
}

export const kingOfTokyo: GameDefinition<KingOfTokyoState, KingOfTokyoAction, KingOfTokyoOptions> = {
  id: 'king-of-tokyo',
  name: 'King of Tokyo',
  description: 'Monstros gigantes disputam Tóquio com dados: 20 PV ou ser o último vivo.',
  minPlayers: 2,
  maxPlayers: 6,
  optionsSchema: [
    {
      type: 'boolean',
      key: 'powerCards',
      label: 'Cartas de Poder',
      default: true,
      description: 'Sem as cartas, a partida é só com dados (bom para iniciantes).',
    },
  ],
  rulesSummary(o, n) {
    const lines = [
      'Cada monstro começa com 10 de Vida. Vence quem chegar a 20 PV ou for o último vivo.',
      'Na sua vez, role 6 dados até 3 vezes, guardando os que quiser.',
      '1 1 1, 2 2 2 e 3 3 3 dão PV (1, 2 ou 3; +1 por dado igual extra). Energia compra cartas, coração cura e garra ataca.',
      'Quem está em Tóquio ataca todos de fora; quem está fora ataca quem está em Tóquio. Entrar dá +1 PV e começar o turno lá dá +2 PV, mas lá os corações não curam.',
      'Atingido em Tóquio, você pode ceder o lugar ao atacante.',
    ];
    if (n >= 5) lines.push('Com 5 ou 6 monstros vivos, a Baía de Tóquio também é ocupada.');
    lines.push(o.powerCards ? 'Cartas de Poder: compre com energia (limpar a vitrine custa 2).' : 'Sem cartas de Poder: partida só com dados.');
    return lines;
  },
  validateConfig: () => null,
  setup: ({ players, options, seed }) => setup(players, { ...options, powerCards: options.powerCards !== false }, seed),
  getPlayerView: view,
  getLegalActions: legalActions,
  applyAction,
  getStatus,
};

/** Utilitários para testes: montar estados controlados. */
export const _test = { run, startTurn, resolveDice, checkDeaths, reveal, cur, alive };
