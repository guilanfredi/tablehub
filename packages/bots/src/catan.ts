import type { BotStrategy } from '@tablehub/game-sdk';
import { catanGraph, RESOURCES, TERRAIN_RESOURCE, type Resource } from '@tablehub/games/catan/board';
import { COSTS, type CatanAction, type CatanView, type Resources } from '@tablehub/games/catan/engine';

type Of<T extends CatanAction['type']> = Extract<CatanAction, { type: T }>;
type Goal = 'city' | 'settlement' | 'dev' | 'road';

/** Chance relativa de um número sair nos dados (2 e 12 = 1, 6 e 8 = 5). */
const pips = (n: number | null) => (n === null ? 0 : 6 - Math.abs(7 - n));

function hexById(view: CatanView) {
  return new Map(view.board.hexes.map((h) => [h.id, h]));
}

/** Produção esperada de um vértice (ignorando o ladrão), com bônus por variedade de recursos. */
function vertexValue(view: CatanView, vertex: string, hand?: Resources | null): number {
  const hexes = hexById(view);
  const seen = new Set<Resource>();
  let value = 0;
  for (const hid of catanGraph().vertices[vertex].hexes) {
    const h = hexes.get(hid)!;
    const res = TERRAIN_RESOURCE[h.terrain];
    if (!res) continue;
    value += pips(h.number);
    if (!seen.has(res)) value += 1;
    seen.add(res);
    if (hand && hand[res] === 0) value += 0.5;
  }
  return value;
}

/** Vértice livre e sem aldeia vizinha (regra da distância). */
function freeByDistance(view: CatanView, vertex: string): boolean {
  const v = catanGraph().vertices[vertex];
  return !view.buildings[vertex] && v.neighbors.every((n) => !view.buildings[n]);
}

/** Valor de uma estrada: o melhor vértice livre a até dois passos da sua ponta nova. */
function edgeValue(view: CatanView, edge: string, me: string): number {
  const g = catanGraph();
  let best = 0;
  for (const v of g.edges[edge].vertices) {
    const owner = view.buildings[v]?.owner;
    if (owner && owner !== me) continue;
    if (freeByDistance(view, v)) best = Math.max(best, vertexValue(view, v) + 2);
    for (const n of g.vertices[v].neighbors) if (freeByDistance(view, n)) best = Math.max(best, vertexValue(view, n));
  }
  return best;
}

function missing(hand: Resources, cost: Partial<Resources>): Partial<Resources> {
  const out: Partial<Resources> = {};
  for (const r of RESOURCES) if ((cost[r] ?? 0) > hand[r]) out[r] = (cost[r] ?? 0) - hand[r];
  return out;
}
const total = (r: Partial<Resources>) => RESOURCES.reduce((a, k) => a + (r[k] ?? 0), 0);

/** Próxima coisa a construir, conforme as peças que restam e onde ainda dá para construir. */
function goalFor(view: CatanView, me: string): Goal {
  const p = view.players.find((x) => x.id === me)!;
  const ownSettlements = Object.values(view.buildings).some((b) => b.owner === me && b.kind === 'settlement');
  if (ownSettlements && p.pieces.city > 0) return 'city';
  const spot = Object.keys(catanGraph().vertices).some(
    (v) => freeByDistance(view, v) && catanGraph().vertices[v].edges.some((e) => view.roads[e] === me),
  );
  if (spot && p.pieces.settlement > 0) return 'settlement';
  // sem lugar para aldeia: abrir caminho com estradas
  return p.pieces.road > 0 ? 'road' : 'dev';
}

/** Hexágono onde o ladrão mais atrapalha os adversários (de preferência o líder) e não me afeta. */
function robberTarget(view: CatanView, me: string, hexes: string[]): string {
  const vp = Object.fromEntries(view.players.map((p) => [p.id, p.publicVp]));
  const hexMap = hexById(view);
  let best = hexes[0];
  let bestScore = -Infinity;
  for (const hid of hexes) {
    const h = hexMap.get(hid)!;
    let score = 0;
    for (const v of catanGraph().hexes[hid].vertices) {
      const b = view.buildings[v];
      if (!b) continue;
      const weight = (b.kind === 'city' ? 2 : 1) * pips(h.number);
      score += b.owner === me ? -10 * weight : weight * (1 + vp[b.owner] / 4);
    }
    if (score > bestScore) {
      bestScore = score;
      best = hid;
    }
  }
  return best;
}

function robberOnMe(view: CatanView, me: string): boolean {
  return catanGraph().hexes[view.robber].vertices.some((v) => view.buildings[v]?.owner === me);
}

/**
 * Estratégia simples: abre nas interseções mais produtivas, prioriza cidade, aldeia,
 * carta de desenvolvimento e estrada, troca com o banco só para completar o próximo objetivo
 * e nunca propõe trocas a outros jogadores (só responde às dos humanos).
 */
