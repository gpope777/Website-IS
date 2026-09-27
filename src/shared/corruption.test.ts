import { describe, expect, it } from 'vitest';
import { coastFeatures, createTerrain, HALF, WATER_LEVEL } from './terrain';
import { allZones, coastRaidBrutes, CORRUPTION, generateCoastZones, generateSwampZones, generateZones, isCoastZone, isSwampZone, nearestZone, raidDirFrom, SWAMP_ZONES, taintAt, zoneAt, type Zone } from './corruption';
import { inBog } from './swamp';
import { generateSwampShrines } from './swamp-shrines';
import { inSwamp, LAGUNA, swampFeatures } from './terrain';

describe('corruption zones', () => {
  for (const seed of [1, 42, 777, 2026]) {
    it(`seed ${seed}: deterministic, dry, zone 0 on the Raíz-madre, spawn clean`, () => {
      const t = createTerrain(seed);
      const e = { x: 100, z: -60 };
      const a = generateZones(t, seed, e);
      expect(generateZones(t, seed, e)).toEqual(a);
      expect(a.length).toBeGreaterThanOrEqual(4);
      expect(a.length).toBeLessThanOrEqual(CORRUPTION.count);
      expect(zoneAt(a, e.x, e.z)?.id).toBe(0);
      expect(zoneAt(a, 0, 0)).toBeUndefined();
      for (const z of a.slice(1)) {
        expect(t.heightAt(z.x, z.z)).toBeGreaterThan(WATER_LEVEL);
        expect(Math.abs(z.x)).toBeLessThan(HALF);
      }
    });
  }

  it('taint fades from the centre, only for corrupt zones', () => {
    const zones = [{ id: 0, x: 0, z: 0, r: 20 }];
    expect(taintAt(zones, [0], 0, 0)).toBe(1);
    expect(taintAt(zones, [0], 19, 0)).toBeGreaterThan(0);
    expect(taintAt(zones, [0], 21, 0)).toBe(0);
    expect(taintAt(zones, [], 0, 0)).toBe(0);
  });

  it('raids come from the nearest corrupt zone, else the fallback', () => {
    const zones = [
      { id: 0, x: 0, z: 100, r: 20 },
      { id: 1, x: 50, z: 0, r: 20 },
    ];
    expect(raidDirFrom({ x: 0, z: 0 }, zones, [0, 1], 9)).toBeCloseTo(Math.PI / 2);
    expect(raidDirFrom({ x: 0, z: 0 }, zones, [0], 9)).toBeCloseTo(0);
    expect(raidDirFrom({ x: 0, z: 0 }, zones, [], 9)).toBe(9);
    expect(nearestZone(zones, 40, 5)?.id).toBe(1);
    expect(nearestZone(zones, 40, 5, [0])?.id).toBe(0);
  });
});

describe('coast corruption zones (S2-D)', () => {
  for (const seed of [1, 42, 777, 2026]) {
    it(`seed ${seed}: ids 6–9 after the forest, placed on island, beach, shallows, islet`, () => {
      const t = createTerrain(seed);
      const e = { x: 100, z: -60 };
      const forest = generateZones(t, seed, e);
      const all = allZones(t, seed, e);
      expect(all.slice(0, forest.length)).toEqual(forest);
      const coast = generateCoastZones(t, seed);
      expect(all.slice(forest.length, forest.length + 4)).toEqual(coast); // Rule change (S3-D): swamp zones follow.
      expect(coast.map((z) => z.id)).toEqual([6, 7, 8, 9]);
      const { island, islets } = coastFeatures(seed);
      expect(coast[0]!.x).toBeCloseTo(island.x);
      expect(coast[0]!.z).toBeCloseTo(island.z);
      const beach = coast[1]!;
      expect(beach.z).toBeGreaterThan(HALF + 20);
      expect(beach.z).toBeLessThan(HALF + 50);
      expect(t.heightAt(beach.x, beach.z)).toBeGreaterThan(WATER_LEVEL);
      const sh = coast[2]!;
      const depth = WATER_LEVEL - t.heightAt(sh.x, sh.z);
      expect(depth).toBeGreaterThanOrEqual(0.5);
      expect(depth).toBeLessThanOrEqual(4);
      expect(islets.some((i) => Math.hypot(i.x - coast[3]!.x, i.z - coast[3]!.z) < 0.01)).toBe(true);
      for (const a of coast) for (const b of coast) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(a.r + b.r);
      expect(coast.every((z) => isCoastZone(z.id))).toBe(true);
      expect(isCoastZone(5)).toBe(false);
    });
  }

  it('raid pressure: +1 brute per 2 corrupt coast zones while the coast root is corrupt', () => {
    expect(coastRaidBrutes([6, 7, 8, 9])).toBe(2);
    expect(coastRaidBrutes([0, 6, 7])).toBe(1);
    expect(coastRaidBrutes([6])).toBe(0);
    expect(coastRaidBrutes([7, 8, 9])).toBe(0);
    expect(coastRaidBrutes([0, 1])).toBe(0);
  });
});

describe('swamp corruption zones (S3-D)', () => {
  for (const seed of [1, 42, 777, 2026]) {
    it(`seed ${seed}: ids 10–13, root in the Laguna, mound, bog, Nenúfares shore; no overlap`, () => {
      const t = createTerrain(seed);
      const all = allZones(t, seed, { x: 100, z: -60 });
      const sw = all.filter((z) => isSwampZone(z.id));
      expect(sw.map((z) => z.id)).toEqual([10, 11, 12, 13]);
      expect(all.slice(-4)).toEqual(sw);
      expect(generateSwampZones(t, seed)).toEqual(sw);
      const [z10, z11, z12, z13] = sw as [Zone, Zone, Zone, Zone];
      expect(Math.hypot(z10.x - LAGUNA.x, z10.z - LAGUNA.z)).toBeLessThan(1);
      expect(z10.r).toBe(SWAMP_ZONES.rootR);
      const { mounds } = swampFeatures(seed);
      expect(mounds.some((m) => Math.hypot(m.x - z11.x, m.z - z11.z) < m.r)).toBe(true);
      expect(t.heightAt(z11.x, z11.z)).toBeGreaterThan(WATER_LEVEL);
      expect(inBog(t, z12.x, z12.z)).toBe(true);
      const shore = generateSwampShrines(t, seed)[1]!.parts[0]!;
      expect(Math.hypot(z13.x - shore.x, z13.z - shore.z)).toBeLessThan(4);
      for (const z of sw) expect(inSwamp(z.x, z.z)).toBe(true);
      for (const a of sw) for (const b of sw) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(a.r + b.r);
    });
  }

  it('swamp ids are not coast ids; swamp zones add no coast brutes', () => {
    expect(isCoastZone(10)).toBe(false);
    expect(isCoastZone(9)).toBe(true);
    expect(isSwampZone(10)).toBe(true);
    expect(isSwampZone(9)).toBe(false);
    expect(coastRaidBrutes([6, 7, 10, 11])).toBe(1);
  });
});
