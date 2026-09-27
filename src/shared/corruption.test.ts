import { describe, expect, it } from 'vitest';
import { createTerrain, HALF, WATER_LEVEL } from './terrain';
import { CORRUPTION, generateZones, nearestZone, raidDirFrom, taintAt, zoneAt } from './corruption';

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
