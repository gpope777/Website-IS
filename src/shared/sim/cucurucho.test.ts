import { describe, expect, it } from 'vitest';
import { MOUNTAIN_DUNGEON as M } from '../mountain-dungeon';
import { ATALAYA, createAtalaya, createCucurucho, CUCURUCHO, hatFront, stepAtalaya, stepCucurucho, type Cucurucho } from './cucurucho';
import { createWolf, ENEMY, type WolfTarget } from './wolves';

const at = (name: string, x: number, z: number): WolfTarget => ({ name, x, z, dead: false, fires: false });
const run = (b: Cucurucho, ts: WolfTarget[], secs: number, pillars: { x: number; z: number }[] = []) => {
  const hits: { name: string; dmg: number; charge: boolean }[] = [];
  let stuck = false;
  for (let t = 0; t < secs - 1e-9; t += 0.05) {
    const r = stepCucurucho(b, ts, pillars, 0.05);
    hits.push(...r.hits);
    stuck ||= r.stuck;
  }
  return { hits, stuck };
};
const quiet = (b: Cucurucho) => Object.assign(b, { aludIn: 999, chargeReady: 0 });

describe('El Cucurucho', () => {
  it('waits in the boss room with 420 PV', () => {
    const b = createCucurucho();
    expect(b).toMatchObject({ id: CUCURUCHO.id, kind: 'boss4', hp: 420, x: M.x });
    expect(b.z).toBeGreaterThan(M.bossRoomZ);
  });

  it('its hat covers the front until it is stuck', () => {
    const b = createCucurucho();
    b.yaw = 0; // facing +z
    expect(hatFront(b, b.x, b.z + 2)).toBe(true);
    expect(hatFront(b, b.x, b.z - 2)).toBe(false);
    b.exposed = 1;
    expect(hatFront(b, b.x, b.z + 2)).toBe(false);
  });

  it('winds up 1 s, then charges at 14 m/s and hits once for 25', () => {
    const b = quiet(createCucurucho());
    const t = at('ana', M.x, b.z - 10);
    run(b, [t], 0.05);
    expect(b.windup).toBeGreaterThan(0);
    const z0 = b.z;
    run(b, [t], CUCURUCHO.windup);
    expect(b.z).toBeCloseTo(z0, 5);
    const { hits } = run(b, [t], 1);
    expect(hits).toEqual([{ name: 'ana', dmg: 25, charge: true }]);
  });

  it('a pillar in its path sticks the hat for 5 s', () => {
    const b = quiet(createCucurucho());
    const t = at('ana', M.x, b.z - 12);
    const pillar = { x: M.x, z: b.z - 6 };
    const { hits, stuck } = run(b, [t], 2, [pillar]);
    expect(stuck).toBe(true);
    expect(hits).toEqual([]);
    expect(b.exposed).toBeGreaterThan(3);
    expect(hatFront(b, b.x, b.z - 2)).toBe(false);
  });

  it('the wall stops the charge without sticking it', () => {
    const b = quiet(createCucurucho());
    b.z = M.bossRoomZ + 8;
    run(b, [at('far', M.x, M.bossRoomZ + 0.5)], 0.05); // aims at a spot past the wall
    const r = run(b, [], 2.5);
    expect(r.stuck).toBe(false);
    expect(b.exposed).toBe(0);
    expect(b.charge).toBe(0);
  });

  it('pokes 8 every 4 s up close instead of charging', () => {
    const b = quiet(createCucurucho());
    const { hits } = run(b, [at('ana', M.x, b.z - 2)], 8.3);
    expect(hits.every((h) => h.dmg === 8 && !h.charge)).toBe(true);
    expect(hits.length).toBe(3);
  });

  it('the alud marks 4 circles, then hits those on them; a pillar blocks its circle', () => {
    const b = createCucurucho();
    b.chargeReady = 99;
    const ana = at('ana', M.x - 3, M.bossRoomZ + 12);
    const bo = at('bo', M.x + 3, M.bossRoomZ + 12);
    run(b, [ana, bo], CUCURUCHO.aludFirst);
    expect(b.alud.length).toBe(4);
    const { hits } = run(b, [ana, bo], CUCURUCHO.aludWarn + 0.1, [{ x: bo.x, z: bo.z + 1 }]);
    expect(hits.filter((h) => h.dmg === 15).map((h) => h.name)).toEqual(['ana']);
  });

  it('balance: standing still next to it takes ~30–45 s to lose 100 PV', () => {
    const b = createCucurucho();
    const { hits } = run(b, [at('ana', M.x, b.z - 2)], 30);
    const dmg = hits.reduce((s, h) => s + h.dmg, 0);
    expect(dmg).toBeGreaterThanOrEqual(66);
    expect(dmg).toBeLessThanOrEqual(100);
  });
});

describe('la atalaya', () => {
  const mk = (id: number, x: number, z: number) => createWolf(id, x, z, { heightAt: () => 0, density: () => 0 }, () => 0.5);
  const heart = { x: 0, z: 0 };
  it('stands 6 m from the Heart and throws 8 at the nearest raider in 20 m, every 6 s at night', () => {
    const a = createAtalaya(heart, () => 1);
    expect(Math.hypot(a.x - heart.x, a.z - heart.z)).toBeCloseTo(ATALAYA.home);
    const near = Object.assign(mk(1, a.x + 10, a.z), { raid: true });
    const far = Object.assign(mk(2, a.x + 25, a.z), { raid: true });
    const wild = mk(3, a.x + 2, a.z);
    expect(stepAtalaya(a, [near, far, wild], true, 0.1)).toBe(near);
    expect(near.hp).toBe(ENEMY.wolf.hp - 8);
    expect(far.hp).toBe(ENEMY.wolf.hp);
    expect(wild.hp).toBe(ENEMY.wolf.hp);
    expect(stepAtalaya(a, [near], true, 5)).toBeNull();
    expect(stepAtalaya(a, [near], true, 1.1)).toBe(near);
  });
  it('sleeps by day', () => {
    const a = createAtalaya(heart, () => 1);
    const w = Object.assign(mk(1, a.x + 3, a.z), { raid: true });
    expect(stepAtalaya(a, [w], false, 1)).toBeNull();
  });
});
