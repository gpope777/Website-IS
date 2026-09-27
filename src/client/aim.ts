import { inCone } from '../shared/sim/combat';

export interface AimTarget { id: number; x: number; z: number }
export const LOCK = { range: 15, keep: 20, cone: Math.PI / 2 } as const;

export function yawTo(x: number, z: number, tx: number, tz: number): number {
  return Math.atan2(tx - x, tz - z);
}

/** Soft auto-aim: the closest target, weighted by how far off-centre it is. */
export function pickTarget(x: number, z: number, yaw: number, targets: readonly AimTarget[], range: number, cone: number): number | null {
  let best: number | null = null;
  let bestScore = Infinity;
  for (const t of targets) {
    const d = Math.hypot(t.x - x, t.z - z);
    if (d > range || !inCone(x, z, yaw, t.x, t.z, cone)) continue;
    const a = yawTo(x, z, t.x, t.z) - yaw;
    const off = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    const score = d * (1 + off);
    if (score < bestScore) {
      bestScore = score;
      best = t.id;
    }
  }
  return best;
}

export function keepLock(id: number, x: number, z: number, targets: readonly AimTarget[]): boolean {
  const t = targets.find((o) => o.id === id);
  return !!t && Math.hypot(t.x - x, t.z - z) <= LOCK.keep;
}
