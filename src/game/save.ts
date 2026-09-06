import type { Inventory, Stats } from './survival';

/** One save slot per seed in localStorage. ponytail: JSON blob, no migrations until v2 exists. */
export interface SaveData {
  v: 1;
  seed: string;
  stats: Stats;
  inventory: Inventory;
  time: number;
  elapsed: number;
  torchTime: number;
  pos: [number, number, number];
  yaw: number;
  landmarks: [string, boolean, boolean][];
  relics: boolean[];
  placed: ['campfire' | 'shelter', number, number][];
  kills: number;
  crafted: number;
  relicsFound: number;
  exitRevealed: boolean;
  bossHp: number;
  beastSeen: boolean[];
  beastKilled: number[];
}

const KEY = 'bosque.save';
const LAST = 'bosque.save.seed';

export function writeSave(d: SaveData): void {
  try {
    localStorage.setItem(`${KEY}.${d.seed}`, JSON.stringify(d));
    localStorage.setItem(LAST, d.seed);
  } catch {
    // Storage unavailable: play on without autosave.
  }
}

export function loadSave(seed: string): SaveData | null {
  try {
    const raw = localStorage.getItem(`${KEY}.${seed}`);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    return d.v === 1 ? d : null;
  } catch {
    return null;
  }
}

export function clearSave(seed: string): void {
  try {
    localStorage.removeItem(`${KEY}.${seed}`);
    if (localStorage.getItem(LAST) === seed) localStorage.removeItem(LAST);
  } catch {
    // ignore
  }
}

/** Seed of the most recent unfinished game, if any. */
export function lastSavedSeed(): string | null {
  try {
    const seed = localStorage.getItem(LAST);
    return seed && localStorage.getItem(`${KEY}.${seed}`) ? seed : null;
  } catch {
    return null;
  }
}
