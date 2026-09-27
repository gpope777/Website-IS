import { describe, expect, it } from 'vitest';
import { createTerrain, WATER_LEVEL } from './terrain';
import { clampSwampDungeon, inMud, inMudPool, inSwampDungeon, plankAt, plankCrags, swampEntrance, swampFloor, SWAMP_DUNGEON as S } from './swamp-dungeon';
import { clampStep, inAnyDungeon, inDungeon, withDungeon } from './dungeon';
import { inCoastDungeon } from './coast-dungeon';

const X = S.x;
const shut = [false, false, false, false];

describe('swamp dungeon', () => {
  it('is its own interior', () => {
    expect(inSwampDungeon(X, S.entryZ)).toBe(true);
    expect(inDungeon(X, S.entryZ) || inCoastDungeon(X, S.entryZ)).toBe(false);
    expect(inAnyDungeon(X, 40)).toBe(true);
  });

  it('has a flat floor and a mud strip under the boardwalk', () => {
    expect(swampFloor(X, 40)).toBe(S.floor);
    expect(swampFloor(X + 5, 100)).toBe(S.floor - S.mudDepth);
    expect(inMud(X, 100)).toBe(true);
    const t = withDungeon(createTerrain(3));
    expect(t.heightAt(X + 5, 100)).toBe(S.floor - S.mudDepth);
    expect(t.heightAt(X + S.halfW + 5, 40)).toBe(S.floor);
  });

  it('finds the plank underfoot and lists the planks still up', () => {
    expect(plankAt(X, S.mud[0] + 0.5)).toBe(0);
    expect(plankAt(X, S.mud[1] - 0.5)).toBe(S.planks - 1);
    expect(plankAt(X + 3, 100)).toBe(-1);
    const up = Array.from({ length: S.planks }, (_, i) => i !== 2);
    const crags = plankCrags(up);
    expect(crags).toHaveLength(S.planks - 1);
    expect(crags.every((c) => c.top === S.floor && c.bare)).toBe(true);
  });

  it('knows its mud pools', () => {
    expect(inMudPool(X + S.pools[0].x, S.pools[0].z)).toBe(true);
    expect(inMudPool(X, 140 - 12)).toBe(false);
  });

  it('walls and shut gates stop you; open gates do not', () => {
    expect(clampSwampDungeon(X, 10, X + 50, 10, shut).x).toBeCloseTo(X + S.halfW - 0.5);
    expect(clampSwampDungeon(X, 55, X, 57, shut).z).toBeCloseTo(55.5);
    expect(clampSwampDungeon(X, 55, X, 57, [true, true, false, false]).z).toBe(57);
    expect(clampStep(X, 55, X, 57, [], [], shut).z).toBeCloseTo(55.5);
  });

  it('enters from the Laguna, in deep water', () => {
    const e = swampEntrance();
    expect(createTerrain(7).heightAt(e.x, e.z)).toBeLessThan(WATER_LEVEL - 4);
  });
});
