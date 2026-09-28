import { Noise2D } from './noise';
import { createRng } from './rng';

export const WORLD_SIZE = 480; // metres, square (the forest)
export const HALF = WORLD_SIZE / 2;
export const WATER_LEVEL = -3.2;
/** The forest's own heightmap ends here; the next 20 m blend into the coast. */
export const COAST_Z0 = HALF - 40;
/** The coast's far edge (south rim). The map is |x| < HALF, -HALF < z < SOUTH. */
export const SOUTH = HALF + 220;
/** Coast bands, as metres south of HALF (spec §3.1). */
export const COAST = { blend: 20, mudTo: 20, beachTo: 50, shallowsTo: 90, deepFrom: 110, rimFrom: 200, mud: WATER_LEVEL + 0.3, beachTop: WATER_LEVEL + 2, shallowsBed: WATER_LEVEL - 4, seabed: WATER_LEVEL - 15, rimTop: WATER_LEVEL + 8 } as const;

/** El Pantano (Slice 3): a rectangle west of the forest and the coast (spec S3 §3.1). */
export const SWAMP = { x0: -HALF - 180, x1: -HALF, z0: 40, z1: HALF + 150, seam: 12, rim: 15, rimTop: WATER_LEVEL + 7 } as const;
/** La Boca del Río: a 16 m wide, 5 m deep channel from the coast's deep sea west into the Laguna Negra. */
export const RIVER = { z: HALF + 103, half: 8, bank: 2, x0: -HALF - 80, x1: -HALF + 30, bed: WATER_LEVEL - 5 } as const;
/** La Laguna Negra: an elliptic bowl 5–8 m deep at the swamp's south end. */
export const LAGUNA = { x: -HALF - 115, z: HALF + 100, rx: 50, rz: 35, bed: WATER_LEVEL - 5, deep: WATER_LEVEL - 8 } as const;

/** Las Montañas (Slice 4): a rectangle north of the forest; `d` = metres north of the forest's rim (spec S4 §3.1). */
export const MOUNTAINS = { x0: -HALF, x1: HALF, z0: -HALF - 220, z1: -HALF, faldas: 40, cumbre: 120, rimFrom: 200, rimTop: 90, sideRim: 20 } as const;
/** Los Peldaños: 4 terraces of +6 m; riser k (0..3) spans d ∈ [first + pitch·k, first + pitch·k + run]. */
export const PELDANOS = { steps: 4, rise: 6, run: 1.5, pitch: 10, first: 1 } as const;
/** El Pico: a flat disc (radius r) `rise` metres above the forest rim's height at its x, with a skirt. */
export const PICO = { d: 170, r: 6, skirt: 25, rise: 80 } as const;
/** The snow chute: a shallow valley |x| < half down the middle, from the Faldas' foot up. */
export const CHUTE = { half: 4, blend: 6, depth: 2 } as const;

/**
 * Las Tierras Corruptas (spec S5 §3.1): 480 × 200 m north of the mountains. d = metres north of the mountains' rim.
 * el Borde (d < rim, +90 → +20, smooth), la Ceniza (to d 80), el Espinar (to d 170), la Torre's plateau beyond.
 */
export const CORRUPT_LANDS = { x0: -HALF, x1: HALF, z0: -HALF - 420, z1: -HALF - 220, rim: 20, ceniza: 80, espinar: 170, sideRim: 15, rimTop: 90, rimFoot: 20 } as const;
/** The tower's plateau: |x| < half, d ≥ d, flat at E(0) + top. */
export const TOWER_FOOT = { half: 30, d: 170, top: 30, blend: 6 } as const;

/** el Lago Negro's basin (dry in S5-A; S5-C fills it: see `BLACK_LAKE`). */
export interface Basin {
  x: number;
  z: number;
  r: number;
  depth: number;
}

/** los Escalones rotos: 4 smooth terraces climbing north from d0, |x − x| < half, flat floor at `floor`. */
export interface Steps {
  x: number;
  d0: number;
  half: number;
  steps: number;
  rise: number;
  pitch: number;
  run: number;
  /** Absolute height of the floor before the first riser. */
  floor: number;
}

