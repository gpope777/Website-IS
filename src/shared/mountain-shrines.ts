import { createRng } from './rng';
import { slopeAt, smoothAt } from './mountains';
import { CHUTE, HALF, inMountains, mountainFeatures, type Pared, type Terrain } from './terrain';
import type { Crag } from './crags';
import type { Shrine } from './shrines';

/** The mountains' three shrines (spec S4 §5.1): ids follow the swamp's 6–8. */
export const MOUNTAIN_SHRINE = {
  firstId: 9,
  /** Cornisa: 2 bare resting ledges up the face; each a third of the way (≤ 7 m, one frog jump). */
  ledgeR: 1.4,
  ledgeId: 1300,
  frogRise: 7,
  /** Losas gemelas: plates this far apart; both held opens the gate this long; the boulder rolls home after `boulderBack` s. */
  plateGap: 14,
  twinsOpen: 20,
  boulderBack: 60,
  boulderUp: 4,
  /** Bloques: the reset lever is part 7. */
  lever: 7,
} as const;

/** Bloques (spec S4 §5.1): a 6 × 6 grid of 2 m cells, 3 blocks, 3 marked cells. Handmade layout; 8 pushes solve it. */
export const BLOCKS = {
  cell: 2,
  n: 6,
  starts: [[1, 1], [3, 1], [1, 3]] as const,
  cells: [[3, 3], [4, 2], [2, 4]] as const,
} as const;

export type Cell = readonly [number, number];

/** One solution (block index, direction in grid cells: [+col = +x, +row = +z]). */
export const BLOCKS_SOLUTION: readonly { i: number; dir: Cell }[] = [
  { i: 1, dir: [1, 0] },
  { i: 1, dir: [0, 1] },
  { i: 2, dir: [1, 0] },
  { i: 2, dir: [0, 1] },
  { i: 0, dir: [0, 1] },
  { i: 0, dir: [1, 0] },
  { i: 0, dir: [1, 0] },
  { i: 0, dir: [0, 1] },
];

/** Push block i one cell along dir; null if it would leave the n × n grid or hit another block. */
export function pushBlock(blocks: readonly Cell[], i: number, dir: Cell, n: number = BLOCKS.n): [number, number][] | null {
  const b = blocks[i];
  if (!b) return null;
  const to: [number, number] = [b[0] + dir[0], b[1] + dir[1]];
  if (to[0] < 0 || to[1] < 0 || to[0] >= n || to[1] >= n) return null;
  if (blocks.some((o, j) => j !== i && o[0] === to[0] && o[1] === to[1])) return null;
  return blocks.map((o, j) => (j === i ? to : [o[0], o[1]]));
}

/** Every marked cell holds a block. */
export function blocksSolved(blocks: readonly Cell[], cells: readonly Cell[] = BLOCKS.cells): boolean {
  return cells.every((c) => blocks.some((b) => b[0] === c[0] && b[1] === c[1]));
}

/** World centre of a grid cell (the grid is centred on the shrine). */
export function blockCell(s: { x: number; z: number }, c: Cell): { x: number; z: number } {
  const o = ((BLOCKS.n - 1) * BLOCKS.cell) / 2;
  return { x: s.x - o + c[0] * BLOCKS.cell, z: s.z - o + c[1] * BLOCKS.cell };
}

/** Quartz (spec S4 §5.2): 10 veins up the paredes' faces; per player, 2 cuarzo each, back in 2 days. Mountain orbs give 1. */
export const QUARTZ = { veins: 10, reach: 2, below: 1.5, yield: 2, regrowDays: 2, orb: 1, minUp: 8, maxUp: 20 } as const;

export interface QuartzVein {
  id: number;
  x: number;
  y: number;
  z: number;
}

/** Terrain height along a pared's radius in direction a. */
const radial = (t: Terrain, p: Pared, a: number, r: number) => {
  const x = p.x + Math.sin(a) * r;
  const z = p.z + Math.cos(a) * r;
  return { x, z, h: t.heightAt(x, z) };
};
const footOf = (t: Terrain, p: Pared, a: number) => radial(t, p, a, p.rt + p.w + 1).h;
const topOf = (t: Terrain, p: Pared, a: number) => radial(t, p, a, p.rt - 0.5).h;
/** The first point outward from the top where the ground drops to `h` (on the face). */
function faceAt(t: Terrain, p: Pared, a: number, h: number): { x: number; z: number; h: number } {
  for (let r = p.rt; r <= p.rt + p.w + 1; r += 0.1) {
    const q = radial(t, p, a, r);
    if (q.h <= h) return q;
  }
  return radial(t, p, a, p.rt + p.w);
}

