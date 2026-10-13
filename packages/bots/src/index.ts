import type { BotRegistry } from '@tablehub/game-sdk';
import { catanBot } from './catan';
import { dominoBot } from './domino';
import { kingOfTokyoBot } from './king-of-tokyo';
import { trucoBot } from './truco';

/**
 * Estratégias de bot por jogo. Jogos fora daqui não aceitam bots na sala.
 * Para trocar a estratégia de um jogo, registre outro `BotStrategy` com o mesmo `gameId`.
 */
export const BOTS: BotRegistry = {
  [catanBot.gameId]: catanBot,
  [dominoBot.gameId]: dominoBot,
  [kingOfTokyoBot.gameId]: kingOfTokyoBot,
  [trucoBot.gameId]: trucoBot,
};

export { catanBot, dominoBot, kingOfTokyoBot, trucoBot };
