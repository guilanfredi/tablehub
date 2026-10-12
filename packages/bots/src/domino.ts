import type { BotStrategy } from '@tablehub/game-sdk';
import type { DominoAction, DominoView, Tile } from '@tablehub/games/domino/engine';

const pips = (t: Tile) => t[0] + t[1];

/** Joga a pedra mais pesada (duplas primeiro no empate) para não ficar com pontos na mão. */
export const dominoBot: BotStrategy<DominoView, DominoAction> = {
  gameId: 'domino',
  chooseAction({ legal }) {
    const plays = legal.filter((a): a is Extract<DominoAction, { type: 'play' }> => a.type === 'play');
    if (plays.length === 0) return legal[0];
    const score = (t: Tile) => pips(t) * 2 + (t[0] === t[1] ? 1 : 0);
    return plays.reduce((best, a) => (score(a.tile) > score(best.tile) ? a : best));
  },
};
