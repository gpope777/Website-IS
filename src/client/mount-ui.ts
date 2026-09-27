import { MOUNT, ringAngle } from '../shared/mount';
import type { SteedView, TameView } from '../shared/protocol';

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
}

/** The contextual A / E / M action for the deer, if any. The server re-checks everything. */
export function mountAction(c: MountCtx): { act: number; label: string } | null {
  if (c.tame) return { act: 1, label: '¡Ahora!' };
  if (c.seat) return { act: 5, label: 'Bajar' };
  if (c.riding) return { act: 3, label: 'Bajar del ciervo' };
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
