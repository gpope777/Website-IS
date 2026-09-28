import { describe, expect, it } from 'vitest';
import { ashHurts, ASH_RUN, lidUp, LID, pillarSites, THICKET, thicketHurts } from './pillars';
import { CORRUPT_LANDS, corruptFeatures, createTerrain, inCorrupt, WATER_LEVEL, waterLevel } from './terrain';
import { withEscalera } from './mountains';
import { withDungeon } from './dungeon';
import { fishStepOk } from './fish';
import { cenizaFogata } from './corrupt-lands';
import { coastFeatures } from './terrain';

const SEEDS = [1, 42, 777, 2026];
const dOf = (z: number) => CORRUPT_LANDS.z1 - z;

describe('el Lago Negro has water (S5-C)', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}: about 10 m deep, the sea elsewhere, kept by the wrappers`, () => {
      const t = createTerrain(seed);
      const { lake } = corruptFeatures(seed);
      const w = waterLevel(t, lake.x, lake.z);
      expect(w - t.heightAt(lake.x, lake.z)).toBeGreaterThan(8);
      expect(w - t.heightAt(lake.x, lake.z)).toBeLessThan(12);
      expect(w).toBeGreaterThan(WATER_LEVEL + 12);
      expect(waterLevel(t, lake.x + lake.r + 10, lake.z)).toBe(WATER_LEVEL);
      expect(waterLevel(t, 0, 0)).toBe(WATER_LEVEL);
      expect(waterLevel(withEscalera(withDungeon(t), () => true), lake.x, lake.z)).toBe(w);
      expect(fishStepOk(t, coastFeatures(seed).island, lake.x, lake.z)).toBe(true);
      expect(fishStepOk(t, coastFeatures(seed).island, lake.x + lake.r + 10, lake.z)).toBe(false);
    });
  }
});

describe('los Pilares-raíz: sites (S5-C)', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}: each in its place, nothing overlaps`, () => {
      const t = createTerrain(seed);
      const s = pillarSites(seed);
      const { lake, steps } = corruptFeatures(seed);
      for (const c of s.cores) expect(inCorrupt(c.x, c.z)).toBe(true);
      for (const i of [0, 2, 3]) {
        expect(dOf(s.cores[i]!.z)).toBeGreaterThanOrEqual(80);
        expect(dOf(s.cores[i]!.z)).toBeLessThanOrEqual(170);
      }
      const wind = s.cores[1]!;
      expect(t.heightAt(wind.x, wind.z)).toBeGreaterThan(waterLevel(t, lake.x, lake.z));
      expect(Math.hypot(wind.x - lake.x, wind.z - lake.z) - lake.r).toBeLessThanOrEqual(8);
      const floor = t.heightAt(steps.x, CORRUPT_LANDS.z1 - steps.d0 + 2);
      expect(t.heightAt(s.cores[3]!.x, s.cores[3]!.z)).toBeGreaterThan(floor + 23);
      expect(t.heightAt(s.plate.x, s.plate.z)).toBeGreaterThan(floor + 23);
      const vine = s.cores[0]!;
      const fire = s.cores[2]!;
      expect(Math.hypot(vine.x - fire.x, vine.z - fire.z)).toBeGreaterThan(THICKET.r + ASH_RUN.r);
      expect(Math.hypot(vine.x - lake.x, vine.z - lake.z)).toBeGreaterThan(THICKET.r + lake.r);
      expect(Math.hypot(wind.x - vine.x, wind.z - vine.z)).toBeGreaterThan(THICKET.r);
      expect(Math.abs(fire.x - steps.x)).toBeGreaterThan(ASH_RUN.r + steps.half);
      const f = cenizaFogata(t);
      expect(Math.hypot(f.x - fire.x, f.z - fire.z)).toBeGreaterThan(ASH_RUN.r);
    });
  }

  it('the thicket bites in its ring, not on a made bridge nor in the clearing', () => {
    const s = pillarSites(42);
    const c = s.cores[0]!;
    const r0 = s.roots[0]!;
    const mid = { x: (c.x + r0.x) / 2, z: (c.z + r0.z) / 2 };
    expect(thicketHurts(s, [false, false, false], mid.x, mid.z)).toBe(true);
    expect(thicketHurts(s, [true, false, false], mid.x, mid.z)).toBe(false);
    expect(thicketHurts(s, [false, true, true], mid.x, mid.z)).toBe(true);
    expect(thicketHurts(s, [false, false, false], c.x + 1, c.z)).toBe(false);
    expect(thicketHurts(s, [false, false, false], c.x + THICKET.r + 1, c.z)).toBe(false);
  });

  it('the ash burns within its disc; the lid lifts with a pillar or a friend on the plate', () => {
    const s = pillarSites(42);
    const f = s.cores[2]!;
    expect(ashHurts(s, f.x + ASH_RUN.r - 1, f.z)).toBe(true);
    expect(ashHurts(s, f.x + ASH_RUN.r + 1, f.z)).toBe(false);
    expect(lidUp(s, [], [])).toBe(false);
    expect(lidUp(s, [{ x: s.plate.x + 1, z: s.plate.z }], [])).toBe(true);
    expect(lidUp(s, [], [{ x: s.plate.x, z: s.plate.z + 1 }])).toBe(true);
    expect(lidUp(s, [{ x: s.plate.x + LID.pillarR + 0.5, z: s.plate.z }], [{ x: s.plate.x + 2, z: s.plate.z }])).toBe(false);
  });
});
