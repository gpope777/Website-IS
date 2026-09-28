import { NAMES } from '../shared/names';
import { QUARTZ, type QuartzVein } from '../shared/mountain-shrines';

/** A quartz vein within reach and not regrowing for you (you have to be up beside it). The server re-checks. */
export function quartzAction(pos: { x: number; y: number; z: number }, veins: readonly QuartzVein[], regrowing: readonly number[]): { t: 'quartz'; id: number; label: string } | null {
  const v = veins.find((q) => !regrowing.includes(q.id) && Math.hypot(q.x - pos.x, q.z - pos.z) <= QUARTZ.reach && pos.y >= q.y - QUARTZ.below);
  return v ? { t: 'quartz', id: v.id, label: `Picar ${NAMES.quartz}` } : null;
}
