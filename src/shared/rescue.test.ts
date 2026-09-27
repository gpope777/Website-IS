import { describe, expect, it } from 'vitest';
import { depthAt } from './coast';
import { FISH } from './fish';
import { cageY, rescueSite } from './rescue';
import { coastFeatures, createTerrain, WATER_LEVEL } from './terrain';

describe('rescue site', () => {
  for (const seed of [1, 7, 42, 1234]) {
    it(`puts the cage on the seabed outside the aguas bravas and an anchor on each islet (seed ${seed})`, () => {
      const t = createTerrain(seed);
      const { islets, island } = coastFeatures(seed);
      const s = rescueSite(t, seed);
      expect(rescueSite(t, seed)).toEqual(s);
      expect(depthAt(t, s.cage.x, s.cage.z)).toBeGreaterThanOrEqual(2);
      expect(Math.hypot(s.cage.x - island.x, s.cage.z - island.z)).toBeGreaterThan(island.r + FISH.bravas);
      for (const o of islets) expect(Math.hypot(o.x - s.cage.x, o.z - s.cage.z)).toBeGreaterThanOrEqual(o.r + 6);
      expect(s.anchors).toHaveLength(3);
      s.anchors.forEach((a, i) => {
        expect(t.heightAt(a.x, a.z)).toBeGreaterThan(WATER_LEVEL);
        expect(Math.hypot(a.x - islets[i]!.x, a.z - islets[i]!.z)).toBeLessThan(islets[i]!.r);
      });
    });
  }

  it('sinks the cage with every broken anchor', () => {
    const t = createTerrain(7);
    const { cage } = rescueSite(t, 7);
    expect(cageY(t, cage, 1)).toBeLessThan(cageY(t, cage, 0) + 1e-9);
    expect(cageY(t, cage, 3)).toBeLessThan(cageY(t, cage, 1));
    expect(cageY(t, cage, 3)).toBeGreaterThan(t.heightAt(cage.x, cage.z));
  });
});
