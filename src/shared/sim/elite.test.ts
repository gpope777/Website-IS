import { describe, expect, it } from 'vitest';
import { DUNGEON } from '../dungeon';
import { createElite, ELITE, stepElite } from './elite';
import { ENEMY } from './wolves';

const t = (x: number, z: number, dead = false) => ({ name: 'Ana', x, z, dead, fires: false });

describe('stepElite (bruto reforzado)', () => {
  it('starts in its room with more HP than a brute', () => {
    const e = createElite();
    expect(e).toMatchObject({ id: ELITE.id, kind: 'elite', z: DUNGEON.eliteZ, hp: ENEMY.elite.hp });
    expect(ENEMY.elite.hp).toBeGreaterThan(ENEMY.brute.hp * 2);
  });

  it('telegraphs a charge from mid range, then runs straight and hits once', () => {
    const e = createElite();
    e.chargeReady = 0;
    const me = t(e.x, e.z - 9);
    expect(stepElite(e, [me], 0.1)).toBeNull();
    expect(e.windup).toBeGreaterThan(0);
    expect(e.anim).toBe('attack');
    const z0 = e.z;
    // the wind-up is long enough to read and react
    let ticks = 0;
    while (e.windup > 0) {
      expect(stepElite(e, [me], 0.1)).toBeNull();
      ticks++;
    }
    expect(ticks).toBeGreaterThanOrEqual(10);
    expect(e.z).toBe(z0); // it does not creep during the telegraph
    const hits = [];
    for (let i = 0; i < 12; i++) {
      const h = stepElite(e, [me], 0.1);
      if (h) hits.push(h);
    }
    expect(hits).toEqual([{ name: 'Ana', dmg: ELITE.chargeDamage }]);
    expect(e.chargeReady).toBeGreaterThan(0);
  });

  it('a charge locked on where you were misses if you step aside', () => {
    const e = createElite();
    e.chargeReady = 0;
    stepElite(e, [t(e.x, e.z - 9)], 0.1);
    const aside = t(e.x + 6, e.z - 9);
    const hits = [];
    for (let i = 0; i < 25; i++) {
      const h = stepElite(e, [aside], 0.1);
      if (h && e.windup === 0 && e.charge > 0) hits.push(h);
    }
    expect(hits).toEqual([]);
  });

  it('bites in reach like a brute, with a cooldown', () => {
    const e = createElite();
    const me = [t(e.x, e.z - 1)];
    expect(stepElite(e, me, 0.1)).toEqual({ name: 'Ana', dmg: ENEMY.elite.damage });
    expect(stepElite(e, me, 0.1)).toBeNull();
  });

  it('a stun cancels the wind-up', () => {
    const e = createElite();
    e.chargeReady = 0;
    stepElite(e, [t(e.x, e.z - 9)], 0.1);
    e.stun = 1;
    stepElite(e, [t(e.x, e.z - 9)], 0.1);
    expect(e.windup).toBe(0);
    expect(e.charge).toBe(0);
  });
});
