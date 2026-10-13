import type { BotStrategy } from '@tablehub/game-sdk';
import { CARD_BY_ID, cardCost, type Face, type KingOfTokyoAction, type KingOfTokyoView } from '@tablehub/games/king-of-tokyo/engine';

type Of<T extends KingOfTokyoAction['type']> = Extract<KingOfTokyoAction, { type: T }>;

/** Cartas que causam dano a quem compra. */
const SELF_DAMAGE: Record<string, number> = { 'bombardeio-das-alturas': 3, 'avioes-de-combate': 4, 'guarda-nacional': 2, tanques: 3 };
/** Cartas cujo efeito depende de ações que o bot não usa. */
const USELESS = new Set([
  'alongado', 'chefe-do-rebanho', 'reviravolta', 'espreitador', 'telepata', 'nuvem-de-fumaca',
  'metamorfose', 'imitador', 'tentaculos-parasiticos', 'sonda-psiquica', 'raio-de-cura',
]);

/**
 * Estratégia simples: guarda os dados da face mais útil no momento (corações com pouca Vida,
 * garras com Vida sobrando, trincas de números), cede Tóquio com pouca Vida e compra
 * as cartas mais caras que pode pagar sem se matar.
 */
export const kingOfTokyoBot: BotStrategy<KingOfTokyoView, KingOfTokyoAction> = {
  gameId: 'king-of-tokyo',
  chooseAction({ playerId, view, legal }) {
    const of = <T extends KingOfTokyoAction['type']>(type: T) => legal.filter((a): a is Of<T> => a.type === type);
    const has = (a: KingOfTokyoAction) => legal.some((b) => JSON.stringify(b) === JSON.stringify(a));
    const me = view.monsters[playerId];
    const inTokyo = me.place !== 'out';
    const weak = me.hp <= 5;

    if (has({ type: 'quickHeal' }) && me.hp <= 4) return { type: 'quickHeal' };

    switch (view.pending?.type) {
      case 'yield':
        return { type: 'yield', leave: weak };
      case 'wings':
        return { type: 'wings', use: me.hp <= 4 };
      case 'opportunist': {
        const id = view.market[view.pending.slot ?? -1];
        return { type: 'opportunist', buy: Boolean(id) && worthBuying(id!) && me.energy >= cardCost(me, id!) };
      }
      case 'battery':
        return pickMax(of('battery'), (a) => (a.amount === me.energy ? -1 : a.amount));
      case 'mimic':
        return of('mimic').find((a) => a.cardId !== null) ?? of('mimic')[0];
      case 'probe':
      case 'healRay':
        return legal.find((a) => ('die' in a && a.die === null) || ('target' in a && a.target === null)) ?? legal[0];
    }

    if (view.phase === 'roll') {
      const rolls = of('roll');
      if (view.rollsUsed === 0) return rolls[0] ?? legal[0];
      if (rolls.length === 0) return { type: 'resolve' };
      const counts = new Map<Face, number>();
      for (const d of view.dice) counts.set(d.face, (counts.get(d.face) ?? 0) + 1);
      const faceValue = (f: Face, n: number): number => {
        switch (f) {
          case 'heart': return inTokyo || me.hp >= me.maxHp ? 0 : n * (weak ? 3 : 1);
          case 'claw': return weak && !inTokyo ? 0 : n * (inTokyo ? 2 : 1.5);
          case 'energy': return n * 1.2;
          default: return n >= 2 ? (n + Number(f)) * (n >= 3 ? 1.5 : 0.8) : 0;
        }
      };
      const best = pickMax(rolls, (a) => {
        const keep = a.keep ?? [];
        if (keep.length === 0) return 0.5;
        const faces = new Set(keep.map((i) => view.dice[i].face));
        return faces.size === 1 ? faceValue(view.dice[keep[0]].face, keep.length) : 0;
      });
      return (best.keep?.length ?? 0) === view.dice.length ? { type: 'resolve' } : best;
    }

    if (view.phase === 'buy') {
      const buys = of('buy').filter((a) => !a.from && worthBuying(a.cardId) && (SELF_DAMAGE[a.cardId] ?? 0) < me.hp - 2);
      if (buys.length) return pickMax(buys, (a) => CARD_BY_ID[a.cardId].cost);
      const buyable = view.market.some((id) => id && me.energy >= cardCost(me, id));
      if (!buyable && me.energy >= 8 && has({ type: 'sweep' })) return { type: 'sweep' };
      return { type: 'endTurn' };
    }

    return legal[0];
  },
};

function worthBuying(id: string): boolean {
  return !USELESS.has(id);
}

function pickMax<T>(items: T[], score: (x: T) => number): T {
  return items.reduce((best, x) => (score(x) > score(best) ? x : best));
}
