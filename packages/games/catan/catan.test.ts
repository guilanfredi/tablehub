import { describe, expect, it } from 'vitest';
import { isActionError, Rng } from '@tablehub/game-sdk';
import { makePlayers, randomPlayout, runConformance } from '@tablehub/game-sdk/testing';
import { catanGraph, generateBoard, redNumbersAdjacent } from './board';
import { catan, longestRoadLength, tradeRates, victoryPoints, type CatanAction, type CatanState, type CatanView } from './engine';

const opts = (o: Record<string, unknown> = {}) => ({ board: 'beginner', vpToWin: 10, discardLimit: 7, ...o }) as any;

function act(s: CatanState, pid: string, a: CatanAction): CatanState {
  const r = catan.applyAction(structuredClone(s), pid, a);
  if (isActionError(r)) throw new Error(`${a.type}: ${r.error}`);
  return r;
}
const cur = (s: CatanState) => catan.getStatus(s).currentPlayers[0];

/** Faz a preparação escolhendo sempre a primeira opção legal. */
function afterSetup(n = 3, o = opts()): CatanState {
  let s = catan.setup({ players: makePlayers(n), options: o, seed: 42 });
  while (s.phase === 'setup') {
    const p = cur(s);
    s = act(s, p, catan.getLegalActions(s, p)[0]);
  }
  return s;
}

/** Política que prioriza construir — faz partidas aleatórias terminarem. */
const PRIORITY: CatanAction['type'][] = ['buildCity', 'buildSettlement', 'buyDev', 'playKnight', 'playRoadBuilding', 'playYearOfPlenty', 'playMonopoly', 'buildRoad', 'bankTrade'];
function guided(legal: CatanAction[], rng: Rng): CatanAction {
  for (const t of PRIORITY) {
    const xs = legal.filter((a) => a.type === t);
    if (xs.length && rng.next() < 0.9) return rng.pick(xs);
  }
  const noTrade = legal.filter((a) => a.type !== 'proposeTrade');
  return rng.next() < 0.05 || noTrade.length === 0 ? rng.pick(legal) : rng.pick(noTrade);
}

describe('Catan — tabuleiro', () => {
  it('tem 19 terrenos com a distribuição oficial e 18 fichas', () => {
    const b = generateBoard('random', new Rng(1));
    const count = (t: string) => b.hexes.filter((h) => h.terrain === t).length;
    expect([count('forest'), count('pasture'), count('fields'), count('hills'), count('mountains'), count('desert')]).toEqual([4, 4, 4, 3, 3, 1]);
    expect(b.hexes.filter((h) => h.number !== null).length).toBe(18);
    expect(b.ports.length).toBe(9);
  });

  it('tabuleiro aleatório não deixa 6 e 8 vizinhos', () => {
    for (let seed = 1; seed < 30; seed++) expect(redNumbersAdjacent(generateBoard('random', new Rng(seed)).hexes)).toBe(false);
  });

  it('portos não compartilham cruzamentos', () => {
    const b = generateBoard('beginner', new Rng(1));
    const vs = b.ports.flatMap((p) => p.vertices);
    expect(new Set(vs).size).toBe(vs.length);
  });
});

describe('Catan — preparação', () => {
  it('ordem em serpente e a 2ª aldeia gera recursos', () => {
    let s = catan.setup({ players: makePlayers(3), options: opts(), seed: 7 });
    const order: string[] = [];
    while (s.phase === 'setup') {
      const p = cur(s);
      if (s.lastSettlement === null) order.push(p);
      s = act(s, p, catan.getLegalActions(s, p)[0]);
    }
    const ids = s.players.map((p) => p.id);
    expect(order).toEqual([ids[0], ids[1], ids[2], ids[2], ids[1], ids[0]]);
    const totalCards = s.players.reduce((a, p) => a + Object.values(s.hands[p.id]).reduce((x, y) => x + y, 0), 0);
    expect(totalCards).toBeGreaterThan(0);
    expect(s.phase).toBe('roll');
  });

  it('respeita a regra da distância', () => {
    let s = catan.setup({ players: makePlayers(3), options: opts(), seed: 7 });
    const p = cur(s);
    const v = catan.getLegalActions(s, p)[0] as { type: 'placeSettlement'; vertex: string };
    s = act(s, p, v);
    const neighbor = catanGraph().vertices[v.vertex].neighbors[0];
    s = act(s, p, catan.getLegalActions(s, p)[0]);
    const p2 = cur(s);
    expect(isActionError(catan.applyAction(structuredClone(s), p2, { type: 'placeSettlement', vertex: neighbor }))).toBe(true);
  });
});

