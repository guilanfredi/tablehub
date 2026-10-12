import { create } from 'zustand';
import type { ClientMessage, GameStatusView, RoomView, ServerMessage } from '@tablehub/shared';
import { getName, getToken } from '../lib/session';
import { gameSounds, roomSounds } from '../lib/soundEvents';
import { playFirst } from '../lib/sounds';

export interface GameState {
  gameId: string;
  seq: number;
  view: any;
  status: GameStatusView;
  legal: any[];
}

type Conn = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

interface RoomStore {
  code: string | null;
  conn: Conn;
  room: RoomView | null;
  you: string | null;
  game: GameState | null;
  toast: { id: number; text: string } | null;
  fatal: string | null;
  connect(code: string): void;
  disconnect(): void;
  send(msg: ClientMessage): void;
  dismissToast(): void;
}

let socket: WebSocket | null = null;
let retry = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let wanted: string | null = null;

export const useRoom = create<RoomStore>((set, get) => {
  const showToast = (text: string) => set({ toast: { id: Date.now(), text } });

  function cleanup() {
    if (retryTimer) clearTimeout(retryTimer);
    if (pingTimer) clearInterval(pingTimer);
    retryTimer = null;
    pingTimer = null;
    if (socket) {
      socket.onclose = null;
      socket.onmessage = null;
      socket.close();
      socket = null;
    }
  }

  function open(code: string) {
    cleanup();
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/${code}`);
    socket = ws;
    set({ conn: retry > 0 ? 'reconnecting' : 'connecting' });

    ws.onopen = () => {
      retry = 0;
      ws.send(JSON.stringify({ t: 'hello', token: getToken(), name: getName() || 'Jogador' } satisfies ClientMessage));
      set({ conn: 'open' });
      pingTimer = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('{"t":"ping"}'), 25_000);
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data as string) as ServerMessage;
      switch (msg.t) {
        case 'room':
          playFirst(roomSounds(get().room, msg.room, msg.you));
          set((s) => ({ room: msg.room, you: msg.you, game: msg.room.status === 'lobby' ? null : s.game }));
          break;
        case 'game':
          playFirst(gameSounds(get().game, msg, get().you));
          set({ game: { gameId: msg.gameId, seq: msg.seq, view: msg.view, status: msg.status, legal: msg.legal } });
          break;
        case 'error':
          if (msg.fatal) {
            wanted = null;
            set({ fatal: msg.message, conn: 'closed' });
          } else {
            playFirst(['error']);
            showToast(msg.message);
          }
          break;
        case 'kicked':
          wanted = null;
          set({ fatal: 'Você foi removido da sala pelo dono.', conn: 'closed' });
          break;
      }
    };
    ws.onclose = () => {
      if (pingTimer) clearInterval(pingTimer);
      if (!wanted || wanted !== code || get().fatal) {
        set({ conn: 'closed' });
        return;
      }
      retry++;
      set({ conn: 'reconnecting' });
      const delay = Math.min(10_000, 500 * 2 ** Math.min(retry, 5));
      retryTimer = setTimeout(() => wanted === code && open(code), delay);
    };
  }

  // reconecta ao voltar para a aba (celular costuma derrubar a conexão em segundo plano)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && wanted && (!socket || socket.readyState > WebSocket.OPEN)) {
        retry = 0;
        open(wanted);
      }
    });
  }

  return {
    code: null,
    conn: 'idle',
    room: null,
    you: null,
    game: null,
    toast: null,
    fatal: null,
    connect(code) {
      if (wanted === code && socket) return;
      wanted = code;
      retry = 0;
      set({ code, room: null, game: null, fatal: null, you: null });
      open(code);
    },
    disconnect() {
      wanted = null;
      cleanup();
      set({ code: null, conn: 'idle', room: null, game: null, you: null, fatal: null });
    },
    send(msg) {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
      else showToast('Sem conexão com o servidor. Tentando reconectar…');
    },
    dismissToast: () => set({ toast: null }),
  };
});

/** Atalho para enviar ações de jogo. */
export function sendAction(action: Record<string, unknown> & { type: string }) {
  useRoom.getState().send({ t: 'action', action });
}
