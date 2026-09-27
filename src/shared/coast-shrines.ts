import { createRng } from './rng';
import { depthAt } from './coast';
import { FISH } from './fish';
import { COAST, coastFeatures, HALF, WATER_LEVEL, type Terrain } from './terrain';
import type { Inventory, ItemId } from './items';
import type { Shrine, ShrineKind } from './shrines';

/** The coast's three shrines (spec §6.1): ids follow the forest's 0–2. */
export const COAST_SHRINE = {
  firstId: 3,
  /** Marea: tide plate this far from the orb; the pumice block starts on the other side. */
  tideDist: 12,
  blockGap: 4,
  /** Hundido: the beach lever this far beside the orb; the seabed one ~40 m out to sea. */
  sunkenGap: 8,
  seabedOut: [34, 46],
  /** Seabed things (lever, chests) need you within this of the bottom: diving on the fish. */
  above: 2,
  sunkenWindow: 8,
  /** Islote: three wheels this far around the orb, all turned within the window. */
  wheelGap: 5,
  wheelWindow: 6,
} as const;

/** Sunken chests (spec §6.2): one per player each, a pearl inside. */
export const CHEST = { count: 6, reach: 2.5, above: 2, spread: 12 } as const;

export interface Chest {
  id: number;
  x: number;
  y: number;
  z: number;
  loot: Inventory;
}

const BEACH = [HALF + COAST.mudTo + 4, HALF + COAST.beachTo - 4] as const;
const dry = (t: Terrain, x: number, z: number) => t.heightAt(x, z) >= WATER_LEVEL + 0.4;

function shrine(t: Terrain, id: number, kind: ShrineKind, x: number, z: number, parts: { x: number; z: number }[]): Shrine {
  const y = t.heightAt(x, z);
  return { id, kind, x, z, y, orb: { x, y: y + 1.2, z }, parts, pillar: null };
}

/** Marea and Hundido on the beach (≥ 60 m apart), Islote on islet 1. Pure seed: client and server agree. */
export function generateCoastShrines(t: Terrain, seed: number): Shrine[] {
  const rng = createRng(seed ^ 0xc5a1);
  const S = COAST_SHRINE;
  const beachZ = () => BEACH[0] + rng() * (BEACH[1] - BEACH[0]);
  const beachX = () => (rng() - 0.5) * (2 * HALF - 80);

  let tide: Shrine | null = null;
  for (let tries = 0; tries < 300 && !tide; tries++) {
    const x = beachX();
    const z = beachZ();
    const plate = { x: x + S.tideDist, z };
    const block = { x: x - S.blockGap, z };
    if (Math.abs(plate.x) < HALF - 20 && [{ x, z }, plate, block].every((p) => dry(t, p.x, p.z))) tide = shrine(t, 3, 'tide', x, z, [plate, block]);
  }
  // ponytail: the beach is 30 m of dry sand across the map; 300 tries always fit in tests.
  tide ??= shrine(t, 3, 'tide', 0, HALF + 30, [{ x: S.tideDist, z: HALF + 30 }, { x: -S.blockGap, z: HALF + 30 }]);

  let sunken: Shrine | null = null;
  for (let tries = 0; tries < 400 && !sunken; tries++) {
    const x = beachX();
    const z = beachZ();
    const lever = { x: x + S.sunkenGap, z };
    if (Math.abs(lever.x) > HALF - 20 || Math.hypot(x - tide.x, z - tide.z) < 60) continue;
    if (!dry(t, x, z) || !dry(t, lever.x, lever.z)) continue;
    for (let out: number = S.seabedOut[0]; out <= S.seabedOut[1]; out += 1) {
      const d = depthAt(t, lever.x, lever.z + out);
      if (d >= 2.2 && d <= 3.8) {
        sunken = shrine(t, 4, 'sunken', x, z, [lever, { x: lever.x, z: lever.z + out }]);
        break;
      }
    }
  }
  sunken ??= shrine(t, 4, 'sunken', tide.x > 0 ? -60 : 60, HALF + 30, [{ x: (tide.x > 0 ? -60 : 60) + S.sunkenGap, z: HALF + 30 }, { x: (tide.x > 0 ? -60 : 60) + S.sunkenGap, z: HALF + 70 }]);

  const islet = coastFeatures(seed).islets[0]!;
  const spin = rng() * Math.PI * 2;
  let r: number = S.wheelGap;
  const wheels = (gap: number) => [0, 1, 2].map((i) => ({ x: islet.x + Math.sin(spin + (i * Math.PI * 2) / 3) * gap, z: islet.z + Math.cos(spin + (i * Math.PI * 2) / 3) * gap }));
  while (r > 2 && !wheels(r).every((p) => dry(t, p.x, p.z))) r -= 0.5;
  const fan = shrine(t, 5, 'fan', islet.x, islet.z, wheels(r));
  return [tide, sunken, fan];
}

const LOOT: readonly ItemId[] = ['wood', 'stone', 'berries'];

/** 6 chests around 2 ruin clusters on the deep seabed, clear of islets and the aguas bravas. */
export function generateChests(t: Terrain, seed: number): Chest[] {
  const rng = createRng(seed ^ 0xc4e57);
  const { islets, island } = coastFeatures(seed);
  const ok = (x: number, z: number) =>
    z > HALF + COAST.deepFrom + 2 &&
    z < HALF + COAST.rimFrom - 8 &&
    Math.abs(x) < HALF - 20 &&
    depthAt(t, x, z) >= 6 &&
    islets.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + 6) &&
    Math.hypot(island.x - x, island.z - z) > island.r + FISH.bravas + 2;
  const out: Chest[] = [];
  const centres: { x: number; z: number }[] = [];
  for (let tries = 0; centres.length < 2 && tries < 500; tries++) {
    const c = { x: (rng() - 0.5) * (2 * HALF - 60), z: HALF + COAST.deepFrom + 10 + rng() * 70 };
    if (ok(c.x, c.z) && centres.every((o) => Math.hypot(o.x - c.x, o.z - c.z) > 60)) centres.push(c);
  }
  // ponytail: the deep sea is 90 × 440 m; two centres always fit in tests.
  while (centres.length < 2) centres.push({ x: centres.length ? 100 : -100, z: HALF + 150 });
  for (const c of centres) {
    let placed = 0;
    for (let tries = 0; placed < CHEST.count / 2 && tries < 200; tries++) {
      const a = rng() * Math.PI * 2;
      const d = 3 + rng() * (CHEST.spread - 3);
      const x = c.x + Math.sin(a) * d;
      const z = c.z + Math.cos(a) * d;
      if (!ok(x, z) || out.some((o) => Math.hypot(o.x - x, o.z - z) < 3)) continue;
      out.push(chest(t, rng, out.length, x, z));
      placed++;
    }
    while (placed < CHEST.count / 2) {
      out.push(chest(t, rng, out.length, c.x, c.z)); // ponytail: stacked at the centre; never seen in tests
      placed++;
    }
  }
  return out;
}

function chest(t: Terrain, rng: () => number, id: number, x: number, z: number): Chest {
  const item = LOOT[Math.floor(rng() * LOOT.length)]!;
  const n = 6 + Math.floor(rng() * 5);
  return { id, x, y: t.heightAt(x, z), z, loot: { [item]: n, pearl: 1 } };
}
