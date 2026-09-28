import { describe, expect, it } from 'vitest';
import { FRONT_CORRUPT, FRONT_HEALED, HEAL, HealWaves } from './heal';

const zone = (id: number) => ({ id, x: 0, z: 0, r: 20 });

describe('HealWaves', () => {
  it('zones clean on arrival are healed at once; corrupt ones stay corrupt', () => {
    const h = new HealWaves();
    h.sync([2], false, 0);
    expect(h.front(zone(1), 0)).toBe(FRONT_HEALED);
    expect(h.front(zone(2), 0)).toBe(FRONT_CORRUPT);
    expect(h.purify(0)).toBe(0);
  });

  it('a zone cleansed while you watch heals as a wave in 20 s', () => {
    const h = new HealWaves();
    h.sync([2], false, 0);
    h.sync([], false, 100);
    expect(h.front(zone(2), 100)).toBe(0);
    expect(h.busy).toBe(true);
    expect(h.front(zone(2), 100 + HEAL.secs / 2)).toBeCloseTo((20 + HEAL.pad) / 2, 5);
    expect(h.front(zone(2), 100 + HEAL.secs + 0.1)).toBe(FRONT_HEALED);
    expect(h.busy).toBe(false);
  });

  it('a zone that goes corrupt again is corrupt', () => {
    const h = new HealWaves();
    h.sync([2], false, 0);
    h.sync([], false, 1);
    h.sync([2], false, 2);
    expect(h.front(zone(2), 3)).toBe(FRONT_CORRUPT);
  });

  it('El Marchito falling live: every zone waves and las Tierras purify in 60 s', () => {
    const h = new HealWaves();
    h.sync([1, 2, 18], false, 0);
    h.sync([], true, 10);
    for (const id of [1, 2, 18]) expect(h.front(zone(id), 10)).toBe(0);
    expect(h.purify(10)).toBe(0);
    expect(h.purify(10 + HEAL.purifySecs / 2)).toBeCloseTo(0.5, 5);
    expect(h.purify(10 + HEAL.purifySecs)).toBe(1);
  });

  it('arriving after the ending: purified at once', () => {
    const h = new HealWaves();
    h.sync([], true, 50);
    expect(h.purify(50)).toBe(1);
    expect(h.front(zone(18), 50)).toBe(FRONT_HEALED);
  });
});
