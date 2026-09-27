import { CAPA } from '../shared/items';
import { FOGATA } from '../shared/fogatas';
import { NAMES } from '../shared/names';
import { AMBER, type AmberTree } from '../shared/swamp-shrines';
import { HEART } from '../shared/sim/world-sim';

export interface SwampCtx {
  pos: { x: number; y: number; z: number };
  trees: readonly AmberTree[];
  /** Tree ids still regrowing for you. */
  regrowing: readonly number[];
  heart: { x: number; z: number } | null;
  amber: number;
  capa: number;
}

const c = CAPA.cost;
const CAPA_LABEL = `${NAMES.capa} (${c.amber} ${NAMES.amber}, ${c.wood} madera, ${c.berries} bayas)`;

/** A ripe amber tree within reach (on top of its stump for the high ones), else a Capa level at the Heart. The server re-checks. */
export function swampAction(x: SwampCtx): { t: 'amber'; id: number; label: string } | { t: 'capa'; label: string } | null {
  const p = x.pos;
  const tree = x.trees.find((t) => !x.regrowing.includes(t.id) && Math.hypot(t.x - p.x, t.z - p.z) <= AMBER.reach && p.y >= t.y - 1);
  if (tree) return { t: 'amber', id: tree.id, label: `Recoger ${NAMES.amber}` };
  const h = x.heart;
  if (h && x.amber >= c.amber && x.capa < CAPA.max && Math.hypot(h.x - p.x, h.z - p.z) <= HEART.tendReach) return { t: 'capa', label: CAPA_LABEL };
  return null;
}

/** A fogata within reach: light it with the torch, or (lit) go back to the Heart. Unlit without a torch: a hint only. */
export function fogataAction(pos: { x: number; z: number }, spots: readonly { id: number; x: number; z: number; refugio?: boolean }[], lit: readonly boolean[], torch: boolean):
  | { t: 'fogata'; id: number; label: string }
  | { t: 'travel'; to: 'heart'; label: string }
  | { t: 'hint'; label: string }
  | null {
  const f = spots.find((s) => Math.hypot(s.x - pos.x, s.z - pos.z) <= FOGATA.reach);
  if (!f) return null;
  if (lit[f.id]) return { t: 'travel', to: 'heart', label: `Volver al ${NAMES.heart}` };
  return torch ? { t: 'fogata', id: f.id, label: f.refugio ? `Encender el ${NAMES.refugio}` : `Encender la ${NAMES.fogata}` } : { t: 'hint', label: 'Hace falta fuego' };
}

/** Lit fogata ids the Heart's Menú offers (only standing at the Heart). */
export function fogataTargets(lit: readonly boolean[], atHeart: boolean): number[] {
  return atHeart ? lit.flatMap((on, i) => (on ? [i] : [])) : [];
}
