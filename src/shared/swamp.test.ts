import { describe, expect, it } from 'vitest';
import { clampMap, createTerrain, HALF, inMap, inRiver, LAGUNA, RIVER, SWAMP, swampFeatures, WATER_LEVEL } from './terrain';
import { generateCrags } from './crags';

const SEEDS = [1, 42, 777, 12345];
const depth = (t: ReturnType<typeof createTerrain>, x: number, z: number) => WATER_LEVEL - t.heightAt(x, z);

describe('swamp terrain', () => {
  it('joins the forest/coast edge without a step', () => {
    for (const s of SEEDS) {
      const t = createTerrain(s);
      for (let z = SWAMP.z0 + 20; z < SWAMP.z1 - 20; z += 17) {
        if (inRiver(-HALF, z)) continue;
        expect(Math.abs(t.heightAt(-HALF - 0.01, z) - t.heightAt(-HALF, z))).toBeLessThan(0.5);
      }
    }
  });

  it('is mostly ankle-deep bog, with a few pools no deeper than 1.6 m', () => {
    for (const s of SEEDS) {
      const t = createTerrain(s);
      const { mounds } = swampFeatures(s);
      let n = 0;
      let wading = 0;
      for (let x = SWAMP.x0 + 20; x < -HALF - 65; x += 7) {
        for (let z = SWAMP.z0 + 20; z < SWAMP.z1 - 20; z += 11) {
          if (mounds.some((m) => Math.hypot(m.x - x, m.z - z) < m.r + 1)) continue;
          if (Math.hypot((x - LAGUNA.x) / LAGUNA.rx, (z - LAGUNA.z) / LAGUNA.rz) < 1.05) continue;
          if (Math.abs(z - RIVER.z) < RIVER.half + RIVER.bank + 1) continue;
          const d = depth(t, x, z);
          n++;
          if (d >= 0.29 && d <= 0.6) wading++;
          expect(d).toBeLessThanOrEqual(1.6);
          expect(d).toBeGreaterThan(0);
        }
      }
      expect(wading / n).toBeGreaterThan(0.7);
    }
  });

  it('has a deep Laguna and a 16 m wide river at least 5 m deep from the Laguna to the sea', () => {
    for (const s of SEEDS) {
      const t = createTerrain(s);
      expect(depth(t, LAGUNA.x, LAGUNA.z)).toBeGreaterThan(7);
      expect(depth(t, LAGUNA.x, LAGUNA.z)).toBeLessThan(8.2);
      for (let x = -HALF - 110; x <= -HALF + 25; x += 3) {
        for (const dz of [-7, 0, 7]) expect(depth(t, x, RIVER.z + dz)).toBeGreaterThanOrEqual(4.99);
      }
    }
  });

  it('seeds 12 dry mounds in the interior, apart and out of the water', () => {
    for (const s of SEEDS) {
      const t = createTerrain(s);
      const { mounds } = swampFeatures(s);
      expect(swampFeatures(s)).toEqual({ mounds });
      expect(mounds).toHaveLength(12);
      for (const m of mounds) {
        expect(m.r).toBeGreaterThanOrEqual(6);
        expect(m.r).toBeLessThanOrEqual(15);
        expect(m.x - m.r).toBeGreaterThanOrEqual(-HALF - 160);
        expect(m.x + m.r).toBeLessThanOrEqual(-HALF - 70);
        expect(t.heightAt(m.x, m.z)).toBeGreaterThan(WATER_LEVEL);
        expect(inRiver(m.x, m.z)).toBe(false);
        for (const o of mounds) if (o !== m) expect(Math.hypot(o.x - m.x, o.z - m.z)).toBeGreaterThan(o.r + m.r);
      }
    }
  });

  it('has dry rims', () => {
    for (const s of SEEDS) {
      const t = createTerrain(s);
      for (let z = SWAMP.z0 + 10; z < SWAMP.z1 - 10; z += 20) expect(t.heightAt(SWAMP.x0 + 3, z)).toBeGreaterThan(WATER_LEVEL);
      for (let x = SWAMP.x0 + 10; x < -HALF - 15; x += 20) {
        expect(t.heightAt(x, SWAMP.z0 + 3)).toBeGreaterThan(WATER_LEVEL);
        expect(t.heightAt(x, SWAMP.z1 - 3)).toBeGreaterThan(WATER_LEVEL);
      }
    }
  });

  it('bounds are the union of the main map and the swamp', () => {
    expect(inMap(-HALF - 100, 200, 2)).toBe(true);
    expect(inMap(-HALF - 100, 20, 2)).toBe(false);
    expect(inMap(-HALF - 1, 100, 2)).toBe(true);
    expect(inMap(-HALF - 1, 0, 2)).toBe(false);
    expect(clampMap(-HALF - 300, 100, 3)).toEqual({ x: SWAMP.x0 + 3, z: 100 });
    expect(clampMap(-HALF - 50, 10, 3)).toEqual({ x: -HALF - 50, z: SWAMP.z0 + 3 });
    expect(clampMap(-HALF - 5, -100, 3)).toEqual({ x: -HALF + 3, z: -100 });
    expect(clampMap(-HALF - 5, 100, 3)).toEqual({ x: -HALF - 5, z: 100 });
  });

  it('keeps crags 64 m from the west edge (no gliding over el Zarzal)', () => {
    for (const s of SEEDS) for (const c of generateCrags(createTerrain(s), s)) expect(c.x).toBeGreaterThan(-HALF + 64);
  });
});
