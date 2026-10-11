import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { GameState } from '../store/room';
import type { RoomView } from '@tablehub/shared';

export interface BoardProps {
  game: GameState;
  room: RoomView;
  you: string;
  /** Envia uma ação para o servidor. */
  act(action: Record<string, unknown> & { type: string }): void;
}

/**
 * Tabuleiro (interface) de cada jogo. Carregado sob demanda.
 * Ao adicionar um jogo, registre aqui o componente `Board` dele.
 */
export const BOARDS: Record<string, LazyExoticComponent<ComponentType<BoardProps>>> = {
  domino: lazy(() => import('./domino/DominoBoard')),
  'truco-paulista': lazy(() => import('./truco-paulista/TrucoBoard')),
  catan: lazy(() => import('./catan/CatanBoard')),
};