export interface Terrain {
  heightAt(x: number, z: number): number;
  /** Vegetation density 0..1: clearings vs dense groves. */
  density(x: number, z: number): number;
  /** Water surface here (S5-C: el Lago Negro sits above the sea). Absent: `WATER_LEVEL` everywhere. */
  waterAt?(x: number, z: number): number;
}

/** el Lago Negro's water (S5-C): its surface sits `dry` metres under the basin's rim level. */
export const BLACK_LAKE = { dry: 4 } as const;

/** The water surface at (x, z): the sea's level, or the Lago Negro's inside its circle. */
export function waterLevel(t: Terrain, x: number, z: number): number {
  return t.waterAt ? t.waterAt(x, z) : WATER_LEVEL;
}

export interface Islet {
  x: number;
  z: number;
  r: number;
  top: number;
}

export interface Mound {
  x: number;
  z: number;
  r: number;
  top: number;
}

/** A mountain mesa (pared): flat top of radius rt, a steep face `w` wide, `h` high. */
export interface Pared {
  x: number;
  z: number;
  rt: number;
  w: number;
  h: number;
}

/** Metres north of the forest's rim. */
export function mountainDepth(z: number): number {
  return -HALF - z;
}

/** Inside the mountains rectangle (north of the forest's rim). */
export function inMountains(x: number, z: number): boolean {
  return x > MOUNTAINS.x0 && x < MOUNTAINS.x1 && z > MOUNTAINS.z0 && z < MOUNTAINS.z1;
}

/** 9 seeded paredes in the Faldas and the Pico near x = 0. Pure seed: client and server agree. */
export function mountainFeatures(seed: number): { paredes: Pared[]; pico: { x: number; z: number } } {
  const rng = createRng(seed ^ 0x307a1);
  const pico = { x: (rng() - 0.5) * 60, z: -HALF - PICO.d };
  const paredes: Pared[] = [];
  for (let tries = 0; paredes.length < 9 && tries < 2000; tries++) {
    const h = 12 + rng() * 13;
    const angle = ((50 + rng() * 25) * Math.PI) / 180;
    const w = Math.max(8, Math.min(12, (1.5 * h) / Math.tan(angle))); // faces of 56–78°
    const rt = 3 + rng() * 3;
    const R = rt + w;
    const p: Pared = { x: (rng() - 0.5) * 2 * (HALF - 40 - R), z: -HALF - (50 + R + rng() * Math.max(0, 65 - 2 * R)), rt, w, h };
    if (Math.abs(p.x) < CHUTE.half + CHUTE.blend + 2 + R) continue;
    if (paredes.some((o) => Math.hypot(o.x - p.x, o.z - p.z) <= o.rt + o.w + R + 4)) continue;
    paredes.push(p);
  }
  // ponytail: 2000 tries always fit 9 mesas (≤ 36 m wide) in 400 × 65 m; no fallback.
  return { paredes, pico };
}

/** Metres north of the mountains' rim (the Tierras Corruptas' depth). */
export function corruptDepth(z: number): number {
  return CORRUPT_LANDS.z1 - z;
}

/** Inside the Tierras Corruptas rectangle. */
export function inCorrupt(x: number, z: number): boolean {
  return x > CORRUPT_LANDS.x0 && x < CORRUPT_LANDS.x1 && z > CORRUPT_LANDS.z0 && z < CORRUPT_LANDS.z1;
}

/** el Lago Negro (west) and los Escalones rotos (east), from the seed. `floor` is filled by createTerrain (needs E). */
export function corruptFeatures(seed: number): { lake: Basin; steps: Omit<Steps, 'floor'> } {
  const rng = createRng(seed ^ 0xc0770);
  const lakeD = 110 + rng() * 30;
  const lake = { x: -HALF + 100 + rng() * 60, z: CORRUPT_LANDS.z1 - lakeD, r: 40, depth: 14 };
  const steps = { x: 100 + rng() * 50, d0: 110 + rng() * 10, half: 15, steps: 4, rise: 6, pitch: 8, run: 1.5 };
  return { lake, steps };
}

