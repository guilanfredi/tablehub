import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { RoomView } from '@tablehub/shared';
import type { GameState } from '../store/room';

export interface BoardProps {
  game: GameState;
  room: RoomView;
  you: string;
  /** Envia uma ação para o servidor. */
  act(action: Record<string, unknown> & { type: string }): void;
}

/**
 * Tabuleiro (interface) de cada jogo, carregado sob demanda.
 * `npm run new-game` adiciona a entrada automaticamente.
 */
export const BOARDS: Record<string, LazyExoticComponent<ComponentType<BoardProps>>> = {
  domino: lazy(() => import('./domino/DominoBoard')),
  'truco-paulista': lazy(() => import('./truco-paulista/TrucoBoard')),
  catan: lazy(() => import('./catan/CatanBoard')),
  // @new-game:board
};
