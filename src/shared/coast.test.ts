import { describe, expect, it } from 'vitest';
import { Noise2D } from './noise';
import { clampMap, COAST_Z0, coastFeatures, createTerrain, HALF, inForest, inMap, SOUTH, WATER_LEVEL } from './terrain';
import { generateCrags } from './crags';
import { generateResources } from './resources';
import { deepStepOk, depthAt, inCienaga, SWIM_MAX_DEPTH } from './coast';

/** Today's forest function (before the coast), kept verbatim to prove the forest did not move. */
function oldHeight(seed: number) {
  const noise = new Noise2D(seed);
  return (x: number, z: number) => {
    const n = noise.fbm(x * 0.012 + 100, z * 0.012 + 100, 5);
    const ridge = noise.fbm(x * 0.004, z * 0.004, 3);
    const edge = Math.max(Math.abs(x), Math.abs(z)) / HALF;
    const rim = edge > 0.85 ? (edge - 0.85) * 60 : 0;
    let h = (n - 0.5) * 14 + (ridge - 0.5) * 18 + rim;
    const dSpawn = Math.hypot(x, z);
    if (dSpawn < 24) {
      const t = dSpawn / 24;
      h = Math.max(h, 0.8) * (1 - t) + h * t;
    }
    return h;
  };
}

const SEEDS = [1, 42, 777, 12345];

describe('coast terrain', () => {
  it('leaves the forest untouched north of COAST_Z0', () => {
    for (const s of SEEDS) {
      const t = createTerrain(s);
      const old = oldHeight(s);
      for (let x = -HALF; x <= HALF; x += 37) for (let z = -HALF; z < COAST_Z0; z += 23) expect(t.heightAt(x, z)).toBe(old(x, z));
    }
  });

  it('has the bands: flat dry mud, a dry beach, shallows, a deep sea and a dry south rim', () => {
    for (const s of SEEDS) {
      const t = createTerrain(s);
      const f = coastFeatures(s);
      const onIslet = (x: number, z: number) => [...f.islets, f.island].some((i) => Math.hypot(i.x - x, i.z - z) < i.r + 2);
      for (let x = -HALF + 40; x <= HALF - 40; x += 20) {
        for (let d = -20; d <= 20; d += 5) expect(t.heightAt(x, HALF + d)).toBeCloseTo(WATER_LEVEL + 0.3, 5);
        for (let d = 22; d <= 48; d += 4) expect(t.heightAt(x, HALF + d)).toBeGreaterThanOrEqual(WATER_LEVEL);
        for (let d = 60; d <= 88; d += 4) {
          const depth = WATER_LEVEL - t.heightAt(x, HALF + d);
          expect(depth).toBeGreaterThan(0);
          expect(depth).toBeLessThanOrEqual(4.01);
        }
        for (let d = 100; d <= 195; d += 5) if (!onIslet(x, HALF + d)) expect(WATER_LEVEL - t.heightAt(x, HALF + d)).toBeGreaterThan(4);
        expect(t.heightAt(x, SOUTH - 5)).toBeGreaterThan(WATER_LEVEL);
      }
    }
  });

  it('seeds 3 islets and the dungeon island in the deep sea, dry on top and apart', () => {
    for (const s of SEEDS) {
      const t = createTerrain(s);
      const { islets, island } = coastFeatures(s);
      expect(coastFeatures(s)).toEqual({ islets, island });
      expect(islets).toHaveLength(3);
      expect(island.z).toBeCloseTo(HALF + 170, 0);
      for (const i of [...islets, island]) {
        expect(t.heightAt(i.x, i.z)).toBeGreaterThan(WATER_LEVEL + 3);
        expect(Math.abs(i.x)).toBeLessThan(HALF - 40);
      }
      for (const i of islets) {
        expect(i.r * 2).toBeGreaterThanOrEqual(18);
        expect(i.r * 2).toBeLessThanOrEqual(25);
        expect(i.z - HALF).toBeGreaterThanOrEqual(100);
        expect(i.z - HALF).toBeLessThanOrEqual(190);
        expect(Math.hypot(i.x - island.x, i.z - island.z)).toBeGreaterThan(i.r + island.r + 20);
      }
    }
  });

  it('keeps crags away from the Ciénaga and resources in the forest', () => {
    for (const s of SEEDS) {
      const t = createTerrain(s);
      for (const c of generateCrags(t, s)) expect(c.z).toBeLessThan(COAST_Z0 - 60);
      for (const r of generateResources(t, s)) expect(r.z).toBeLessThan(COAST_Z0);
    }
  });

  it('bounds the map: south edge at SOUTH, the forest at COAST_Z0', () => {
    expect(inMap(0, HALF + 100, 2)).toBe(true);
    expect(inMap(0, SOUTH, 2)).toBe(false);
    expect(inMap(0, -HALF - 420, 2)).toBe(false); // S5: the north edge is the Tierras Corruptas' now
    expect(inMap(HALF, 300, 2)).toBe(false);
    expect(inForest(0, 150, 4)).toBe(true);
    expect(inForest(0, COAST_Z0, 4)).toBe(false);
    expect(clampMap(0, SOUTH + 10, 3)).toEqual({ x: 0, z: SOUTH - 3 });
    expect(clampMap(-HALF - 1, -HALF - 1, 3)).toEqual({ x: -HALF + 3, z: -HALF - 1 }); // S4: into the mountains
  });
});

describe('coast rules', () => {
  const t = createTerrain(42);
  it('the Ciénaga spans the blend and the mud band', () => {
    expect(inCienaga(0, COAST_Z0 - 1)).toBe(false);
    expect(inCienaga(0, COAST_Z0 + 1)).toBe(true);
    expect(inCienaga(0, HALF + 19)).toBe(true);
    expect(inCienaga(0, HALF + 25)).toBe(false);
  });

  it('deep sea: a swimmer may only go shallower', () => {
    const x = -HALF + 45; // islets and island keep |x| < HALF - 40 of their centre, but check anyway
    const z = HALF + 150;
    expect(depthAt(t, x, z)).toBeGreaterThan(SWIM_MAX_DEPTH);
    expect(deepStepOk(t, x, HALF + 70, x, HALF + 71)).toBe(true); // shallows
    expect(deepStepOk(t, x, HALF + 100, x, HALF + 90)).toBe(true); // toward the beach
    expect(deepStepOk(t, x, HALF + 92, x, HALF + 100)).toBe(false); // out to sea
  });
});