/** Gentle ground: every point inside the mountains, not smooth, not on a pared or the chute, slope under `deg`. */
function gentle(t: Terrain, pts: readonly { x: number; z: number }[], deg: number, paredes: readonly Pared[]): boolean {
  return pts.every(
    (q) =>
      inMountains(q.x, q.z) &&
      !smoothAt(q.x, q.z) &&
      Math.abs(q.x) > CHUTE.half + CHUTE.blend + 2 &&
      Math.abs(q.x) < HALF - 30 &&
      slopeAt(t, q.x, q.z) < deg &&
      !paredes.some((p) => Math.hypot(p.x - q.x, p.z - q.z) < p.rt + p.w + 3),
  );
}

/** Search a band for a spot whose points (from `pts`) are all gentle; falls back to the flattest centre seen. */
function findSpot(t: Terrain, rng: () => number, d0: number, d1: number, deg: number, paredes: readonly Pared[], pts: (x: number, z: number) => { x: number; z: number }[], avoid: readonly { x: number; z: number }[] = []): { x: number; z: number } {
  let best = { x: 60, z: -HALF - (d0 + d1) / 2 };
  let bestS = Infinity;
  for (let tries = 0; tries < 3000; tries++) {
    const x = (rng() - 0.5) * 2 * (HALF - 50);
    const z = -HALF - (d0 + rng() * (d1 - d0));
    if (avoid.some((o) => Math.hypot(o.x - x, o.z - z) < 30)) continue;
    const ps = pts(x, z);
    if (gentle(t, ps, deg, paredes)) return { x, z };
    const s = Math.max(...ps.map((q) => slopeAt(t, q.x, q.z)));
    if (s < bestS && ps.every((q) => inMountains(q.x, q.z))) [bestS, best] = [s, { x, z }];
  }
  // ponytail: never seen in tests (the Faldas have ≥ 85 % gentle ground); a steep shrine beats a missing one.
  return best;
}

/** The Cornisa's pared (the tallest whose face a frog climbs in 3 jumps) and the face direction (toward the forest). */
function cornicePared(t: Terrain, seed: number): { p: Pared; a: number; foot: number; top: number } {
  const { paredes } = mountainFeatures(seed);
  const a = 0; // facing +z: the side players come from
  const all = paredes.map((p) => ({ p, a, foot: footOf(t, p, a), top: topOf(t, p, a) }));
  const fits = all.filter((c) => c.top - c.foot <= 3 * MOUNTAIN_SHRINE.frogRise && c.top - c.foot >= 12);
  const pool = fits.length ? fits : all;
  return pool.reduce((b, c) => (c.top - c.foot > b.top - b.foot ? c : b));
}

/** Cornisa's 2 resting ledges: bare discs against the face at a third and two thirds of its height. */
export function corniceLedges(t: Terrain, seed: number): Crag[] {
  const { p, a, foot, top } = cornicePared(t, seed);
  const S = MOUNTAIN_SHRINE;
  return [1, 2].map((k) => {
    const h = foot + ((top - foot) * k) / 3;
    const f = faceAt(t, p, a, h - 1);
    const x = f.x + Math.sin(a) * S.ledgeR * 0.6;
    const z = f.z + Math.cos(a) * S.ledgeR * 0.6;
    return { id: S.ledgeId + k - 1, x, z, r: S.ledgeR, base: Math.min(t.heightAt(x, z), f.h) - 0.5, top: h, bare: true };
  });
}

function shrine(t: Terrain, id: number, kind: Shrine['kind'], x: number, z: number, parts: { x: number; z: number }[]): Shrine {
  const y = t.heightAt(x, z);
  return { id, kind, x, z, y, orb: { x, y: y + 1.2, z }, parts, pillar: null };
}

