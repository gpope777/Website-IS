import { describe, expect, it } from 'vitest';
import { createTerrain, WATER_LEVEL } from './terrain';
import { clampCoast, coastEntrance, coastFloor, COAST_DUNGEON as C, inChasm, inCoastDungeon } from './coast-dungeon';
import { clampStep, DUNGEON, inAnyDungeon, inDungeon, withDungeon } from './dungeon';

const X = C.x;
const shut = [false, false, false, false];

describe('coast dungeon', () => {
  it('is its own interior, apart from the forest one', () => {
    expect(inCoastDungeon(X, C.entryZ)).toBe(true);
    expect(inDungeon(X, C.entryZ)).toBe(false);
    expect(inCoastDungeon(DUNGEON.x, 40)).toBe(false);
    expect(inAnyDungeon(X, 40) && inAnyDungeon(DUNGEON.x, 40)).toBe(true);
    expect(inAnyDungeon(0, 0)).toBe(false);
  });

  it('has a flat floor with a 20 m chasm', () => {
    expect(coastFloor(X, 40)).toBe(C.floor);
    expect(coastFloor(X, 106)).toBe(C.floor - C.pitDepth);
    expect(inChasm(X, 106)).toBe(true);
    const t = withDungeon(createTerrain(3));
    expect(t.heightAt(X, 106)).toBe(C.floor - C.pitDepth);
    expect(t.heightAt(X + C.halfW + 5, 40)).toBe(C.floor);
  });

  it('walls, shut gates and the channel stop you; the bridge and open gates do not', () => {
    expect(clampCoast(X, 10, X + 50, 10, shut).x).toBeCloseTo(X + C.halfW - 0.5);
    expect(clampCoast(X, 31, X, 33, shut).z).toBeCloseTo(31.5);
    expect(clampCoast(X, 31, X, 33, [true, false, false, false]).z).toBe(33);
    const [c0, c1] = C.channel;
    expect(clampCoast(X, c0 - 0.5, X, c0 + 0.5, shut).z).toBe(c0);
    expect(clampCoast(X, c1 + 0.5, X, c1 - 0.5, shut).z).toBe(c1);
    const bridge = X - 10.5;
    expect(clampCoast(bridge, c0 - 0.5, bridge, c0 + 0.5, shut)).toEqual({ x: bridge, z: c0 + 0.5 });
    expect(clampCoast(bridge, 70, X, 70, shut).x).toBeCloseTo(X + C.bridgeX);
    expect(clampStep(X, 31, X, 33, [true, true, true, true, true], shut).z).toBeCloseTo(31.5);
  });

  it('the trunk stands on dry ground on the dungeon island', () => {
    for (const seed of [1, 2, 3, 42]) {
      const e = coastEntrance(seed);
      expect(createTerrain(seed).heightAt(e.x, e.z)).toBeGreaterThan(WATER_LEVEL + 0.5);
    }
  });
});
