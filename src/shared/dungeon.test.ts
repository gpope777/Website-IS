import { describe, expect, it } from 'vitest';
import { createTerrain, HALF, WATER_LEVEL } from './terrain';
import { generateCrags } from './crags';
import { generateShrines } from './shrines';
import { clampStep, DUNGEON, generateEntrance, inBossRoom, inEliteRoom, inDungeon, leverPos, withDungeon } from './dungeon';

describe('dungeon', () => {
  it('the interior lies outside the map and has a flat floor', () => {
    const t = withDungeon(createTerrain(1));
    expect(DUNGEON.x - DUNGEON.halfW).toBeGreaterThan(HALF + 50);
    expect(t.heightAt(DUNGEON.x, 40)).toBe(DUNGEON.floor);
    expect(t.heightAt(DUNGEON.x + DUNGEON.halfW + DUNGEON.pad - 1, 40)).toBe(DUNGEON.floor);
    expect(t.heightAt(0, 0)).toBe(createTerrain(1).heightAt(0, 0));
    expect(inDungeon(DUNGEON.x, 50)).toBe(true);
    expect(inDungeon(0, 0)).toBe(false);
    expect(inBossRoom(DUNGEON.x, DUNGEON.bossZ)).toBe(true);
    expect(inBossRoom(DUNGEON.x, DUNGEON.altarZ)).toBe(false);
    expect(inDungeon(leverPos(0).x, leverPos(0).z)).toBe(true);
    expect(leverPos(1).z).toBeLessThan(DUNGEON.gateZ);
  });

  it('walls and the closed gate stop you; the open gate lets you through', () => {
    const X = DUNGEON.x;
    // Signature change (cierre S1): one flag per gate instead of a single boolean.
    const shut = [false, false, false, false, false];
    const open0 = [true, false, false, false, false];
    expect(clampStep(X, 10, X + 50, 10, shut).x).toBeCloseTo(X + DUNGEON.halfW - 0.5);
    expect(clampStep(X, 10, X, -5, shut).z).toBeCloseTo(DUNGEON.z0 + 0.5);
    expect(clampStep(X, DUNGEON.gateZ - 1, X, DUNGEON.gateZ + 1, shut).z).toBeCloseTo(DUNGEON.gateZ - 0.5);
    expect(clampStep(X, DUNGEON.gateZ - 1, X, DUNGEON.gateZ + 1, open0).z).toBe(DUNGEON.gateZ + 1);
    expect(clampStep(X, DUNGEON.gateZ + 2, X, DUNGEON.gateZ + 1, shut).z).toBe(DUNGEON.gateZ + 1);
    expect(clampStep(0, 0, HALF + 5, 0, shut).x).toBe(HALF - 3);
    expect(clampStep(0, 0, 1, 2, shut)).toEqual({ x: 1, z: 2 });
  });

  it('every gate blocks both ways while shut', () => {
    const X = DUNGEON.x;
    DUNGEON.gatesZ.forEach((g, i) => {
      const gates = DUNGEON.gatesZ.map((_, k) => k !== i);
      expect(clampStep(X, g - 1, X, g + 1, gates).z).toBeCloseTo(g - 0.5);
      expect(clampStep(X, g + 1, X, g - 1, gates).z).toBeCloseTo(g + 0.5);
      expect(clampStep(X, g - 1, X, g + 1, DUNGEON.gatesZ.map(() => true)).z).toBe(g + 1);
    });
    expect([...DUNGEON.gatesZ].sort((a, b) => a - b)).toEqual([...DUNGEON.gatesZ]);
    expect(DUNGEON.gatesZ[0]).toBe(DUNGEON.gateZ);
    expect(DUNGEON.gatesZ[4]).toBe(DUNGEON.bossRoomZ);
    expect(inEliteRoom(DUNGEON.x, DUNGEON.eliteZ)).toBe(true);
    expect(inBossRoom(DUNGEON.x, DUNGEON.eliteZ)).toBe(false);
  });

  for (const seed of [1, 7, 42, 1234]) {
    it(`places the Raíz-madre on dry land away from crags and shrines (seed ${seed})`, () => {
      const t = createTerrain(seed);
      const crags = generateCrags(t, seed);
      const shrines = generateShrines(t, seed, crags);
      const e = generateEntrance(t, seed, crags, shrines);
      expect(e).toEqual(generateEntrance(t, seed, crags, shrines));
      expect(Math.hypot(e.x, e.z)).toBeGreaterThanOrEqual(DUNGEON.minDist - 1e-6);
      expect(Math.abs(e.x)).toBeLessThan(HALF - 20);
      expect(Math.abs(e.z)).toBeLessThan(HALF - 20);
      expect(t.heightAt(e.x, e.z)).toBeGreaterThan(WATER_LEVEL);
      expect(e.y).toBe(t.heightAt(e.x, e.z));
      for (const c of crags) expect(Math.hypot(c.x - e.x, c.z - e.z)).toBeGreaterThan(DUNGEON.clear);
      for (const s of shrines) expect(Math.hypot(s.x - e.x, s.z - e.z)).toBeGreaterThan(DUNGEON.clear);
    });
  }
});