/** Cornisa on the tallest frog-sized pared, Losas gemelas on gentle Faldas, Bloques on a flat spot high in the Faldas. */
export function generateMountainShrines(t: Terrain, seed: number): Shrine[] {
  const rng = createRng(seed ^ 0x6d7c);
  const S = MOUNTAIN_SHRINE;
  const { paredes } = mountainFeatures(seed);
  const c = cornicePared(t, seed);
  const edge = radial(t, c.p, c.a, c.p.rt - 0.5);
  const cornice: Shrine = { id: 9, kind: 'cornice', x: edge.x, z: edge.z, y: edge.h, orb: { x: edge.x, y: edge.h + 1.2, z: edge.z }, parts: [], pillar: null };

  const half = S.plateGap / 2;
  const twinPts = (x: number, z: number) => [{ x, z }, { x: x - half, z }, { x: x + half, z }, { x: x + half, z: z - S.boulderUp }];
  const tw = findSpot(t, rng, 50, 100, 20, paredes, twinPts, [cornice]);
  const twins = shrine(t, 10, 'twins', tw.x, tw.z, [{ x: tw.x - half, z: tw.z }, { x: tw.x + half, z: tw.z }, { x: tw.x + half, z: tw.z - S.boulderUp }]);

  const o = ((BLOCKS.n - 1) * BLOCKS.cell) / 2 + 1;
  const gridPts = (x: number, z: number) => [{ x, z }, { x: x - o, z: z - o }, { x: x + o, z: z - o }, { x: x - o, z: z + o }, { x: x + o, z: z + o }, { x: x + o + 2, z }, { x, z: z - o - 1.5 }];
  const bl = findSpot(t, rng, 95, 125, 25, paredes, gridPts, [cornice, twins]);
  const cells = [...BLOCKS.starts, ...BLOCKS.cells].map((q) => blockCell(bl, q));
  const blocks = shrine(t, 11, 'blocks', bl.x, bl.z - o - 1.5, [...cells, { x: bl.x + o + 2, z: bl.z }]);
  blocks.orb = { x: bl.x, y: t.heightAt(bl.x, bl.z - o - 1.5) + 1.2, z: bl.z - o - 1.5 };
  return [cornice, twins, blocks];
}

/** Bloques' grid centre (the shrine's orb stands just north of it). */
export function blocksCentre(s: Shrine): { x: number; z: number } {
  const o = ((BLOCKS.n - 1) * BLOCKS.cell) / 2 + 1;
  return { x: s.x, z: s.z + o + 1.5 };
}

/** 10 veins: one on each pared's face (seeded side), the 10th on the first pared's other side; 8–20 m over the foot. */
export function generateQuartzVeins(t: Terrain, seed: number): QuartzVein[] {
  const rng = createRng(seed ^ 0x9a42);
  const { paredes } = mountainFeatures(seed);
  const out: QuartzVein[] = [];
  const angles: number[] = [];
  for (let i = 0; out.length < QUARTZ.veins; i++) {
    const p = paredes[i % paredes.length]!;
    const a = i < paredes.length ? rng() * Math.PI * 2 : angles[i - paredes.length]! + Math.PI;
    angles.push(a);
    const foot = footOf(t, p, a);
    const height = topOf(t, p, a) - foot;
    const hi = Math.min(QUARTZ.maxUp, height * 0.75);
    const up = hi > QUARTZ.minUp ? QUARTZ.minUp + rng() * (hi - QUARTZ.minUp) : QUARTZ.minUp;
    const f = faceAt(t, p, a, foot + up);
    out.push({ id: out.length, x: f.x, y: f.h, z: f.z });
  }
  return out;
}

/** 2 refugios (spec S4 §9.2): one in the lower Faldas, one high up near the Cumbre. */
export function generateRefugios(t: Terrain, seed: number): { x: number; z: number; y: number }[] {
  const rng = createRng(seed ^ 0x2ef0);
  const { paredes } = mountainFeatures(seed);
  const ring = (x: number, z: number) => [{ x, z }, { x: x + 2, z }, { x: x - 2, z }, { x, z: z + 2 }, { x, z: z - 2 }];
  const shrines = generateMountainShrines(t, seed);
  const low = findSpot(t, rng, 45, 80, 20, paredes, ring, shrines);
  const high = findSpot(t, rng, 112, 140, 25, paredes, ring, [...shrines, blocksCentre(shrines[2]!)]);
  return [low, high].map((q) => ({ x: q.x, z: q.z, y: t.heightAt(q.x, q.z) }));
}