/** Inside the swamp rectangle (west of the forest's edge). */
export function inSwamp(x: number, z: number): boolean {
  return x < SWAMP.x1 && x > SWAMP.x0 && z > SWAMP.z0 && z < SWAMP.z1;
}

/** Inside the river channel (its 16 m wide deep bed). */
export function inRiver(x: number, z: number): boolean {
  return x > RIVER.x0 && x < RIVER.x1 && Math.abs(z - RIVER.z) < RIVER.half;
}

// The swamp rectangle has no pad on its east side: it overlaps the main one by 1 m so the seam is walkable.
const swampRect = (pad: number) => ({ x0: SWAMP.x0 + pad, x1: -HALF + pad + 1, z0: SWAMP.z0 + pad, z1: SWAMP.z1 - pad });
const mainRect = (pad: number) => ({ x0: -HALF + pad, x1: HALF - pad, z0: -HALF + pad, z1: SOUTH - pad });
// Same for the mountains on their south side.
const mountainRect = (pad: number) => ({ x0: MOUNTAINS.x0 + pad, x1: MOUNTAINS.x1 - pad, z0: MOUNTAINS.z0 + pad, z1: -HALF + pad + 1 });
// And the Tierras on theirs.
const corruptRect = (pad: number) => ({ x0: CORRUPT_LANDS.x0 + pad, x1: CORRUPT_LANDS.x1 - pad, z0: CORRUPT_LANDS.z0 + pad, z1: CORRUPT_LANDS.z1 + pad + 1 });
const rects = (pad: number) => [mainRect(pad), swampRect(pad), mountainRect(pad), corruptRect(pad)];

/** Inside the playable map (forest ∪ coast ∪ swamp ∪ mountains ∪ Tierras), `pad` metres from its edge. */
export function inMap(x: number, z: number, pad: number): boolean {
  return rects(pad).some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
}