describe('Catan — turno', () => {
  it('construir estrada gasta recursos e precisa ligar à rede', () => {
    let s = afterSetup();
    s.phase = 'main';
    const p = cur(s);
    s.hands[p] = { brick: 1, lumber: 1, wool: 0, grain: 0, ore: 0 };
    const roads = catan.getLegalActions(s, p).filter((a) => a.type === 'buildRoad');
    expect(roads.length).toBeGreaterThan(0);
    const far = catanGraph().edgeOrder.find((e) => !roads.some((r: any) => r.edge === e) && !s.roads[e])!;
    expect(isActionError(catan.applyAction(structuredClone(s), p, { type: 'buildRoad', edge: far }))).toBe(true);
    s = act(s, p, roads[0]);
    expect(s.hands[p].brick).toBe(0);
    expect(s.bank.brick).toBe(19 - Object.values(s.hands).reduce((a, h) => a + h.brick, 0));
  });

  it('7: descarte de metade para quem tem mais de 7 cartas, depois ladrão e roubo', () => {
    let s = afterSetup();
    const p = cur(s);
    const other = s.players.find((x) => x.id !== p)!.id;
    s.hands[other] = { brick: 3, lumber: 3, wool: 3, grain: 0, ore: 0 };
    // procura uma semente de dados que dê 7
    for (let seed = 0; seed < 1000; seed++) {
      const r = new Rng(seed);
      if (r.dice() + r.dice() === 7) {
        s.rng = seed;
        break;
      }
    }
    s = act(s, p, { type: 'roll' });
    expect(s.phase).toBe('discard');
    expect(s.pendingDiscards[other]).toBe(4);
    expect(catan.getStatus(s).currentPlayers).toContain(other);
    expect(isActionError(catan.applyAction(structuredClone(s), other, { type: 'discard', resources: { brick: 1 } }))).toBe(true);
    for (const id of Object.keys(s.pendingDiscards)) s = act(s, id, catan.getLegalActions(s, id)[0]);
    expect(s.phase).toBe('robber');
    s = act(s, p, catan.getLegalActions(s, p)[0]);
    expect(['main', 'steal']).toContain(s.phase);
  });

  it('carta comprada no turno não pode ser jogada; ponto de vitória conta na hora', () => {
    let s = afterSetup();
    s.phase = 'main';
    const p = cur(s);
    s.hands[p] = { brick: 0, lumber: 0, wool: 2, grain: 2, ore: 2 };
    s.devDeck.push('knight');
    s = act(s, p, { type: 'buyDev' });
    expect(catan.getLegalActions(s, p).some((a) => a.type === 'playKnight')).toBe(false);
    const before = victoryPoints(s, p, true);
    s.devDeck.push('victoryPoint');
    s = act(s, p, { type: 'buyDev' });
    expect(victoryPoints(s, p, true)).toBe(before + 1);
    expect((catan.getPlayerView(s, s.players.find((x) => x.id !== p)!.id) as CatanView).players.find((x) => x.id === p)!.publicVp).toBe(before);
  });

  it('troca com banco usa a melhor taxa disponível', () => {
    const s = afterSetup();
    const p = s.players[0].id;
    const rates = tradeRates(s, p);
    for (const r of Object.values(rates)) expect([2, 3, 4]).toContain(r);
  });

  it('troca entre jogadores: propor, aceitar e confirmar', () => {
    let s = afterSetup();
    s.phase = 'main';
    const p = cur(s);
    const o = s.players.find((x) => x.id !== p)!.id;
    s.hands[p] = { brick: 2, lumber: 0, wool: 0, grain: 0, ore: 0 };
    s.hands[o] = { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 1 };
    s = act(s, p, { type: 'proposeTrade', give: { brick: 2 }, get: { ore: 1 } });
    expect(catan.getStatus(s).currentPlayers).toContain(o);
    expect(isActionError(catan.applyAction(structuredClone(s), p, { type: 'endTurn' }))).toBe(true);
    s = act(s, o, { type: 'respondTrade', accept: true });
    s = act(s, p, { type: 'confirmTrade', with: o });
    expect(s.hands[p].ore).toBe(1);
    expect(s.hands[o].brick).toBe(2);
    expect(s.trade).toBeNull();
  });

  it('maior estrada exige 5 segmentos contínuos', () => {
    const s = afterSetup();
    const p = s.players[0].id;
    s.roads = {};
    s.buildings = {};
    // caminho de 5 arestas ao longo do contorno
    const g = catanGraph();
    let v = g.vertexOrder[0];
    const used = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const e = g.vertices[v].edges.find((x) => !used.has(x))!;
      used.add(e);
      s.roads[e] = p;
      const [a, b] = g.edges[e].vertices;
      v = a === v ? b : a;
    }
    expect(longestRoadLength(s, p)).toBe(5);
  });

  it('view esconde recursos e cartas dos outros', () => {
    const s = afterSetup();
    const [a, b] = s.players.map((p) => p.id);
    s.dev[b] = [{ type: 'monopoly', boughtTurn: 0 }];
    const v = catan.getPlayerView(s, a) as CatanView;
    expect(v.myHand).toEqual(s.hands[a]);
    expect(JSON.stringify(v)).not.toContain('monopoly');
    expect(v.players.find((p) => p.id === b)!.devCount).toBe(1);
  });
});

describe('Catan — conformidade', () => {
  const leakCheck = (s: CatanState, viewer: string, view: CatanView) => {
    if (s.winner) return null;
    const json = JSON.stringify(view);
    if (json.includes('devDeck"')) return 'baralho de desenvolvimento';
    for (const p of s.players) {
      if (p.id === viewer) continue;
      if (s.dev[p.id].length && view.myDev.length !== s.dev[viewer].length) return 'cartas de desenvolvimento';
    }
    return null;
  };

  it('partidas guiadas terminam com vencedor (3 e 4 jogadores)', () => {
    const r = runConformance(catan, {
      playerCounts: [3, 4],
      optionSets: [opts(), opts({ board: 'random', vpToWin: 8 })],
      seeds: 3,
      maxSteps: 6000,
      requireFinish: true,
      chooseAction: guided,
      leakCheck,
    });
    expect(r.finished).toBe(r.games);
  });

  it('partidas totalmente aleatórias não travam', () => {
    for (let seed = 1; seed <= 3; seed++) randomPlayout(catan, 4, opts(), seed, { maxSteps: 1500 });
  });
});
