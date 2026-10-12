import type { BotStrategy } from '@tablehub/game-sdk';
import { cardStrength, type Card, type TrucoAction, type TrucoView } from '@tablehub/games/truco-paulista/engine';

/** A partir do Ás (A, 2, 3) e manilhas. */
const STRONG = 7;
const MANILHA = 100;

/**
 * Estratégia simples: aceita/pede truco conforme as manilhas e cartas fortes na mão;
 * na vaza, ganha com a menor carta possível ou descarta a menor.
 */
export const trucoBot: BotStrategy<TrucoView, TrucoAction> = {
  gameId: 'truco-paulista',
  chooseAction({ view, legal }, rng) {
    const has = (type: TrucoAction['type']) => legal.find((a) => a.type === type);
    const hand = view.myHand ?? [];
    const strength = (c: Card) => cardStrength(c, view.manilha);
    const manilhas = hand.filter((c) => strength(c) >= MANILHA).length;
    const strong = hand.filter((c) => strength(c) >= STRONG).length;

    if (legal[0].type === 'onze') {
      const cards = [...hand, ...(view.partnerHand?.cards ?? [])];
      const good = cards.filter((c) => strength(c) >= STRONG).length;
      return { type: 'onze', play: cards.some((c) => strength(c) >= MANILHA) || good >= 2 };
    }

    if (view.pending) {
      if (manilhas >= 2 && has('raise')) return { type: 'raise' };
      return manilhas >= 1 || strong >= 2 ? { type: 'accept' } : { type: 'run' };
    }

    const plays = legal.filter((a): a is Extract<TrucoAction, { type: 'play' }> => a.type === 'play' && !a.faceDown);
    if (!view.myHand) return rng.pick(plays);
    if (has('truco') && manilhas >= 2 && rng.next() < 0.7) return { type: 'truco' };

    const byStrength = plays.slice().sort((a, b) => strength(hand[a.index]) - strength(hand[b.index]));
    const lowest = byStrength[0];
    if (view.current.length === 0) return byStrength[byStrength.length - 1];

    const teamOf = (id: string) => view.players.find((p) => p.id === id)?.team;
    let best = view.current[0];
    const value = (p: (typeof view.current)[number]) => (p.card && !p.faceDown ? strength(p.card) : -1);
    for (const p of view.current) if (value(p) > value(best)) best = p;
    if (teamOf(best.playerId) === view.myTeam) return lowest;
    return byStrength.find((a) => strength(hand[a.index]) > value(best)) ?? lowest;
  },
};