/** The nearest point of the map (union of the four rectangles; ties go to the forest's). */
export function clampMap(x: number, z: number, pad: number): { x: number; z: number } {
  if (inMap(x, z, pad)) return { x, z };
  let best = { x, z };
  let bestD = Infinity;
  for (const r of rects(pad)) {
    const c = { x: Math.max(r.x0, Math.min(r.x1, x)), z: Math.max(r.z0, Math.min(r.z1, z)) };
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

/** Forest ground (north of the coast blend), `pad` metres from its edges. Seeded forest things spawn here. */
export function inForest(x: number, z: number, pad: number): boolean {
  return Math.abs(x) < HALF - pad && z > -HALF + pad && z < COAST_Z0 - pad;
}

/** Seeded islets (3) and the dungeon island, in the deep sea. Pure seed: client and server agree. */
export function coastFeatures(seed: number): { islets: Islet[]; island: Islet } {
  const rng = createRng(seed ^ 0xc0a57);
  const island: Islet = { x: (rng() - 0.5) * 240, z: HALF + 170, r: 15, top: WATER_LEVEL + 5 };
  const islets: Islet[] = [];
  for (let tries = 0; islets.length < 3 && tries < 500; tries++) {
    const r = 9 + rng() * 3.5;
    const c: Islet = { x: (rng() - 0.5) * (WORLD_SIZE - 100), z: HALF + 110 + rng() * 75, r, top: WATER_LEVEL + 4 + rng() * 4 };
    if (Math.hypot(c.x - island.x, c.z - island.z) <= c.r + island.r + 20) continue;
    if (islets.some((o) => Math.hypot(o.x - c.x, o.z - c.z) <= o.r + c.r + 20)) continue;
    islets.push(c);
  }
  // ponytail: 500 tries always fit 3 islets in a 380 × 75 m strip; no fallback.
  return { islets, island };
}

/** 12 seeded montículos (dry mounds) in the swamp's interior, away from the Laguna and the river. */
export function swampFeatures(seed: number): { mounds: Mound[] } {
  const rng = createRng(seed ^ 0x5a3b9);
  const mounds: Mound[] = [];
  for (let tries = 0; mounds.length < 12 && tries < 2000; tries++) {
    const r = 6 + rng() * 9;
    const m: Mound = { x: -HALF - 160 + r + rng() * (90 - 2 * r), z: SWAMP.z0 + 25 + rng() * (SWAMP.z1 - SWAMP.z0 - 50), r, top: WATER_LEVEL + 1 + rng() * 3 };
    if (Math.hypot((m.x - LAGUNA.x) / (LAGUNA.rx + r + 4), (m.z - LAGUNA.z) / (LAGUNA.rz + r + 4)) < 1) continue;
    if (Math.abs(m.z - RIVER.z) < RIVER.half + RIVER.bank + r + 4) continue;
    if (mounds.some((o) => Math.hypot(o.x - m.x, o.z - m.z) <= o.r + m.r + 6)) continue;
    mounds.push(m);
  }
  // ponytail: 2000 tries always fit 12 mounds in 90 × 300 m minus the Laguna; no fallback.
  return { mounds };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

// ponytail: no height cache. The old per-cell cache returned whichever exact point was queried first,
// so client and server could disagree. Recompute is cheap; add a cache keyed on exact coords if profiling says so.
export function createTerrain(seed: number): Terrain {
  const noise = new Noise2D(seed);
  const { islets, island } = coastFeatures(seed);
  const bumps = [...islets, island];
  const { mounds } = swampFeatures(seed);
  const { paredes, pico } = mountainFeatures(seed);
  const cf = corruptFeatures(seed);
  const xRim = (x: number) => {
    const e = Math.abs(x) / HALF;
    return e > 0.85 ? (e - 0.85) * 60 : 0; // hills at the border keep players in
  };
  const forest = (x: number, z: number) => {
    const n = noise.fbm(x * 0.012 + 100, z * 0.012 + 100, 5);
    const ridge = noise.fbm(x * 0.004, z * 0.004, 3);
    const edge = Math.max(Math.abs(x), z < 0 ? -z : 0) / HALF;
    const rim = edge > 0.85 ? (edge - 0.85) * 60 : 0;
    let h = (n - 0.5) * 14 + (ridge - 0.5) * 18 + rim;
    const dSpawn = Math.hypot(x, z);
    if (dSpawn < 24) {
      const t = dSpawn / 24;
      h = Math.max(h, 0.8) * (1 - t) + h * t; // dry, gentle spawn for every seed
    }
    return h;
  };
  const coast = (x: number, z: number) => {
    const d = z - HALF;
    let h: number;
    if (d < COAST.mudTo) h = COAST.mud;
    else if (d < COAST.mudTo + 6) h = lerp(COAST.mud, COAST.beachTop, smooth((d - COAST.mudTo) / 6));
    else if (d < COAST.beachTo) h = lerp(COAST.beachTop, WATER_LEVEL + 0.05, (d - COAST.mudTo - 6) / (COAST.beachTo - COAST.mudTo - 6));
    else if (d < COAST.shallowsTo) h = lerp(WATER_LEVEL - 0.05, COAST.shallowsBed, (d - COAST.beachTo) / (COAST.shallowsTo - COAST.beachTo));
    else {
      const bed = COAST.seabed + (noise.fbm(x * 0.03 + 300, z * 0.03 + 300, 3) - 0.5) * 4;
      h = d < COAST.deepFrom ? lerp(COAST.shallowsBed, bed, smooth((d - COAST.shallowsTo) / (COAST.deepFrom - COAST.shallowsTo))) : bed;
      for (const b of bumps) {
        const k = Math.hypot(x - b.x, z - b.z) / b.r;
        if (k < 1) h = Math.max(h, b.top - (b.top - h) * k * k);
      }
      if (d > COAST.rimFrom) h = lerp(h, COAST.rimTop, smooth(Math.min(1, (d - COAST.rimFrom) / (SOUTH - HALF - COAST.rimFrom))));
    }
    return h + xRim(x);
  };
  const main = (x: number, z: number) => {
    if (z < COAST_Z0) return forest(x, z);
    if (z < COAST_Z0 + COAST.blend) return lerp(forest(x, z), coast(x, z), smooth((z - COAST_Z0) / COAST.blend));
    return coast(x, z);
  };
  const swamp = (x: number, z: number) => {
    const n = noise.fbm(x * 0.03 + 700, z * 0.03 + 700, 3);
    let h = WATER_LEVEL - 0.3 - 1.2 * smooth(Math.max(0, Math.min(1, (n - 0.68) / 0.14))); // mostly ankle-deep, a few pools
    const k = Math.hypot((x - LAGUNA.x) / LAGUNA.rx, (z - LAGUNA.z) / LAGUNA.rz);
    if (k < 1) {
      const bowl = k < 0.8 ? lerp(LAGUNA.deep, LAGUNA.bed, (k / 0.8) ** 2) : lerp(LAGUNA.bed, h, smooth((k - 0.8) / 0.2));
      h = Math.min(h, bowl);
    }
    for (const m of mounds) {
      const q = Math.hypot(x - m.x, z - m.z) / m.r;
      if (q < 1) h = Math.max(h, m.top - (m.top - h) * q * q);
    }
    const rim = Math.max(SWAMP.x0 + SWAMP.rim - x, SWAMP.z0 + SWAMP.rim - z, z - (SWAMP.z1 - SWAMP.rim));
    if (rim > 0) h = lerp(h, SWAMP.rimTop, smooth(Math.min(1, rim / SWAMP.rim)));
    return h;
  };
  const river = (x: number, z: number, h: number) => {
    if (x <= RIVER.x0 || x >= RIVER.x1) return h;
    const d = Math.abs(z - RIVER.z);
    if (d >= RIVER.half + RIVER.bank) return h;
    return Math.min(h, d < RIVER.half ? RIVER.bed : lerp(RIVER.bed, h, (d - RIVER.half) / RIVER.bank));
  };
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  let picoTop = NaN; // E(pico.x) + PICO.rise, computed on first use (main() needs the closures above)
  const mountains = (x: number, z: number) => {
    const d = -HALF - z;
    const E = main(x, -HALF);
    let r = 0;
    for (let k = 0; k < PELDANOS.steps; k++) r += PELDANOS.rise * smooth(clamp01((d - PELDANOS.first - PELDANOS.pitch * k) / PELDANOS.run));
    if (d > MOUNTAINS.faldas) {
      const f = d - MOUNTAINS.faldas;
      r += 16 * smooth(clamp01(f / 80)) + (noise.fbm(x * 0.02 + 900, z * 0.02 + 900, 3) - 0.5) * 12 * clamp01(f / 8);
      if (d > MOUNTAINS.cumbre) r += 25 * smooth(clamp01((d - MOUNTAINS.cumbre) / 80)) + (noise.fbm(x * 0.01 + 950, z * 0.01 + 950, 3) - 0.5) * 16 * clamp01((d - MOUNTAINS.cumbre) / 20);
      for (const p of paredes) {
        const q = Math.hypot(x - p.x, z - p.z);
        if (q < p.rt + p.w) r += p.h * smooth(clamp01((p.rt + p.w - q) / p.w));
      }
      // The snow chute: a shallow valley down the middle.
      r -= CHUTE.depth * (1 - smooth(clamp01((Math.abs(x) - CHUTE.half) / CHUTE.blend))) * clamp01(f / 5);
      const side = Math.abs(x) - (HALF - MOUNTAINS.sideRim);
      if (side > 0) r = lerp(r, MOUNTAINS.rimTop, smooth(clamp01(side / MOUNTAINS.sideRim)) * clamp01(f / 10));
    }
    if (d > MOUNTAINS.rimFrom) r = lerp(r, MOUNTAINS.rimTop, smooth(clamp01((d - MOUNTAINS.rimFrom) / (MOUNTAINS.z1 - MOUNTAINS.z0 - MOUNTAINS.rimFrom))));
    let h = E + r;
    const q = Math.hypot(x - pico.x, z - pico.z);
    if (q < PICO.r + PICO.skirt) {
      if (Number.isNaN(picoTop)) picoTop = main(pico.x, -HALF) + PICO.rise;
      h = Math.max(h, q <= PICO.r ? picoTop : lerp(picoTop, h, smooth((q - PICO.r) / PICO.skirt)));
    }
    return h;
  };
  let e0 = NaN; // E(0): the plateau's reference
  let stepsFloor = NaN;
  let lakeTop = NaN;
  const C = CORRUPT_LANDS;
  const corrupt = (x: number, z: number) => {
    const d = C.z1 - z;
    const E = main(x, -HALF);
    let r: number;
    if (d < C.rim) r = lerp(C.rimTop, C.rimFoot, smooth(clamp01(d / C.rim)));
    else {
      const ramp = clamp01((d - C.rim) / 8);
      r = C.rimFoot + (noise.fbm(x * 0.03 + 1200, z * 0.03 + 1200, 3) - 0.5) * 10 * ramp;
      if (d > C.ceniza) r += 8 * smooth(clamp01((d - C.ceniza) / 40)) + (noise.fbm(x * 0.015 + 1300, z * 0.015 + 1300, 3) - 0.5) * 16 * clamp01((d - C.ceniza) / 10);
    }
    let h = E + r;
    // el Lago Negro: a bowl.
    const q = Math.hypot(x - cf.lake.x, z - cf.lake.z) / cf.lake.r;
    if (q < 1) {
      if (Number.isNaN(lakeTop)) lakeTop = main(cf.lake.x, -HALF) + C.rimFoot;
      h = lerp(lakeTop - cf.lake.depth * (1 - q * q), h, smooth(clamp01((q - 0.6) / 0.4)));
    }
    // los Escalones rotos: a flat floor, 4 risers, a back wall.
    const s = cf.steps;
    const sd = d - s.d0;
    if (Math.abs(x - s.x) < s.half + s.run && sd > -4 - s.run && sd < 40 + s.run) {
      if (Number.isNaN(stepsFloor)) stepsFloor = main(s.x, -HALF) + C.rimFoot + 4;
      let top = stepsFloor;
      for (let k = 0; k < s.steps; k++) top += s.rise * smooth(clamp01((sd - s.pitch * k) / s.run));
      const m = smooth(clamp01((s.half + s.run - Math.abs(x - s.x)) / s.run)) * smooth(clamp01((sd + 4 + s.run) / s.run)) * smooth(clamp01((40 + s.run - sd) / s.run));
      h = lerp(h, top, m);
    }
    // la Torre's plateau.
    const tf = TOWER_FOOT;
    if (d > tf.d && Math.abs(x) < tf.half) {
      if (Number.isNaN(e0)) e0 = main(0, -HALF);
      h = lerp(h, e0 + tf.top, smooth(clamp01((tf.half - Math.abs(x)) / tf.blend)) * smooth(clamp01((d - tf.d) / tf.blend)));
    }
    const side = Math.abs(x) - (HALF - C.sideRim);
    if (side > 0 && d > C.rim) h = lerp(h, E + C.rimTop, smooth(clamp01(side / C.sideRim)) * clamp01((d - C.rim) / 10));
    return h;
  };
  return {
    heightAt(x, z) {
      let h: number;
      if (x >= -HALF && z < CORRUPT_LANDS.z1) h = corrupt(x, z);
      else if (x >= -HALF && z < -HALF) h = mountains(x, z);
      else if (x >= -HALF) h = main(x, z);
      else {
        const edge = main(-HALF, z);
        const t = (-HALF - x) / SWAMP.seam;
        h = t >= 1 ? swamp(x, z) : lerp(edge, swamp(x, z), smooth(t));
      }
      return river(x, z, h);
    },
    density(x, z) {
      return noise.fbm(x * 0.02 + 500, z * 0.02 + 500, 3);
    },
    waterAt(x, z) {
      if (Math.hypot(x - cf.lake.x, z - cf.lake.z) >= cf.lake.r) return WATER_LEVEL;
      if (Number.isNaN(lakeTop)) lakeTop = main(cf.lake.x, -HALF) + C.rimFoot;
      return lakeTop - BLACK_LAKE.dry;
    },
  };
}
