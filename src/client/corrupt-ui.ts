import { PILLAR, type PillarSites } from '../shared/pillars';
import type { PillarView } from '../shared/protocol';

/** A standing Pilar-raíz core within reach: A pulls it (the server checks what still holds it). */
export function pillarAction(pos: { x: number; z: number }, sites: PillarSites, view: PillarView | null): { id: number; label: string } | null {
  if (!view) return null;
  const id = sites.cores.findIndex((c, i) => !view.broken[i] && !(i === 1 && view.anchor) && Math.hypot(c.x - pos.x, c.z - pos.z) <= PILLAR.reach);
  return id < 0 ? null : { id, label: 'Arrancar el núcleo' };
}
