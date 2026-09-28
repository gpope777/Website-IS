import { CAPA } from '../shared/items';
import { FOGATA } from '../shared/fogatas';
import { NAMES, qty } from '../shared/names';
import { AMBER, type AmberTree } from '../shared/swamp-shrines';
import { THORNS } from './coast-ui';
import type { CallBeast } from '../shared/protocol';
import { HEART } from '../shared/sim/world-sim';

export interface SwampCtx {
  pos: { x: number; y: number; z: number };
  trees: readonly AmberTree[];
  /** Tree ids still regrowing for you. */
  regrowing: readonly number[];
  heart: { x: number; z: number } | null;
  amber: number;
  capa: number;
  /** Black thorns carried (Capa 4, S5-B). */
  thorn?: number;
}

const c = CAPA.cost;
const CAPA_LABEL = `${NAMES.capa} (${qty(c.amber, 'amber')}, ${qty(c.wood, 'wood')}, ${qty(c.berries, 'berries')})`;
const ct = CAPA.costTop;
const CAPA_TOP = `${NAMES.capa} (${qty(ct.thorn, 'thorn')}, ${qty(ct.amber, 'amber')})`;

/** A ripe amber tree within reach (on top of its stump for the high ones), else a Capa level at the Heart. The server re-checks. */
export function swampAction(x: SwampCtx): { t: 'amber'; id: number; label: string } | { t: 'capa'; label: string } | null {
  const p = x.pos;
  const tree = x.trees.find((t) => !x.regrowing.includes(t.id) && Math.hypot(t.x - p.x, t.z - p.z) <= AMBER.reach && p.y >= t.y - 1);
  if (tree) return { t: 'amber', id: tree.id, label: `Recoger ${NAMES.amber}` };
  const h = x.heart;
  if (!h || Math.hypot(h.x - p.x, h.z - p.z) > HEART.tendReach) return null;
  if (x.amber >= c.amber && x.capa < CAPA.amberMax) return { t: 'capa', label: CAPA_LABEL };
  if ((x.thorn ?? 0) >= ct.thorn && x.amber >= ct.amber && x.capa >= CAPA.amberMax && x.capa < CAPA.max) return { t: 'capa', label: CAPA_TOP };
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

/** Mounts you can call from the Menú: only beside the lit Ceniza fogata (any lit one with Silbido, P4-B), only the ones you own (S5-B). The server re-checks. */
export function fogataCalls(pos: { x: number; z: number }, spots: readonly { id: number; x: number; z: number }[], lit: readonly boolean[], owned: { deer: boolean; frog: boolean; fish: boolean }, silbido = false): CallBeast[] {
  const f = spots.find((s) => (silbido ? lit[s.id] && Math.hypot(s.x - pos.x, s.z - pos.z) <= FOGATA.reach : s.id === FOGATA.ceniza));
  if (!f || !lit[f.id] || Math.hypot(f.x - pos.x, f.z - pos.z) > FOGATA.reach) return [];
  return (['deer', 'frog', 'fish'] as const).filter((b) => owned[b]);
}

export const CALL_LABEL: Record<CallBeast, string> = { deer: 'Llamar al ciervo', frog: 'Llamar a la rana', fish: `Llamar al pez (a ${NAMES.blackLake})` };
/** P7-E: la Estrella answers to her own name. */
export function callLabel(beast: CallBeast, star: boolean): string {
  return beast === 'deer' && star ? `Llamar a ${NAMES.legendary}` : CALL_LABEL[beast];
}
