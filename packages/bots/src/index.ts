import type { BotRegistry } from '@tablehub/game-sdk';
import { dominoBot } from './domino';
import { trucoBot } from './truco';

/**
 * Estratégias de bot por jogo. Jogos fora daqui não aceitam bots na sala.
 * Para trocar a estratégia de um jogo, registre outro `BotStrategy` com o mesmo `gameId`.
 */
export const BOTS: BotRegistry = {
  [dominoBot.gameId]: dominoBot,
  [trucoBot.gameId]: trucoBot,
};

export { dominoBot, trucoBot };
