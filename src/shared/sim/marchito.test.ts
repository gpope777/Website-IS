import { describe, expect, it } from 'vitest';
import { createMarchito, joinNames, marchitoWill, MARCHITO, pickDefenses, stepMarchito, VISION, type MarchitoEvent } from './marchito';
import { ENEMY } from './wolves';

const heart = { x: 0, z: 0 };
const s = (id: number, kind: string, x: number) => ({ id, kind, x, z: 0 });
const flat = () => 0;
const player = (name: string, x: number, dead = false) => ({ name, x, z: 0, dead, fires: false });

function run(m: ReturnType<typeof createMarchito>, structs: { id: number; x: number; z: number }[], steps: number) {
  const ev: MarchitoEvent[] = [];
  for (let i = 0; i < steps; i++) {
    const e = stepMarchito(m, structs.filter((x) => m.prey.includes(x.id)), [], flat, 0.1);
    if (e) ev.push(e);
  }
  return ev;
}

describe('El Marchito', () => {
  it('picks the nearer half of the defenses, never the Heart', () => {
    expect(pickDefenses([s(1, 'heart', 0), s(2, 'wall', 3), s(3, 'wall', 9), s(4, 'spikes', 5), s(5, 'campfire', 20)], heart)).toEqual([2, 4]);
    expect(pickDefenses([s(1, 'wall', 4), s(2, 'wall', 8), s(3, 'wall', 12)], heart)).toEqual([1, 2]);
    expect(pickDefenses([s(1, 'heart', 0)], heart)).toEqual([]);
  });

  it('cannot be killed: its hp is voluntad, and it is its own kind', () => {
    const m = createMarchito(0, 0, 0, []);
    expect(m.id).toBe(MARCHITO.id);
    expect(m.kind).toBe('marchito');
    expect(m.hp).toBe(ENEMY.marchito.hp);
  });

  it('walks to its prey, smashes it after smashTime, then laughs and leaves', () => {
    const m = createMarchito(10, 0, 0, [7]);
    const ev = run(m, [{ id: 7, x: 0, z: 0 }], 200);
    expect(ev).toEqual([{ t: 'smash', id: 7 }, { t: 'laugh' }, { t: 'leave' }]);
  });

  it('does not smash before smashTime', () => {
    const m = createMarchito(1, 0, 0, [7]);
    expect(run(m, [{ id: 7, x: 0, z: 0 }], Math.floor(MARCHITO.smashTime / 0.1) - 1)).toEqual([]);
  });

  it('prey that is already gone is skipped', () => {
    const m = createMarchito(10, 0, 0, [7, 8]);
    const ev = run(m, [{ id: 8, x: 12, z: 0 }], 100);
    expect(ev[0]).toEqual({ t: 'smash', id: 8 });
  });

  it('swats a living player in reach, then waits its cooldown', () => {
    const m = createMarchito(0, 0, 0, []);
    m.laugh = 0;
    m.prey = [1];
    const structs = [{ id: 1, x: 50, z: 0 }];
    expect(stepMarchito(m, structs, [player('Ana', 1)], flat, 0.1)).toEqual({ t: 'swipe', name: 'Ana' });
    expect(stepMarchito(m, structs, [player('Ana', 1)], flat, 0.1)?.t).not.toBe('swipe');
    expect(stepMarchito(m, structs, [player('Leo', 1, true)], flat, ENEMY.marchito.biteCooldown)?.t).not.toBe('swipe');
  });

  it('a stunned Marchito does nothing', () => {
    const m = createMarchito(10, 0, 0, [7]);
    m.stun = 5;
    expect(stepMarchito(m, [{ id: 7, x: 0, z: 0 }], [player('Ana', 10)], flat, 0.1)).toBeNull();
    expect(m.x).toBe(10);
  });

  it('gives up and laughs after maxTime', () => {
    const m = createMarchito(0, 0, 0, [7]);
    m.age = MARCHITO.maxTime;
    expect(stepMarchito(m, [{ id: 7, x: 90, z: 0 }], [], flat, 0.1)).toEqual({ t: 'laugh' });
  });

  it('names read naturally, and visions name the players', () => {
    expect(joinNames(['Ana'])).toBe('Ana');
    expect(joinNames(['Ana', 'Leo'])).toBe('Ana y Leo');
    expect(joinNames(['Ana', 'Leo', 'Eva'])).toBe('Ana, Leo y Eva');
    expect(VISION.purified('Ana y Leo').join(' ')).toContain('Ana y Leo');
    expect(VISION.driven('Ana').join(' ')).toContain('Ana');
    expect(VISION.taunt('Leo')).toContain('Leo');
  });
  it('voluntad scales with 1–4 players and is what he arrives with', () => {
    expect([1, 2, 3, 4].map(marchitoWill)).toEqual([300, 420, 540, 660]);
    expect(marchitoWill(0)).toBe(300);
    expect(marchitoWill(9)).toBe(660);
    const m = createMarchito(0, 0, 0, [], marchitoWill(3));
    expect(m.hp).toBe(540);
    expect(m.max).toBe(540);
  });
});
