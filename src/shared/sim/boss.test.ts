import { describe, expect, it } from 'vitest';
import { DUNGEON, inBossRoom } from '../dungeon';
import { BOSS, createBoss, stepBoss } from './boss';
import { ENEMY } from './wolves';

const t = (x: number, z: number, dead = false) => ({ name: 'Ana', x, z, dead, fires: false });

describe('stepBoss', () => {
  it('starts in the boss room with full HP', () => {
    const b = createBoss();
    expect(b).toMatchObject({ id: BOSS.id, kind: 'boss', hp: ENEMY.boss.hp, x: DUNGEON.x, z: DUNGEON.bossZ, y: DUNGEON.floor });
  });

  it('walks up, winds up, then bites if you are still there', () => {
    const b = createBoss();
    for (let i = 0; i < 5; i++) expect(stepBoss(b, [t(DUNGEON.x, DUNGEON.bossZ - 10)], 0.1)).toBeNull();
    expect(b.z).toBeLessThan(DUNGEON.bossZ);
    expect(b.anim).toBe('run');
    const near = [t(b.x, b.z - 2)];
    expect(stepBoss(b, near, 0.1)).toBeNull();
    expect(b.anim).toBe('attack');
    let bit: string | null = null;
    let ticks = 0;
    while (!bit && ticks < 20) {
      bit = stepBoss(b, near, 0.1);
      ticks++;
    }
    expect(bit).toBe('Ana');
    expect(ticks).toBeGreaterThanOrEqual(Math.round(BOSS.windup / 0.1) - 1);
    // cooldown before the next wind-up
    expect(stepBoss(b, near, 0.1)).toBeNull();
    expect(b.windup).toBe(0);
  });

  it('misses when you step away during the wind-up', () => {
    const b = createBoss();
    stepBoss(b, [t(b.x, b.z - 2)], 0.1);
    const far = [t(b.x, b.z - 12)];
    let bit: string | null = null;
    for (let i = 0; i < 10; i++) bit = bit ?? stepBoss(b, far, 0.1);
    expect(bit).toBeNull();
  });

  it('a rooted or stunned boss neither moves nor bites, and weakness wears off', () => {
    const b = createBoss();
    b.rooted = 1;
    b.weak = 1;
    for (let i = 0; i < 5; i++) expect(stepBoss(b, [t(b.x, b.z - 2)], 0.1)).toBeNull();
    expect(b.z).toBe(DUNGEON.bossZ);
    expect(b.weak).toBeCloseTo(0.5);
    b.stun = 0.3;
    expect(stepBoss(b, [t(b.x, b.z - 2)], 0.1)).toBeNull();
    expect(b.windup).toBe(0);
  });

  it('ignores the dead and stays inside the boss room', () => {
    const b = createBoss();
    stepBoss(b, [t(b.x, b.z - 2, true)], 0.1);
    expect(b.anim).toBe('idle');
    for (let i = 0; i < 200; i++) stepBoss(b, [t(DUNGEON.x, DUNGEON.altarZ)], 0.1);
    expect(inBossRoom(b.x, b.z)).toBe(true);
  });

  it('dead bosses only count corpse time', () => {
    const b = createBoss();
    b.hp = 0;
    stepBoss(b, [t(b.x, b.z - 2)], 0.5);
    expect(b.deadFor).toBe(0.5);
    expect(b.anim).toBe('dead');
  });
});
