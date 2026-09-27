import { describe, expect, it } from 'vitest';
import { createTerrain, inSwamp, WATER_LEVEL } from './terrain';
import { FOGATA, generateFogatas } from './fogatas';
import { claimedMounds, generateAmberTrees } from './swamp-shrines';
import { VISION } from './sim/marchito';

describe('fogatas del Pantano (S3 §9)', () => {
  for (const seed of [42, 7, 1234]) {
    it(`seed ${seed}: 4 dry rings on free montículos, apart and clear of amber trees`, () => {
      const t = createTerrain(seed);
      const f = generateFogatas(t, seed);
      expect(f.map((x) => x.id)).toEqual([0, 1, 2, 3]);
      expect(FOGATA.count).toBe(4);
      const { frog, candles, peat, mounds } = claimedMounds(t, seed);
      const used = [frog, candles, peat].map((i) => mounds[i]!);
      const trees = generateAmberTrees(t, seed);
      for (const a of f) {
        expect(inSwamp(a.x, a.z)).toBe(true);
        expect(t.heightAt(a.x, a.z)).toBeGreaterThan(WATER_LEVEL);
        expect(a.y).toBeCloseTo(t.heightAt(a.x, a.z));
        expect(mounds.some((m) => Math.hypot(m.x - a.x, m.z - a.z) < m.r)).toBe(true);
        for (const m of used) expect(Math.hypot(m.x - a.x, m.z - a.z)).toBeGreaterThan(m.r);
        for (const tr of trees) expect(Math.hypot(tr.x - a.x, tr.z - a.z)).toBeGreaterThan(2.5);
        for (const b of f) if (b !== a) expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(10);
      }
      expect(generateFogatas(t, seed)).toEqual(f);
    });
  }

  it('visions name who is there', () => {
    expect(VISION.swamp('Ana').join(' ')).toContain('Ana');
    expect(VISION.knot('Ana y Leo').join(' ')).toContain('Ana y Leo');
  });
});
