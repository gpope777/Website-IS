import { describe, expect, it } from 'vitest';
import {
  RECIPES,
  add,
  ambientWarmth,
  canCraft,
  consume,
  craft,
  createStats,
  isDead,
  isNight,
  remove,
  tick,
  type Environment,
} from './survival';

const calm: Environment = { dayFraction: 0.5, nearFire: false, sheltered: false, moving: false, sprinting: false };

describe('tick', () => {
  it('drains hunger and thirst over time', () => {
    const s = tick(createStats(), calm, 60);
    expect(s.hunger).toBeLessThan(100);
    expect(s.thirst).toBeLessThan(100);
    expect(s.health).toBe(100);
  });

  it('sprinting drains faster than walking, which drains faster than resting', () => {
    const rest = tick(createStats(), calm, 30);
    const walk = tick(createStats(), { ...calm, moving: true }, 30);
    const run = tick(createStats(), { ...calm, moving: true, sprinting: true }, 30);
    expect(walk.hunger).toBeLessThan(rest.hunger);
    expect(run.hunger).toBeLessThan(walk.hunger);
    expect(run.energy).toBeLessThan(walk.energy);
  });

  it('loses warmth at night without fire, keeps it near fire', () => {
    const night: Environment = { ...calm, dayFraction: 0.05 };
    const cold = tick(createStats(), night, 60);
    const warm = tick(createStats(), { ...night, nearFire: true }, 60);
    expect(cold.warmth).toBeLessThan(100);
    expect(warm.warmth).toBe(100);
  });

  it('shelter reduces cold exposure', () => {
    const night: Environment = { ...calm, dayFraction: 0.05 };
    const open = tick(createStats(), night, 60);
    const inside = tick(createStats(), { ...night, sheltered: true }, 60);
    expect(inside.warmth).toBeGreaterThan(open.warmth);
  });

  it('takes damage when starving and eventually dies', () => {
    let s = { ...createStats(), hunger: 0, thirst: 0 };
    for (let i = 0; i < 600; i++) s = tick(s, calm, 1);
    expect(isDead(s)).toBe(true);
  });

  it('regenerates health when well fed', () => {
    const s = tick({ ...createStats(), health: 50 }, calm, 30);
    expect(s.health).toBeGreaterThan(50);
  });

  it('never lets stats leave 0..100', () => {
    let s = createStats();
    for (let i = 0; i < 5000; i++) s = tick(s, { ...calm, dayFraction: (i / 5000) % 1, sprinting: true, moving: true }, 1);
    for (const v of Object.values(s)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe('day cycle', () => {
  it('classifies night and day', () => {
    expect(isNight(0)).toBe(true);
    expect(isNight(0.5)).toBe(false);
    expect(isNight(0.9)).toBe(true);
    expect(isNight(1.5)).toBe(false);
  });
  it('is warmer at midday than at 3am', () => {
    expect(ambientWarmth(0.6)).toBeGreaterThan(ambientWarmth(0.12));
  });
});

describe('inventory and crafting', () => {
  it('adds and removes items immutably', () => {
    const a = add({}, 'wood', 3);
    const b = remove(a, 'wood', 2);
    expect(a.wood).toBe(3);
    expect(b?.wood).toBe(1);
    expect(remove(b!, 'wood', 5)).toBeNull();
    expect(remove(b!, 'wood', 1)).toEqual({});
  });

  it('crafts an axe only with enough materials', () => {
    const axe = RECIPES.find((r) => r.id === 'axe')!;
    expect(canCraft({ wood: 1 }, axe)).toBe(false);
    const inv = { wood: 2, stone: 2, fiber: 1, berries: 1 };
    const out = craft(inv, axe);
    expect(out).toEqual({ berries: 1, axe: 1 });
  });

  it('consumes food and water', () => {
    const s = { ...createStats(), hunger: 50, thirst: 50 };
    const r = consume(s, { berries: 1, water: 1 }, 'berries')!;
    expect(r.stats.hunger).toBe(68);
    expect(r.inv).toEqual({ water: 1 });
    expect(consume(s, {}, 'berries')).toBeNull();
    expect(consume(s, { wood: 1 }, 'wood')).toBeNull();
  });
});

it('house recipe consumes wood, stone and fiber', () => {
  const house = RECIPES.find((r) => r.id === 'house')!;
  expect(canCraft({ wood: 20, stone: 8, fiber: 6 }, house)).toBe(true);
  expect(canCraft({ wood: 20, stone: 7, fiber: 6 }, house)).toBe(false);
  expect(craft({ wood: 21, stone: 8, fiber: 6 }, house)).toEqual({ wood: 1, house: 1 });
});
