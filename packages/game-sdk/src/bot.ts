import type { GameStatus } from './types';
import type { Rng } from './rng';

/**
 * O que um jogador recebe na sua vez: exatamente o que a interface de um humano recebe
 * (visão do jogador, status e ações legais). Um bot nunca vê o estado completo do jogo.
 */
export interface PlayerTurn<V = unknown, A = unknown> {
  playerId: string;
  view: V;
  status: GameStatus;
  /** Ações legais agora; nunca vazio quando o bot é chamado. */
  legal: A[];
}

/**
 * Estratégia de um bot para um jogo. A sala trata bots como jogadores comuns:
 * a ação escolhida passa pela mesma validação de uma ação humana.
 * Trocar a estratégia de um jogo é só registrar outro `BotStrategy`.
 */
export interface BotStrategy<V = unknown, A = unknown> {
  /** Jogo para o qual a estratégia foi escrita. */
  gameId: string;
  chooseAction(turn: PlayerTurn<V, A>, rng: Rng): A;
}

/** Estratégias disponíveis, por id de jogo. */
export type BotRegistry = Record<string, BotStrategy>;
