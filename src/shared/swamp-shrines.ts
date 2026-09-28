import { createRng } from './rng';
import { depthAt, SWIM_MAX_DEPTH } from './coast';
import { wildFrog } from './frog';
import { LAGUNA, swampFeatures, WATER_LEVEL, type Mound, type Terrain } from './terrain';
import type { Crag } from './crags';
import type { Shrine } from './shrines';

/** The swamp's three shrines (spec S3 §6.1): ids follow the coast's 3–5. */
export const SWAMP_SHRINE = {
  firstId: 6,
  /** Candiles: braziers this far from the gate (a triangle of ~12 m sides); each stays lit this long. */
  brazierR: 7,
  litFor: 12,
  /** The torch post stands this far from the orb. */
  postGap: 2.5,
  /** Nenúfares: pads from the shore to a low stone platform ~30 m out; they sink a while after someone stands on them. */
  pads: 7,
  padR: 1.1,
  padTop: 0.15,
  sinkAfter: 1.5,
  downFor: 4,
  platformR: 3,
  platformTop: 1,
  reachOut: 33,
  padId: 1200,
  platformId: 1007,
} as const;

/** Amber trees (spec S3 §6.2): per player, 2 ámbar each, regrow in 2 days; 2 stand on stumps only the frog reaches. */
export const AMBER = { trees: 6, high: 2, stumpH: 6, stumpR: 1.6, reach: 2.5, yield: 2, regrowDays: 2, orb: 1, stumpId: 1100 } as const;

export interface AmberTree {
  id: number;
  x: number;
  z: number;
  /** Where the amber hangs from: the ground, or the stump's top. */
  y: number;
  stump: Crag | null;
}

const dry = (t: Terrain, x: number, z: number) => t.heightAt(x, z) >= WATER_LEVEL + 0.2;
const inMound = (m: Mound, p: { x: number; z: number }) => Math.hypot(m.x - p.x, m.z - p.z) < m.r;

/** Which montículos the frog, Candiles and Turba use (amber trees keep off them). */
export function claimedMounds(t: Terrain, seed: number): { frog: number; candles: number; peat: number; mounds: Mound[] } {
  const { mounds } = swampFeatures(seed);
  const frog = mounds.findIndex((m) => inMound(m, wildFrog(t, seed)));
  let candles = -1;
  let best = -1;
  mounds.forEach((m, i) => {
    if (i === frog) return;
    const fits = braziers(m, SWAMP_SHRINE.brazierR, 0).every((p) => dry(t, p.x, p.z));
    const score = (fits ? 100 : 0) + m.r;
    if (score > best) [best, candles] = [score, i];
  });
  let peat = -1;
  let near = Infinity;
  mounds.forEach((m, i) => {
    const d = Math.hypot(m.x - LAGUNA.x, m.z - LAGUNA.z);
    if (i !== frog && i !== candles && dry(t, m.x, m.z) && d < near) [near, peat] = [d, i];
  });
  return { frog, candles, peat, mounds };
}

function braziers(m: { x: number; z: number }, r: number, spin: number): { x: number; z: number }[] {
  return [0, 1, 2].map((i) => ({ x: m.x + Math.sin(spin + (i * Math.PI * 2) / 3) * r, z: m.z + Math.cos(spin + (i * Math.PI * 2) / 3) * r }));
}

function shrine(t: Terrain, id: number, kind: Shrine['kind'], x: number, z: number, parts: { x: number; z: number }[]): Shrine {
  const y = t.heightAt(x, z);
  return { id, kind, x, z, y, orb: { x, y: y + 1.2, z }, parts, pillar: null };
}

