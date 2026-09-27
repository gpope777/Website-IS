import { describe, expect, it } from 'vitest';
import { createTerrain, HALF, WATER_LEVEL } from './terrain';
import { generateCrags } from './crags';
import { generateShrines, SHRINE } from './shrines';

describe('shrines', () => {
  for (const seed of [1, 7, 42, 1234]) {
    it(`places one shrine of each kind on dry land (seed ${seed})`, () => {
      const t = createTerrain(seed);
      const crags = generateCrags(t, seed);
      const s = generateShrines(t, seed, crags);
      expect(s).toEqual(generateShrines(t, seed, crags));
      expect(s.map((x) => x.kind)).toEqual(['levers', 'plate', 'ledge']);
      for (const sh of s) {
        const d = Math.hypot(sh.x, sh.z);
        expect(d).toBeGreaterThanOrEqual(SHRINE.minDist - 1e-6);
        expect(Math.abs(sh.x)).toBeLessThan(HALF - 20);
        for (const p of [sh, ...sh.parts]) expect(t.heightAt(p.x, p.z)).toBeGreaterThan(WATER_LEVEL);
        for (const c of crags) expect(Math.hypot(c.x - sh.x, c.z - sh.z)).toBeGreaterThan(SHRINE.cragClear);
      }
      const [levers, plate, ledge] = s;
      expect(levers!.parts).toHaveLength(2);
      expect(plate!.parts).toHaveLength(1);
      expect(ledge!.pillar?.bare).toBe(true);
      expect(ledge!.orb.y).toBeGreaterThan(ledge!.pillar!.top);
    });
  }
});
