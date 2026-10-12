import type { GameDefinition } from '@tablehub/game-sdk';
import { catan } from './catan/engine';
import { domino } from './domino/engine';
import { trucoPaulista } from './truco-paulista/engine';
import { kingOfTokyo } from './king-of-tokyo/engine';
// @new-game:import

/**
 * Registro de todos os jogos disponíveis na plataforma.
 * Para adicionar um jogo: `npm run new-game <id> "<Nome>"` (ver docs/GAME_AUTHORING.md).
 */
export const GAMES: Record<string, GameDefinition> = {
  [domino.id]: domino,
  [trucoPaulista.id]: trucoPaulista,
  [catan.id]: catan,
  [kingOfTokyo.id]: kingOfTokyo,
  // @new-game:entry
};

export const GAME_LIST: GameDefinition[] = Object.values(GAMES);
