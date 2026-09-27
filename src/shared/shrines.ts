import { createRng } from './rng';
import { inForest, WATER_LEVEL, type Terrain } from './terrain';
import type { Crag } from './crags';

export type ShrineKind = 'levers' | 'plate' | 'ledge' | 'tide' | 'sunken' | 'fan';
/** The forest's three (coast shrines come from coast-shrines.ts). */
export const SHRINE_KINDS: readonly ShrineKind[] = ['levers', 'plate', 'ledge'];
export const SHRINE_LABELS: Record<ShrineKind, string> = {
  levers: 'Santuario de las Palancas',
  plate: 'Santuario de la Losa',
  ledge: 'Santuario de la Roca Lisa',
  tide: 'Santuario de la Marea',
  sunken: 'Santuario Hundido',
  fan: 'Santuario del Islote',
};

export const SHRINE = {
  minDist: 70,
  maxDist: 150,
  cragClear: 14,
  orbReach: 2,
  partReach: 2.5,
  /** Each lever sits this far to one side of the orb. */
  leverGap: 10,
  leverWindow: 6,
  openFor: 30,
  plateDist: 14,
  plateRadius: 1.3,
  plateHold: 3.5,
  pillarR: 2.2,
  pillarH: 10,
  pillarId: 1000,
} as const;

export interface Shrine {
  id: number;
  kind: ShrineKind;
  x: number;
  z: number;
  /** Ground height at the centre. */
  y: number;
  orb: { x: number; y: number; z: number };
  /** Levers (2), the plate (1); coast: tide = [plate, pumice start], sunken = [beach lever, seabed lever], fan = 3 wheels. */
  parts: { x: number; z: number }[];
  /** The bare rock of the ledge shrine. */
  pillar: Crag | null;
}

/**
 * One shrine per kind, a third of a circle apart around spawn. Derived from the seed so
 * client and server agree without traffic (like crags).
 */
export function generateShrines(terrain: Terrain, seed: number, crags: readonly Crag[]): Shrine[] {
  const rng = createRng(seed ^ 0x5a17c0de);
  const base = rng() * Math.PI * 2;
  return SHRINE_KINDS.map((kind, id) => {
    const home = base + (id * Math.PI * 2) / 3;
    for (let tries = 0; tries < 80; tries++) {
      const ang = home + (rng() - 0.5) * 1.4;
      const d = SHRINE.minDist + rng() * (SHRINE.maxDist - SHRINE.minDist);
      const s = layout(terrain, id, kind, Math.sin(ang) * d, Math.cos(ang) * d, ang);
      if (fits(terrain, crags, s)) return s;
    }
    // ponytail: never seen in tests; a wet shrine is better than a missing one.
    return layout(terrain, id, kind, Math.sin(home) * SHRINE.minDist, Math.cos(home) * SHRINE.minDist, home);
  });
}

function layout(terrain: Terrain, id: number, kind: ShrineKind, x: number, z: number, ang: number): Shrine {
  const y = terrain.heightAt(x, z);
  const sx = Math.cos(ang); // sideways, across the approach from spawn
  const sz = -Math.sin(ang);
  const s: Shrine = { id, kind, x, z, y, orb: { x, y: y + 1.2, z }, parts: [], pillar: null };
  if (kind === 'levers') s.parts = [{ x: x + sx * SHRINE.leverGap, z: z + sz * SHRINE.leverGap }, { x: x - sx * SHRINE.leverGap, z: z - sz * SHRINE.leverGap }];
  if (kind === 'plate') s.parts = [{ x: x + sx * SHRINE.plateDist, z: z + sz * SHRINE.plateDist }];
  if (kind === 'ledge') {
    const r = SHRINE.pillarR;
    let lo = Infinity;
    let hi = -Infinity;
    for (const [ox, oz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]] as const) {
      const h = terrain.heightAt(x + ox, z + oz);
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
    const top = hi + SHRINE.pillarH;
    s.pillar = { id: SHRINE.pillarId + id, x, z, r, base: lo - 0.5, top, bare: true };
    s.orb = { x, y: top + 1, z };
  }
  return s;
}

function fits(terrain: Terrain, crags: readonly Crag[], s: Shrine): boolean {
  const pts = [s, ...s.parts];
  if (s.pillar) for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) pts.push({ x: s.x + ox * s.pillar.r, z: s.z + oz * s.pillar.r } as Shrine);
  for (const p of pts) {
    if (!inForest(p.x, p.z, 20)) return false;
    if (terrain.heightAt(p.x, p.z) < WATER_LEVEL + 0.3) return false;
  }
  return !crags.some((c) => Math.hypot(c.x - s.x, c.z - s.z) < SHRINE.cragClear);
}
