/** P7-C: pure pieces of the phone HUD (spec §5.1, §5.3, §5.6). No DOM here. */
import { ITEMS, type Inventory } from '../shared/items';
import { itemWord } from '../shared/names';

/** Things the player has met, per device (`localStorage['bosque.seen']`). Pills and Ayuda read them. */
export type Seen = 'berries' | 'wood' | 'wolf' | 'power' | 'mount' | 'heart' | 'orb' | 'dungeon' | 'fogata' | 'shop' | 'marchito';
export const SEEN_KEY = 'bosque.seen';
const ALL_SEEN: readonly Seen[] = ['berries', 'wood', 'wolf', 'power', 'mount', 'heart', 'orb', 'dungeon', 'fogata', 'shop', 'marchito'];

export interface DiscoverView {
  inv: Inventory;
  rank: number;
  orbs: number;
  power: boolean;
  mount: boolean;
  heart: boolean;
  /** Distance to the nearest enemy (Infinity: none). */
  wolfNear: number;
  dungeon: boolean;
  fogata: boolean;
  shop: boolean;
  marchito: boolean;
}

/** Flags this view turns on that `seen` did not have yet. A veteran (rank > 1 or an orb) sees the basics at once. */
export function discover(seen: ReadonlySet<Seen>, v: DiscoverView): Seen[] {
  const vet = v.rank > 1 || v.orbs > 0;
  const on: Record<Seen, boolean> = {
    berries: vet || (v.inv.berries ?? 0) > 0,
    wood: vet || (v.inv.wood ?? 0) > 0,
    wolf: vet || v.wolfNear <= 40,
    power: v.power,
    mount: v.mount,
    heart: v.heart,
    orb: v.orbs > 0,
    dungeon: v.dungeon,
    fogata: v.fogata,
    shop: v.shop,
    marchito: v.marchito,
  };
  return ALL_SEEN.filter((k) => on[k] && !seen.has(k));
}

export function parseSeen(raw: string | null): Set<Seen> {
  try {
    const v: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(v) ? (v.filter((k) => ALL_SEEN.includes(k as Seen)) as Seen[]) : []);
  } catch {
    return new Set();
  }
}

/** The 10 pill slots, in the fixed order of `touch.ts`. */
export const PILLS = ['eat', 'campfire', 'wall', 'heart', 'trap', 'roll', 'block', 'bow', 'lock', 'power'] as const;
export const CONTROLS = ['attack', 'jump', 'roll', 'power', 'bag'] as const;

/** Fixed five action controls; unavailable abilities dim rather than moving or disappearing. */
export function controlsDim(s: { power: boolean; bow: boolean; tools: boolean }): boolean[] {
  return [false, false, false, !s.power && !s.bow, false];
}

/** Which of the 10 slots show (a hidden pill keeps its gap: thumbs remember places). */
export function pillsShown(seen: ReadonlySet<Seen>, o: { heart: boolean; power: boolean }): boolean[] {
  const fight = seen.has('wolf');
  const show: Record<(typeof PILLS)[number], boolean> = {
    eat: seen.has('berries'),
    campfire: seen.has('wood'),
    wall: o.heart,
    heart: !o.heart,
    trap: o.heart,
    roll: fight,
    block: fight,
    bow: fight,
    lock: fight,
    power: o.power,
  };
  return PILLS.map((p) => show[p]);
}

export const TOAST = { max: 3, ms: 4000 } as const;

/** ≤ 3 toasts, newest first, 4 s each; the same text again bumps "×N" and its clock. */
export class Toasts {
  private list: { text: string; n: number; at: number }[] = [];

  push(text: string, now: number): void {
    const same = this.list.find((t) => t.text === text && now - t.at < TOAST.ms);
    if (same) {
      same.n++;
      same.at = now;
      this.list = [same, ...this.list.filter((t) => t !== same)];
      return;
    }
    this.list.unshift({ text, n: 1, at: now });
    this.list.length = Math.min(this.list.length, TOAST.max);
  }

  tick(now: number): { text: string; n: number }[] {
    this.list = this.list.filter((t) => now - t.at < TOAST.ms);
    return this.list.map(({ text, n }) => ({ text, n }));
  }
}

export const toastText = (t: { text: string; n: number }): string => (t.n > 1 ? `${t.text} ×${t.n}` : t.text);

/** One top-right line: jefe > asedio > carrera. */
export function topLine(boss: string | null, raid: string | null, race: string | null): { text: string; kind: 'boss' | 'raid' | 'race' } | null {
  if (boss) return { text: boss, kind: 'boss' };
  if (raid) return { text: raid, kind: 'raid' };
  if (race) return { text: race, kind: 'race' };
  return null;
}

/** A vital's number shows only under 50. */
export function vitalLabel(v: number): string {
  return v < 50 ? String(Math.round(v)) : '';
}

/** The 🌳 bar: only during a raid or while the Heart is hurt. */
export function heartShown(h: { hp: number; max: number } | null, raid: boolean): boolean {
  return !!h && (raid || h.hp < h.max);
}

const ICON: Record<(typeof ITEMS)[number], string> = { wood: '🪵', stone: '🪨', berries: '🫐', pearl: '⚪', amber: '🟠', quartz: '💎', thorn: '🥀' };

/** 🎒: the 7 materials (icon, word, number), then Arma, Capa and Rango. */
export function bagRows(inv: Inventory, weapon: number, capa: number, rank: string): { icon: string; label: string; n: string }[] {
  const rows = ITEMS.map((k) => ({ icon: ICON[k], label: itemWord(inv[k] ?? 0, k).replace(/^de /, ''), n: String(inv[k] ?? 0) }));
  rows.push({ icon: '🗡️', label: 'Arma', n: `+${weapon}` }, { icon: '🧥', label: 'Capa', n: String(capa) });
  if (rank) rows.push({ icon: '🌱', label: rank, n: '' });
  return rows;
}

/** No cause in the protocol: a best guess from what the client saw (spec §5.6). */
export function deathCause(o: { lastHurtAgo: number; warmth: number; hunger: number }): string {
  if (o.lastHurtAgo <= 3) return 'Te atacaron.';
  if (o.warmth <= 0) return 'El frío.';
  if (o.hunger <= 0) return 'El hambre.';
  return 'El terreno.';
}

/** The revive countdown as a 0–1 bar (the window is 30 s unless told otherwise). */
export function reviveFrac(left: number, total = 30): number {
  return Math.max(0, Math.min(1, left / total));
}
