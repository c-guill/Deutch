import { useSyncExternalStore } from 'react';

/**
 * Light gamification state (XP, daily streak, sound) kept in localStorage only.
 * The Supabase schema is intentionally untouched.
 */
export interface GameState {
  xp: number;
  streakDays: number;
  lastActiveDate: string | null; // YYYY-MM-DD (local)
  soundOn: boolean;
}

const STORAGE_KEY = 'deutsch-a1-game-v1';
const DEFAULT_STATE: GameState = { xp: 0, streakDays: 0, lastActiveDate: null, soundOn: true };

function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

function read(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<GameState>) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

let state: GameState = read();
const listeners = new Set<() => void>();

function commit(next: GameState) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: keep in-memory state only
  }
  listeners.forEach((l) => l());
}

export function getGameState(): GameState {
  return state;
}

/** Streak shown to the user: expires if no activity yesterday or today. */
export function effectiveStreak(s: GameState = state): number {
  if (!s.lastActiveDate) return 0;
  if (s.lastActiveDate === dayKey(new Date()) || s.lastActiveDate === yesterdayKey()) {
    return s.streakDays;
  }
  return 0;
}

export function addXp(amount: number): void {
  commit({ ...state, xp: state.xp + amount });
}

/** Call when a session is completed. Returns the updated streak in days. */
export function completeSessionForStreak(): { streak: number; extendedToday: boolean } {
  const today = dayKey(new Date());
  if (state.lastActiveDate === today) {
    return { streak: Math.max(1, state.streakDays), extendedToday: false };
  }
  const streak = state.lastActiveDate === yesterdayKey() ? state.streakDays + 1 : 1;
  commit({ ...state, streakDays: streak, lastActiveDate: today });
  return { streak, extendedToday: true };
}

export function setSoundOn(on: boolean): void {
  commit({ ...state, soundOn: on });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useGameState(): GameState {
  return useSyncExternalStore(subscribe, getGameState, getGameState);
}

/* ---------- Tiny sound effects (WebAudio, no assets) ---------- */
let audioCtx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.12) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, audioCtx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, audioCtx.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + start + dur);
  osc.connect(g).connect(audioCtx.destination);
  osc.start(audioCtx.currentTime + start);
  osc.stop(audioCtx.currentTime + start + dur + 0.05);
}

export function playSound(kind: 'correct' | 'wrong' | 'complete'): void {
  if (!state.soundOn) return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioCtx = audioCtx ?? new Ctor();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    if (kind === 'correct') {
      tone(660, 0, 0.12);
      tone(880, 0.1, 0.18);
    } else if (kind === 'wrong') {
      tone(220, 0, 0.18, 'sawtooth', 0.08);
      tone(165, 0.14, 0.22, 'sawtooth', 0.08);
    } else {
      tone(523, 0, 0.14);
      tone(659, 0.12, 0.14);
      tone(784, 0.24, 0.14);
      tone(1047, 0.36, 0.3);
    }
  } catch {
    // audio not available
  }
}
