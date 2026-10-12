import { create } from 'zustand';
import type { SoundId } from './soundEvents';

/**
 * Sons curtos sintetizados com Web Audio (sem arquivos de áudio).
 * Volume baixo e timbres suaves (seno/triângulo com ataque e decaimento curtos).
 */

const MASTER_VOLUME = 0.12;
const PREF_KEY = 'th:som';

type Note = { freq: number; at: number; dur: number; type?: OscillatorType; gain?: number };

// Frequências (Hz): C4 262, E4 330, G4 392, A4 440, C5 523, E5 659, G5 784, A5 880, C6 1047
const SOUNDS: Record<SoundId, Note[]> = {
  move: [{ freq: 659, at: 0, dur: 0.07, type: 'triangle', gain: 0.6 }],
  turn: [
    { freq: 523, at: 0, dur: 0.12 },
    { freq: 784, at: 0.1, dur: 0.18 },
  ],
  join: [
    { freq: 440, at: 0, dur: 0.1 },
    { freq: 659, at: 0.09, dur: 0.16 },
  ],
  leave: [
    { freq: 659, at: 0, dur: 0.1 },
    { freq: 440, at: 0.09, dur: 0.16 },
  ],
  ready: [{ freq: 880, at: 0, dur: 0.18, gain: 0.7 }],
  start: [
    { freq: 523, at: 0, dur: 0.12 },
    { freq: 659, at: 0.1, dur: 0.12 },
    { freq: 784, at: 0.2, dur: 0.22 },
  ],
  win: [
    { freq: 523, at: 0, dur: 0.12 },
    { freq: 659, at: 0.11, dur: 0.12 },
    { freq: 784, at: 0.22, dur: 0.12 },
    { freq: 1047, at: 0.33, dur: 0.3 },
  ],
  end: [
    { freq: 392, at: 0, dur: 0.14 },
    { freq: 330, at: 0.13, dur: 0.14 },
    { freq: 262, at: 0.26, dur: 0.26 },
  ],
  error: [{ freq: 220, at: 0, dur: 0.14, type: 'triangle', gain: 0.7 }],
};

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export const useSoundPref = create<{ enabled: boolean; toggle(): void }>((set, get) => ({
  enabled: readPref(),
  toggle() {
    const enabled = !get().enabled;
    try {
      localStorage.setItem(PREF_KEY, enabled ? 'on' : 'off');
    } catch {
      /* storage indisponível */
    }
    set({ enabled });
    if (enabled) play('ready');
  },
}));

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = typeof window !== 'undefined' ? window.AudioContext : undefined;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

// navegadores só liberam áudio depois de um gesto do usuário
if (typeof window !== 'undefined') {
  const unlock = () => {
    const c = audio();
    if (c?.state === 'suspended') void c.resume();
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}

export function play(id: SoundId) {
  if (!useSoundPref.getState().enabled) return;
  const c = audio();
  if (!c || c.state !== 'running') return;
  const t0 = c.currentTime + 0.01;
  for (const n of SOUNDS[id]) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = n.type ?? 'sine';
    osc.frequency.value = n.freq;
    const start = t0 + n.at;
    const peak = MASTER_VOLUME * (n.gain ?? 1);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(peak, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
    osc.connect(g).connect(c.destination);
    osc.start(start);
    osc.stop(start + n.dur + 0.02);
  }
}

/** Toca só o som mais importante de uma atualização, para não sobrepor vários. */
const PRIORITY: SoundId[] = ['win', 'end', 'start', 'turn', 'join', 'leave', 'ready', 'move', 'error'];
export function playFirst(ids: SoundId[]) {
  const id = PRIORITY.find((p) => ids.includes(p));
  if (id) play(id);
}
