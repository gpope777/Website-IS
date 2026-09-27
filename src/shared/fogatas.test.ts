import { describe, expect, it } from 'vitest';
import { TOWER } from './corrupt-lands';
import { lookoutTop } from './ending';
import { createTerrain, inMountains, inSwamp, WATER_LEVEL } from './terrain';
import { FOGATA, generateFogatas } from './fogatas';
import { claimedMounds, generateAmberTrees } from './swamp-shrines';
import { VISION } from './sim/marchito';

describe('fogatas del Pantano (S3 §9)', () => {
  for (const seed of [42, 7, 1234]) {
    it(`seed ${seed}: 4 dry rings on free montículos and 2 mountain refugios, apart and clear of amber trees`, () => {
      const t = createTerrain(seed);
      const f = generateFogatas(t, seed).slice(0, FOGATA.swamp);
      const all = generateFogatas(t, seed);
      expect(all.map((x) => x.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      expect(FOGATA.count).toBe(8);
      expect(all[7]).toMatchObject({ lookout: true, x: TOWER.x, z: TOWER.z, y: lookoutTop(t).y });
      expect(all.slice(4, 6).every((x) => x.refugio && inMountains(x.x, x.z))).toBe(true);
      expect(f.map((x) => x.id)).toEqual([0, 1, 2, 3]);
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
      expect(generateFogatas(t, seed)).toEqual(all);
    });
  }

  it('visions name who is there', () => {
    expect(VISION.swamp('Ana').join(' ')).toContain('Ana');
    expect(VISION.knot('Ana y Leo').join(' ')).toContain('Ana y Leo');
  });
});

describe('fogata 6: la Ceniza (S5 §7.1)', () => {
  it('sits on the ash plain, dry and gentle', async () => {
    const { corruptDepth, inCorrupt } = await import('./terrain');
    for (const seed of [42, 7]) {
      const t = createTerrain(seed);
      const c = generateFogatas(t, seed)[FOGATA.ceniza]!;
      expect(c.id).toBe(6);
      expect(c.ceniza).toBe(true);
      expect(inCorrupt(c.x, c.z)).toBe(true);
      const d = corruptDepth(c.z);
      expect(d).toBeGreaterThan(20);
      expect(d).toBeLessThan(80);
      expect(c.y).toBeCloseTo(t.heightAt(c.x, c.z));
      const slope = Math.abs(t.heightAt(c.x + 2, c.z) - t.heightAt(c.x - 2, c.z)) / 4;
      expect(slope).toBeLessThan(0.5);
    }
  });
});
