import { describe, expect, it } from 'vitest';
import { createTerrain, HALF, WATER_LEVEL } from './terrain';
import { generateCrags } from './crags';
import { generateShrines } from './shrines';
import { generateEntrance } from './dungeon';
import { generateWild, inZone, MOUNT, ringAngle } from './mount';

describe('mount', () => {
  it('ring angle wraps and zones wrap around 0', () => {
    expect(ringAngle(2, Math.PI)).toBeCloseTo(0);
    expect(ringAngle(1, 1)).toBeCloseTo(1);
    expect(ringAngle(1, -1)).toBeCloseTo(2 * Math.PI - 1);
    expect(inZone(0.1, 2 * Math.PI - 0.1, 0.5)).toBe(true);
    expect(inZone(Math.PI, 0, 1)).toBe(false);
    expect(inZone(0.4, 0, 1)).toBe(true);
    expect(inZone(0.6, 0, 1)).toBe(false);
  });

  it('rounds get faster and narrower; riding beats walking but stays under the cap', () => {
    for (let i = 1; i < MOUNT.rounds.length; i++) {
      expect(MOUNT.rounds[i]!.speed).toBeGreaterThan(MOUNT.rounds[i - 1]!.speed);
      expect(MOUNT.rounds[i]!.width).toBeLessThan(MOUNT.rounds[i - 1]!.width);
    }
    expect(MOUNT.run).toBeLessThan(MOUNT.maxSpeed);
    expect(MOUNT.rounds.length).toBe(3);
  });

  for (const seed of [1, 7, 42, 1234]) {
    it(`puts the wild deer on dry land in range, away from other places (seed ${seed})`, () => {
      const t = createTerrain(seed);
      const crags = generateCrags(t, seed);
      const shrines = generateShrines(t, seed, crags);
      const e = generateEntrance(t, seed, crags, shrines);
      const avoid = [...crags, ...shrines, e];
      const w = generateWild(t, seed, avoid);
      expect(w).toEqual(generateWild(t, seed, avoid));
      const d = Math.hypot(w.x, w.z);
      expect(d).toBeGreaterThanOrEqual(MOUNT.minDist - 1e-6);
      expect(d).toBeLessThanOrEqual(MOUNT.maxDist + 1e-6);
      expect(t.heightAt(w.x, w.z)).toBeGreaterThan(WATER_LEVEL + 0.5);
      expect(Math.abs(w.x)).toBeLessThan(HALF - 20);
      for (const a of avoid) expect(Math.hypot(a.x - w.x, a.z - w.z)).toBeGreaterThan(MOUNT.clear);
    });
  }
});
