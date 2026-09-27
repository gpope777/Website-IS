import { describe, expect, it } from 'vitest';
import { coastFeatures, createTerrain, HALF, WATER_LEVEL } from './terrain';
import { CHEST, COAST_SHRINE, generateChests, generateCoastShrines } from './coast-shrines';
import { depthAt } from './coast';
import { FISH } from './fish';

const dry = (t: ReturnType<typeof createTerrain>, p: { x: number; z: number }) => t.heightAt(p.x, p.z) >= WATER_LEVEL + 0.3;

describe('coast shrines', () => {
  for (const seed of [1, 7, 42, 1234]) {
    it(`places Marea, Hundido and Islote (seed ${seed})`, () => {
      const t = createTerrain(seed);
      const s = generateCoastShrines(t, seed);
      expect(s).toEqual(generateCoastShrines(t, seed));
      expect(s.map((x) => [x.id, x.kind])).toEqual([[3, 'tide'], [4, 'sunken'], [5, 'fan']]);
      const [tide, sunken, fan] = s as [(typeof s)[0], (typeof s)[0], (typeof s)[0]];
      for (const p of [tide, ...tide.parts]) {
        expect(dry(t, p)).toBe(true);
        expect(p.z).toBeGreaterThan(HALF + 20);
        expect(p.z).toBeLessThan(HALF + 50);
      }
      expect(Math.hypot(tide.parts[0]!.x - tide.x, tide.parts[0]!.z - tide.z)).toBeCloseTo(COAST_SHRINE.tideDist, 5);
      expect(dry(t, sunken)).toBe(true);
      expect(dry(t, sunken.parts[0]!)).toBe(true);
      const bed = sunken.parts[1]!;
      expect(depthAt(t, bed.x, bed.z)).toBeGreaterThanOrEqual(2);
      expect(depthAt(t, bed.x, bed.z)).toBeLessThanOrEqual(4);
      const gap = Math.hypot(bed.x - sunken.parts[0]!.x, bed.z - sunken.parts[0]!.z);
      expect(gap).toBeGreaterThanOrEqual(30);
      expect(gap).toBeLessThanOrEqual(50);
      expect(Math.hypot(tide.x - sunken.x, tide.z - sunken.z)).toBeGreaterThan(40);
      const islet = coastFeatures(seed).islets[0]!;
      expect(Math.hypot(fan.x - islet.x, fan.z - islet.z)).toBeLessThan(1e-6);
      expect(fan.parts).toHaveLength(3);
      for (const p of [fan, ...fan.parts]) expect(dry(t, p)).toBe(true);
    });

    it(`sinks 6 chests in the deep sea (seed ${seed})`, () => {
      const t = createTerrain(seed);
      const { islets, island } = coastFeatures(seed);
      const c = generateChests(t, seed);
      expect(c).toEqual(generateChests(t, seed));
      expect(c).toHaveLength(CHEST.count);
      c.forEach((ch, i) => {
        expect(ch.id).toBe(i);
        expect(ch.z).toBeGreaterThan(HALF + 110);
        expect(depthAt(t, ch.x, ch.z)).toBeGreaterThanOrEqual(6);
        expect(ch.y).toBeCloseTo(t.heightAt(ch.x, ch.z), 5);
        for (const o of islets) expect(Math.hypot(o.x - ch.x, o.z - ch.z)).toBeGreaterThan(o.r + 5);
        expect(Math.hypot(island.x - ch.x, island.z - ch.z)).toBeGreaterThan(island.r + FISH.bravas);
        expect(ch.loot.pearl).toBe(1);
        const mats = Object.entries(ch.loot).filter(([k]) => k !== 'pearl');
        expect(mats).toHaveLength(1);
        expect(mats[0]![1]).toBeGreaterThanOrEqual(6);
        expect(mats[0]![1]).toBeLessThanOrEqual(10);
      });
    });
  }
});
