import { MOUNT, ringAngle } from '../shared/mount';
import { FISH } from '../shared/fish';
import { FROG } from '../shared/frog';
import { WHALE } from '../shared/whale';
import type { SteedView, TameView, WhaleView } from '../shared/protocol';

export interface MountCtx {
  pos: { x: number; z: number };
  tame: TameView | null;
  riding: boolean;
  /** Owns a tamed deer. */
  hasSteed: boolean;
  /** Deer standing around (wild: owner null). */
  steeds: readonly SteedView[];
  me: string;
  /** The rider we sit behind, if any. */
  seat: string | null;
  /** Other players riding nearby; `full` = somebody already sits behind them. */
  riders: readonly { name: string; x: number; z: number; full: boolean }[];
  /** The giant fish: owns one, rides it, is racing the rings, the water here is shallow enough to get off, and fish in view (wild: owner null). */
  hasFish?: boolean;
  onFish?: boolean;
  racing?: boolean;
  shallow?: boolean;
  fishes?: readonly SteedView[];
  /** La Rana: owns one, rides it, and frogs in view (wild: owner null). */
  hasFrog?: boolean;
  onFrog?: boolean;
  frogs?: readonly SteedView[];
  /** La Ballena (always in the snapshot) and our seat on it. */
  whale?: WhaleView | null;
  whaleSeat?: number | null;
}

/** The contextual A / E / M action for the deer, if any. The server re-checks everything. */
export function mountAction(c: MountCtx): { act: number; label: string } | null {
  if (c.tame) return { act: 1, label: '¡Ahora!' };
  if (c.seat) return { act: 5, label: 'Bajar' };
  if (c.whaleSeat != null) return { act: 11, label: 'Bajar de la ballena' };
  const w = c.whale;
  const dw = w ? Math.hypot(w.x - c.pos.x, w.z - c.pos.z) : Infinity;
  if (c.onFrog) return { act: 14, label: 'Bajar de la rana' };
  if (w && !c.riding && !c.racing) {
    if (w.tamed && dw <= WHALE.reach && w.seats.includes(null)) return { act: 10, label: 'Subir a la ballena' };
    if (!w.tamed && !w.diving && dw <= WHALE.tameReach) return { act: 9, label: 'Domar la ballena' };
  }
  if (c.riding) return { act: 3, label: 'Bajar del ciervo' };
  if (c.onFish) return c.shallow ? { act: 8, label: 'Bajar del pez' } : null;
  if (c.racing) return null;
  const nearFish = (s: { x: number; z: number }) => Math.hypot(s.x - c.pos.x, s.z - c.pos.z) <= FISH.reach;
  const fishes = c.fishes ?? [];
  if (c.hasFish && fishes.some((s) => s.owner === c.me && nearFish(s))) return { act: 7, label: 'Montar el pez' };
  if (!c.hasFish && fishes.some((s) => s.owner === null && nearFish(s))) return { act: 6, label: 'Domar al pez' };
  const nearFrog = (s: { x: number; z: number }) => Math.hypot(s.x - c.pos.x, s.z - c.pos.z) <= FROG.reach;
  const frogs = c.frogs ?? [];
  if (c.hasFrog && frogs.some((s) => s.owner === c.me && nearFrog(s))) return { act: 13, label: 'Montar la rana' };
  if (!c.hasFrog && frogs.some((s) => s.owner === null && nearFrog(s))) return { act: 12, label: 'Domar a la rana' };
  const near = (s: { x: number; z: number }) => Math.hypot(s.x - c.pos.x, s.z - c.pos.z) <= MOUNT.reach;
  if (c.hasSteed && c.steeds.some((s) => s.owner === c.me && near(s))) return { act: 2, label: 'Montar' };
  const ride = c.riders.find((r) => !r.full && near(r));
  if (ride) return { act: 4, label: `Subir detrás de ${ride.name}` };
  if (c.hasSteed) return null;
  return c.steeds.some((s) => s.owner === null && near(s)) ? { act: 0, label: 'Domar al ciervo' } : null;
}

/** Needle angle to draw now (same maths the server judges with). */
export function ringNeedle(t: TameView, serverTime: number): number {
  return ringAngle(t.speed, serverTime - t.start);
}
