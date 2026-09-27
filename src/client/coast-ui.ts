import { CHEST, type Chest } from '../shared/coast-shrines';
import { UPGRADE } from '../shared/items';
import { NAMES } from '../shared/names';
import type { CageView, ShrineView } from '../shared/protocol';
import { RESCUE } from '../shared/rescue';
import { SHRINE, type Shrine } from '../shared/shrines';
import { HEART } from '../shared/sim/world-sim';

export interface CoastCtx {
  pos: { x: number; y: number; z: number };
  chests: readonly Chest[];
  opened: readonly number[];
  heart: { x: number; z: number } | null;
  pearls: number;
  weapon: number;
}

const c = UPGRADE.cost;
const UPGRADE_LABEL = `Mejorar el arma (${c.pearl} ${NAMES.pearl}s, ${c.stone} piedra, ${c.wood} madera)`;

/** A sunken chest within reach (diving), else the weapon upgrade at the Heart. The server re-checks. */
export function coastAction(x: CoastCtx): { t: 'chest'; id: number; label: string } | { t: 'upgrade'; label: string } | null {
  const p = x.pos;
  const ch = x.chests.find((k) => !x.opened.includes(k.id) && Math.hypot(k.x - p.x, k.z - p.z) <= CHEST.reach && p.y <= k.y + CHEST.above);
  if (ch) return { t: 'chest', id: ch.id, label: 'Abrir el cofre' };
  const h = x.heart;
  if (h && x.pearls >= c.pearl && x.weapon < UPGRADE.pearlMax && Math.hypot(h.x - p.x, h.z - p.z) <= HEART.tendReach) return { t: 'upgrade', label: UPGRADE_LABEL };
  return null;
}

/** The root cage within reach while the Tragón is taken: free it, or hear how many anchors still hold. The server re-checks. */
export function rescueAction(pos: { x: number; z: number }, cage: { x: number; z: number }, view: CageView | null): { label: string } | null {
  if (!view || Math.hypot(cage.x - pos.x, cage.z - pos.z) > RESCUE.freeReach) return null;
  const left = view.anchors.filter((hp) => hp > 0).length;
  if (!left) return { label: `Liberar al ${NAMES.bossForestShort}` };
  return { label: `La jaula aguanta: ${left === 1 ? 'queda 1 ancla' : `quedan ${left} anclas`}` };
}

/** Lever, wheel or pumice block within reach (part ≥ 1), or an orb you have not taken yet (part 0). */
export function shrinePartAt(
  shrines: readonly Shrine[],
  views: readonly ShrineView[],
  cleared: readonly number[],
  b: { x: number; y: number; z: number },
  me: string,
  torch = false,
): { id: number; part: number; open: boolean; label: string } | null {
  for (const s of shrines) {
    const v = views.find((w) => w.id === s.id);
    const open = v?.open ?? false;
    if (s.kind === 'candles') {
      const i = s.parts.findIndex((p) => Math.hypot(p.x - b.x, p.z - b.z) <= SHRINE.partReach);
      if (i === 3) return { id: s.id, part: 4, open, label: 'Coger una antorcha' };
      if (i >= 0) return { id: s.id, part: i + 1, open, label: torch ? 'Encender el brasero' : 'Hace falta fuego' };
    }
    if (s.kind === 'tide' && v?.block) {
      const k = v.block;
      if (k.held === me) return { id: s.id, part: 1, open, label: 'Soltar la piedra pómez' };
      if (!k.held && Math.hypot(k.x - b.x, k.z - b.z) <= SHRINE.partReach) return { id: s.id, part: 1, open, label: 'Coger la piedra pómez' };
    }
    if (s.kind === 'levers' || s.kind === 'sunken' || s.kind === 'fan') {
      const i = s.parts.findIndex((p) => Math.hypot(p.x - b.x, p.z - b.z) <= SHRINE.partReach);
      if (i >= 0) return { id: s.id, part: i + 1, open, label: s.kind === 'fan' ? 'Girar la rueda' : 'Tirar de la palanca' };
    }
    if (cleared.includes(s.id)) continue;
    const reach = s.pillar ? s.pillar.r : SHRINE.orbReach;
    if (Math.hypot(s.orb.x - b.x, s.orb.z - b.z) <= reach && b.y >= s.orb.y - 2.5) return { id: s.id, part: 0, open, label: open ? 'Tomar el orbe' : s.kind === 'peat' ? 'Raíces de turba. Solo arden' : 'La verja está cerrada' };
  }
  return null;
}
