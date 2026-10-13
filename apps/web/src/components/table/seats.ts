export type SeatRegion = 'bottom' | 'top' | 'left' | 'right';

export interface SeatPlace {
  id: string;
  region: SeatRegion;
  /** Direção do assento a partir do centro da mesa (vetor unitário, y para baixo). */
  dx: number;
  dy: number;
}

/**
 * Distribui os assentos ao redor da mesa: quem vê fica embaixo e os demais seguem a ordem da mesa
 * (embaixo → direita → em cima → esquerda, como o Truco já fazia). Espectador vê o 1º assento embaixo.
 */
export function arrangeSeats(order: string[], viewer: string | null): SeatPlace[] {
  const n = order.length;
  const start = Math.max(0, viewer ? order.indexOf(viewer) : 0);
  return order.map((_, i) => {
    const id = order[(start + i) % n];
    const angle = Math.PI / 2 - (i * 2 * Math.PI) / n;
    const dx = Math.round(Math.cos(angle) * 1000) / 1000;
    const dy = Math.round(Math.sin(angle) * 1000) / 1000;
    const region: SeatRegion = i === 0 ? 'bottom' : dy < -0.6 ? 'top' : dx > 0 ? 'right' : 'left';
    return { id, region, dx, dy };
  });
}
