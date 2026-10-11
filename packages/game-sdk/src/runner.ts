import { isActionError, type ActionResult, type GameDefinition } from './types';

export function cloneState<S>(s: S): S {
  return structuredClone(s);
}

/**
 * Executa uma ação de forma segura: clona o estado, garante que o jogador pode agir
 * agora e captura exceções do motor do jogo.
 */
export function runAction<S>(def: GameDefinition<S>, state: S, playerId: string, action: unknown): ActionResult<S> {
  const status = def.getStatus(state);
  if (status.phase === 'finished') return { error: 'A partida já terminou.' };
  if (!status.currentPlayers.includes(playerId)) return { error: 'Não é a sua vez.' };
  if (typeof action !== 'object' || action === null || typeof (action as any).type !== 'string') {
    return { error: 'Ação inválida.' };
  }
  try {
    const result = def.applyAction(cloneState(state), playerId, action as any);
    return result;
  } catch (e) {
    return { error: `Erro interno do jogo: ${(e as Error).message}` };
  }
}

export { isActionError };