/** Candiles on the widest free montículo, Nenúfares out on the Laguna's west half, Turba on the montículo nearest the Laguna. */
export function generateSwampShrines(t: Terrain, seed: number): Shrine[] {
  const rng = createRng(seed ^ 0x5a4b);
  const S = SWAMP_SHRINE;
  const { candles: ci, peat: pi, mounds } = claimedMounds(t, seed);
  const cm = mounds[ci]!;
  const spin = rng() * Math.PI * 2;
  let r: number = S.brazierR;
  while (r > 5.8 && !braziers(cm, r, spin).every((p) => dry(t, p.x, p.z))) r -= 0.2;
  const post = { x: cm.x + Math.sin(spin + Math.PI / 3) * S.postGap, z: cm.z + Math.cos(spin + Math.PI / 3) * S.postGap };
  const candles = shrine(t, 6, 'candles', cm.x, cm.z, [...braziers(cm, r, spin), post]);

  let lilies: Shrine | null = null;
  for (let tries = 0; tries < 60 && !lilies; tries++) lilies = lilyLayout(t, (rng() - 0.5) * 1.0);
  // ponytail: the Laguna is the same ellipse for every seed; straight west always fits.
  lilies ??= lilyLayout(t, 0, true)!;

  const pm = mounds[pi]!;
  const peat = shrine(t, 8, 'peat', pm.x, pm.z, []);
  return [candles, lilies, peat];
}

/** Along a ray from the Laguna's centre (angle 0 = due west): the shore, 7 pads, the platform. */
function lilyLayout(t: Terrain, ang: number, force = false): Shrine | null {
  const S = SWAMP_SHRINE;
  const dx = -Math.cos(ang);
  const dz = Math.sin(ang);
  const R = 1 / Math.hypot(dx / LAGUNA.rx, dz / LAGUNA.rz);
  const at = (d: number) => ({ x: LAGUNA.x + dx * d, z: LAGUNA.z + dz * d });
  const shore = 0.96 * R;
  const centre = shore - S.reachOut;
  const lastD = centre + S.platformR + 1.5;
  const step = (shore - lastD) / (S.pads - 1);
  const pads = Array.from({ length: S.pads }, (_, i) => at(shore - i * step));
  const c = at(centre);
  const deep = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([ox, oz]) => depthAt(t, c.x + ox! * S.platformR, c.z + oz! * S.platformR) > SWIM_MAX_DEPTH + 0.5);
  if (!force && (!deep || centre < 12 || step > 5 || pads.some((p) => depthAt(t, p.x, p.z) <= 0))) return null;
  const top = WATER_LEVEL + S.platformTop;
  const pillar: Crag = { id: S.platformId, x: c.x, z: c.z, r: S.platformR, base: t.heightAt(c.x, c.z) - 0.5, top, bare: true };
  return { id: 7, kind: 'lilies', x: c.x, z: c.z, y: top, orb: { x: c.x, y: top + 1, z: c.z }, parts: pads, pillar };
}

/** Pads still afloat, as bare discs you can stand on (not climb). */
export function lilyPadCrags(s: Shrine, up: readonly boolean[]): Crag[] {
  const S = SWAMP_SHRINE;
  return s.parts.flatMap((p, i) => (up[i] ? [{ id: S.padId + i, x: p.x, z: p.z, r: S.padR, base: WATER_LEVEL - 1, top: WATER_LEVEL + S.padTop, bare: true }] : []));
}

/** 6 trees on free montículos (seeded order); the first 2 stand on a bare stump 6 m tall. */
export function generateAmberTrees(t: Terrain, seed: number): AmberTree[] {
  const rng = createRng(seed ^ 0xa3be7);
  const { frog, candles, peat, mounds } = claimedMounds(t, seed);
  const free = mounds.map((_, i) => i).filter((i) => i !== frog && i !== candles && i !== peat && dry(t, mounds[i]!.x, mounds[i]!.z));
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [free[i], free[j]] = [free[j]!, free[i]!];
  }
  // ponytail: 12 mounds minus 3 leaves 9; a seed where fewer than 6 are dry would get fewer trees (never seen in tests).
  return free.slice(0, AMBER.trees).map((mi, id) => {
    const m = mounds[mi]!;
    const g = t.heightAt(m.x, m.z);
    const stump: Crag | null = id < AMBER.high ? { id: AMBER.stumpId + id, x: m.x, z: m.z, r: AMBER.stumpR, base: g - 0.5, top: g + AMBER.stumpH, bare: true } : null;
    return { id, x: m.x, z: m.z, y: stump ? stump.top : g, stump };
  });
}
