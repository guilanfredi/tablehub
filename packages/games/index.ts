import type { GameDefinition } from '@tablehub/game-sdk';
import { catan } from './catan/engine';
import { domino } from './domino/engine';
import { trucoPaulista } from './truco-paulista/engine';

/**
 * Registro de todos os jogos disponíveis na plataforma.
 * Para adicionar um jogo: crie a pasta `packages/games/<id>/` e registre aqui
 * (e o tabuleiro em `apps/web/src/games/registry.ts`).
 */
export const GAMES: Record<string, GameDefinition> = {
  [domino.id]: domino,
  [trucoPaulista.id]: trucoPaulista,
  [catan.id]: catan,
};

export const GAME_LIST: GameDefinition[] = Object.values(GAMES);
