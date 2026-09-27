import { describe, expect, it } from 'vitest';
import type { Terrain } from '../terrain';
import { createWolf, ENEMY, hitWolf, RAID, raiderDamage, stepRaider, stepWolf, WOLF, type RaidGoal, type WolfTarget } from './wolves';

const flat: Terrain = { heightAt: () => 0, density: () => 0.5 };
const rng = () => 0.5;
const target = (x: number, z = 0, extra: Partial<WolfTarget> = {}): WolfTarget => ({ name: 'Ana', x, z, dead: false, fires: false, ...extra });

describe('wolves', () => {
  it('chases the nearest player in sight', () => {
    const w = createWolf(1, 0, 0, flat, rng);
    stepWolf(w, [target(10)], flat, 0.1, rng);
    expect(w.target).toBe('Ana');
    expect(w.x).toBeGreaterThan(0);
    expect(w.anim).toBe('run');
  });

  it('ignores players out of sight', () => {
    const w = createWolf(1, 0, 0, flat, rng);
    stepWolf(w, [target(WOLF.sight + 5)], flat, 0.1, rng);
    expect(w.target).toBeNull();
    expect(w.anim).toBe('walk');
  });

  it('bites in reach, then waits for the cooldown', () => {
    const w = createWolf(1, 0, 0, flat, rng);
    const t = [target(1)];
    expect(stepWolf(w, t, flat, 0.1, rng)).toBe('Ana');
    expect(stepWolf(w, t, flat, 0.1, rng)).toBeNull();
    let bit: string | null = null;
    for (let i = 0; i < 20 && !bit; i++) bit = stepWolf(w, t, flat, 0.1, rng);
    expect(bit).toBe('Ana');
  });

  it('ignores dead players', () => {
    const w = createWolf(1, 0, 0, flat, rng);
    expect(stepWolf(w, [target(1, 0, { dead: true })], flat, 0.1, rng)).toBeNull();
    expect(w.target).toBeNull();
  });

  it('runs away from players at a fire', () => {
    const w = createWolf(1, 0, 0, flat, rng);
    stepWolf(w, [target(5, 0, { fires: true })], flat, 0.1, rng);
    expect(w.x).toBeLessThan(0);
    expect(w.target).toBeNull();
  });

  it('does not walk into deep water', () => {
    const lake: Terrain = { heightAt: (x) => (x > 1 ? -10 : 0), density: () => 0.5 };
    const w = createWolf(1, 0.9, 0, lake, rng);
    for (let i = 0; i < 10; i++) stepWolf(w, [target(10)], lake, 0.1, rng);
    expect(w.x).toBeLessThanOrEqual(1);
  });

  it('dies once', () => {
    const w = createWolf(1, 0, 0, flat, rng);
    expect(hitWolf(w, WOLF.hp - 1)).toBe(false);
    expect(hitWolf(w, 5)).toBe(true);
    expect(hitWolf(w, 5)).toBe(false);
    expect(w.anim).toBe('dead');
    expect(stepWolf(w, [target(1)], flat, 0.1, rng)).toBeNull();
  });
});

const goal = (extra: Partial<RaidGoal> = {}): RaidGoal => ({ heartId: 99, x: 0, z: 0, blockers: [], ...extra });
const raider = (x: number, z = 0) => {
  const w = createWolf(1, x, z, flat, rng);
  w.raid = true;
  return w;
};

describe('raiders', () => {
  it('march to the heart when no player is near', () => {
    const w = raider(30);
    stepRaider(w, [target(-50)], goal(), flat, 0.1, rng);
    expect(w.x).toBeLessThan(30);
    expect(w.anim).toBe('run');
  });

  it('chew the heart in reach, with a cooldown', () => {
    const w = raider(1);
    expect(stepRaider(w, [], goal(), flat, 0.1, rng)).toEqual({ structure: 99 });
    expect(stepRaider(w, [], goal(), flat, 0.1, rng)).toBeNull();
    let hit = null;
    for (let i = 0; i < 20 && !hit; i++) hit = stepRaider(w, [], goal(), flat, 0.1, rng);
    expect(hit).toEqual({ structure: 99 });
  });

  it('stop and chew a wall in the way', () => {
    const w = raider(10);
    const g = goal({ blockers: [{ id: 7, x: 9, z: 0 }] });
    expect(stepRaider(w, [], g, flat, 0.1, rng)).toEqual({ structure: 7 });
    expect(w.x).toBe(10);
  });

  it('turn on a nearby player and ignore campfire fear', () => {
    const w = raider(10);
    const hit = stepRaider(w, [target(11, 0, { fires: true })], goal(), flat, 0.1, rng);
    expect(w.target).toBe('Ana');
    expect(hit).toEqual({ player: 'Ana' });
  });

  it('ignore players beyond aggro range', () => {
    const w = raider(10);
    stepRaider(w, [target(10 + RAID.aggro + 5)], goal(), flat, 0.1, rng);
    expect(w.target).toBeNull();
  });
});

describe('enemy kinds', () => {
  it('brutes are tougher and slower than wolves', () => {
    const b = createWolf(2, 0, 0, flat, rng, 'brute');
    expect(b.kind).toBe('brute');
    expect(b.hp).toBe(ENEMY.brute.hp);
    expect(ENEMY.brute.hp).toBeGreaterThan(ENEMY.wolf.hp);
    stepWolf(b, [target(10)], flat, 0.1, rng);
    expect(b.x).toBeCloseTo(ENEMY.brute.run * 0.1);
    expect(raiderDamage(b)).toBe(ENEMY.brute.damage);
    expect(raiderDamage(createWolf(3, 0, 0, flat, rng))).toBe(RAID.damage);
  });
  it('a stunned enemy neither moves nor bites', () => {
    const w = createWolf(1, 0, 0, flat, rng);
    w.stun = 0.5;
    expect(stepWolf(w, [target(1)], flat, 0.1, rng)).toBeNull();
    expect(w.x).toBe(0);
    expect(w.stun).toBeCloseTo(0.4);
    for (let i = 0; i < 5; i++) stepWolf(w, [target(1)], flat, 0.1, rng);
    expect(w.stun).toBe(0);
    expect(stepWolf(w, [target(1)], flat, 0.1, rng)).toBe('Ana');
  });
});
