import { describe, expect, it } from 'vitest';
import { FISH, fishFloor, fishRings, fishStepOk, inBravas, wildFish } from './fish';
import { coastFeatures, createTerrain, HALF, WATER_LEVEL } from './terrain';
import { depthAt } from './coast';

const SEEDS = [1, 42, 777, 123456];

describe('the giant fish', () => {
  it('waits in the shallows, swimmable on foot', () => {
    for (const s of SEEDS) {
      const t = createTerrain(s);
      const f = wildFish(t, s);
      expect(f.z).toBeGreaterThan(HALF + 50);
      expect(f.z).toBeLessThan(HALF + 90);
      const d = depthAt(t, f.x, f.z);
      expect(d).toBeGreaterThanOrEqual(1.5);
      expect(d).toBeLessThanOrEqual(3.5);
      expect(wildFish(t, s)).toEqual(f);
    }
  });

  it('lays 6 rings 10–14 m apart in swimmable shallows', () => {
    for (const s of SEEDS) {
      const t = createTerrain(s);
      const home = wildFish(t, s);
      const rings = fishRings(t, s, home);
      expect(rings).toHaveLength(FISH.rings);
      let prev = home;
      for (const r of rings) {
        const gap = Math.hypot(r.x - prev.x, r.z - prev.z);
        expect(gap).toBeGreaterThanOrEqual(FISH.ringGap[0] - 1e-9);
        expect(gap).toBeLessThanOrEqual(FISH.ringGap[1] + 1e-9);
        const d = depthAt(t, r.x, r.z);
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(3.5);
        prev = r;
      }
      expect(fishRings(t, s, home)).toEqual(rings);
    }
  });

  it('keeps out of the aguas bravas, the beach and the Ciénaga', () => {
    const s = 42;
    const t = createTerrain(s);
    const { island } = coastFeatures(s);
    expect(inBravas(island, island.x + island.r + 10, island.z)).toBe(true);
    expect(inBravas(island, island.x + island.r + 40, island.z)).toBe(false);
    expect(fishStepOk(t, island, island.x, island.z - island.r - 10)).toBe(false);
    expect(fishStepOk(t, island, 0, HALF + 5)).toBe(false); // Ciénaga
    expect(fishStepOk(t, island, 0, HALF + 30)).toBe(false); // beach
    const home = wildFish(t, s);
    expect(fishStepOk(t, island, home.x, home.z)).toBe(true);
    const deep = { x: island.x > 0 ? island.x - 120 : island.x + 120, z: HALF + 100 };
    expect(fishStepOk(t, island, deep.x, deep.z)).toBe(true);
    expect(fishFloor(t, deep.x, deep.z)).toBeLessThan(WATER_LEVEL - 4);
  });
});

describe('P7-E balance', () => {
  it('8 s between rings: the widest gap, swum plainly (2.2 m/s), leaves > 2 s to turn', async () => {
    const { FISH } = await import('./fish');
    const { SPEED } = await import('../client/movement');
    expect(FISH.ringTime).toBe(8);
    expect(FISH.ringTime - (FISH.ringGap[1] - FISH.ringR) / SPEED.swim).toBeGreaterThan(2);
  });
});