export const catanBot: BotStrategy<CatanView, CatanAction> = {
  gameId: 'catan',
  chooseAction({ playerId: me, view, legal }) {
    const of = <T extends CatanAction['type']>(type: T) => legal.filter((a): a is Of<T> => a.type === type);
    const hand = view.myHand!;
    const pickMax = <T>(items: T[], score: (x: T) => number) =>
      items.reduce((best, x) => (score(x) > score(best) ? x : best));

    // descarte e resposta a trocas: podem chegar fora da minha vez
    if (legal[0].type === 'discard') return legal[0];
    const responses = of('respondTrade');
    if (responses.length) {
      const accept = responses.find((a) => a.accept);
      const t = view.trade!;
      if (!accept) return responses[0];
      const need = missing(hand, COSTS[goalFor(view, me)]);
      const helps = RESOURCES.some((r) => (t.give[r] ?? 0) > 0 && (need[r] ?? 0) > 0);
      const after = { ...hand };
      for (const r of RESOURCES) after[r] -= t.get[r] ?? 0;
      const hurts = total(missing(after, COSTS[goalFor(view, me)])) > total(need);
      const leader = view.players.find((p) => p.id === t.from)!.publicVp >= view.vpToWin - 2;
      return helps && !hurts && !leader && total(t.get) <= total(t.give) ? accept : responses[0];
    }
    if (view.trade) return of('cancelTrade')[0] ?? legal[0];

    const settlements = of('placeSettlement');
    if (settlements.length) return pickMax(settlements, (a) => vertexValue(view, a.vertex, hand));
    const setupRoads = of('placeRoad');
    if (setupRoads.length) return pickMax(setupRoads, (a) => edgeValue(view, a.edge, me));

    const robber = of('moveRobber');
    if (robber.length) {
      const hex = robberTarget(view, me, robber.map((a) => a.hex));
      return robber.find((a) => a.hex === hex)!;
    }
    const steals = of('steal');
    if (steals.length) {
      const p = (id: string) => view.players.find((x) => x.id === id)!;
      return pickMax(steals, (a) => p(a.from).publicVp * 10 + p(a.from).resourceCount);
    }

    const knight = of('playKnight')[0];
    if (knight && robberOnMe(view, me)) return knight;
    if (legal.some((a) => a.type === 'roll')) return { type: 'roll' };

    // fase principal (ou estradas grátis)
    const cities = of('buildCity');
    if (cities.length) return pickMax(cities, (a) => vertexValue(view, a.vertex));
    const builds = of('buildSettlement');
    if (builds.length) return pickMax(builds, (a) => vertexValue(view, a.vertex, hand));

    const goal = goalFor(view, me);
    const need = missing(hand, COSTS[goal]);
    const roads = of('buildRoad');
    if (roads.length && (view.phase === 'roadBuilding' || goal === 'road')) return pickMax(roads, (a) => edgeValue(view, a.edge, me));
    if (goal === 'dev' && of('buyDev').length) return { type: 'buyDev' };
    if (goal === 'road' && !roads.length && of('buyDev').length && total(hand) > 7) return { type: 'buyDev' };

    const plenty = of('playYearOfPlenty');
    if (plenty.length && total(need) > 0) {
      const useful = ([a, b]: [Resource, Resource]) => Math.min(need[a] ?? 0, 1) + Math.min((need[b] ?? 0) - (a === b ? 1 : 0), 1);
      return pickMax(plenty, (a) => useful(a.resources));
    }
    const monopoly = of('playMonopoly');
    if (monopoly.length && total(need) > 0) {
      const want = RESOURCES.find((r) => (need[r] ?? 0) > 0)!;
      return monopoly.find((a) => a.resource === want) ?? monopoly[0];
    }
    if (of('playRoadBuilding').length && goal === 'road') return { type: 'playRoadBuilding' };

    // troca com o banco: só o que sobra além do objetivo, e só se fechar o objetivo
    const rates = view.myRates!;
    const spare = (r: Resource) => Math.floor((hand[r] - (COSTS[goal][r] ?? 0)) / rates[r]);
    const tradesAvailable = RESOURCES.reduce((a, r) => a + Math.max(0, spare(r)), 0);
    if (total(need) > 0 && tradesAvailable >= total(need)) {
      const give = pickMax(RESOURCES.filter((r) => spare(r) > 0), (r) => hand[r] - (COSTS[goal][r] ?? 0));
      const get = RESOURCES.find((r) => (need[r] ?? 0) > 0)!;
      const trade = of('bankTrade').find((a) => a.give === give && a.get === get);
      if (trade) return trade;
    }

    if (roads.length && total(hand) > 7) return pickMax(roads, (a) => edgeValue(view, a.edge, me));
    return legal.find((a) => a.type === 'endTurn') ?? legal[0];
  },
};
