import { create } from 'zustand';
import type { GameLogView } from '@tablehub/shared';

const PIN_KEY = 'th:historico-fixo';

/** Quantas entradas de outros jogadores entraram no histórico depois da marca `mark` (um `total` anterior). */
export function countSince(log: GameLogView | undefined, mark: number | null, you: string | null): number {
  if (!log || mark === null) return 0;
  const n = log.total - mark;
  if (n <= 0) return 0;
  const fresh = log.entries.slice(-Math.min(n, log.entries.length));
  // o que já saiu da janela das últimas entradas conta como jogada de outros
  return fresh.filter((e) => e.by !== you).length + Math.max(0, n - log.entries.length);
}

interface HistoryStore {
  open: boolean;
  /** Painel fixo ao lado da mesa (só no desktop). */
  pinned: boolean;
  /** `total` do log na última vez que o histórico foi visto (null = partida ainda não vista). */
  seen: number | null;
  /** `total` quando a aba foi para segundo plano. */
  awayMark: number | null;
  /** A aba voltou do segundo plano e o aviso ainda não foi dispensado. */
  returned: boolean;
  setOpen(open: boolean): void;
  togglePin(): void;
  /** A cada atualização do log: marca como visto se o painel está à vista, na 1ª vez ou em partida nova. */
  sync(total: number, visible: boolean): void;
  dismissAway(): void;
  reset(): void;
}

const readPin = () => {
  try {
    return localStorage.getItem(PIN_KEY) === '1';
  } catch {
    return false;
  }
};

let currentTotal: number | null = null;

export const useHistory = create<HistoryStore>((set, get) => ({
  open: false,
  pinned: readPin(),
  seen: null,
  awayMark: null,
  returned: false,
  setOpen: (open) => set({ open }),
  togglePin() {
    const pinned = !get().pinned;
    try {
      localStorage.setItem(PIN_KEY, pinned ? '1' : '0');
    } catch {
      /* storage indisponível */
    }
    set({ pinned, open: false });
  },
  sync(total, visible) {
    currentTotal = total;
    const { seen, awayMark, returned } = get();
    if (seen === null || total < seen || visible) set({ seen: total });
    if (awayMark !== null && (total < awayMark || (visible && returned))) set({ awayMark: null, returned: false });
  },
  dismissAway: () => set({ returned: false, awayMark: null }),
  reset() {
    currentTotal = null;
    set({ seen: null, awayMark: null, returned: false, open: false });
  },
}));

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') useHistory.setState({ awayMark: currentTotal, returned: false });
    else if (useHistory.getState().awayMark !== null) useHistory.setState({ returned: true });
  });
}
