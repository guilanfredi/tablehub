import { create } from 'zustand';
import { useSoundPref } from './sounds';

/**
 * Aviso de que é a sua vez, além do som: título da aba piscando e notificação do sistema (com a aba em
 * segundo plano) e vibração curta no celular. A permissão de notificação só é pedida ao tocar no sino.
 */

const PREF_KEY = 'th:notificar';
const ALERT_TITLE = '● Sua vez! — TableHub';

type Permission = NotificationPermission | 'unsupported';

const supported = () => typeof window !== 'undefined' && 'Notification' in window;
const currentPermission = (): Permission => (supported() ? Notification.permission : 'unsupported');

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === 'on';
  } catch {
    return false;
  }
}

function savePref(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    /* storage indisponível */
  }
}

interface NotifyPref {
  enabled: boolean;
  permission: Permission;
  /** Mensagem para o usuário quando o sino não pode ser ligado. */
  toggle(): Promise<string | null>;
}

export const useNotifyPref = create<NotifyPref>((set, get) => ({
  enabled: readPref(),
  permission: currentPermission(),
  async toggle() {
    const permission = currentPermission();
    set({ permission });
    if (permission === 'unsupported') return 'Este navegador não mostra notificações.';
    if (get().enabled) {
      savePref(false);
      set({ enabled: false });
      return null;
    }
    if (permission === 'denied') return DENIED_HELP;
    const result = permission === 'granted' ? permission : await Notification.requestPermission();
    set({ permission: result });
    if (result !== 'granted') return result === 'denied' ? DENIED_HELP : null;
    savePref(true);
    set({ enabled: true });
    return null;
  },
}));

const DENIED_HELP = 'As notificações estão bloqueadas. Libere nas configurações do site (ícone ao lado do endereço) e toque no sino de novo.';

// ---------- título da aba ----------

let blink: ReturnType<typeof setInterval> | null = null;
let normalTitle: string | null = null;

const inBackground = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

function startBlink() {
  if (blink) return;
  normalTitle = document.title;
  document.title = ALERT_TITLE;
  blink = setInterval(() => {
    document.title = document.title === ALERT_TITLE ? (normalTitle ?? 'TableHub') : ALERT_TITLE;
  }, 1000);
}

/** Para o aviso (título volta ao normal). Chamado ao focar a aba e quando a vez passa. */
export function stopTurnAlert() {
  if (!blink) return;
  clearInterval(blink);
  blink = null;
  if (normalTitle !== null) document.title = normalTitle;
  normalTitle = null;
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && stopTurnAlert());
  window.addEventListener('focus', stopTurnAlert);
}

// ---------- notificação ----------

async function showNotification(gameName: string) {
  const title = 'Sua vez!';
  const options: NotificationOptions = {
    body: `Sua vez em ${gameName}`,
    tag: 'th-turn',
    icon: '/icon-192.png',
    data: { url: location.pathname + location.search },
  };
  try {
    // no Android só funciona pelo service worker; o clique é tratado em /sw-notify.js
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return await reg.showNotification(title, options);
  } catch {
    /* cai para a API direta */
  }
  try {
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* navegador recusou */
  }
}

/** Chamado quando a vez acaba de chegar ao jogador (ver `becameMyTurn`). */
export function turnAlert(gameName: string) {
  if (useSoundPref.getState().enabled) navigator.vibrate?.(150);
  if (!inBackground()) return;
  startBlink();
  const { enabled } = useNotifyPref.getState();
  if (enabled && currentPermission() === 'granted') void showNotification(gameName);
}
