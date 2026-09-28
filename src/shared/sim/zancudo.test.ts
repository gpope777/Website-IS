import { describe, expect, it } from 'vitest';
import { insideSwamp, SWAMP_DUNGEON as S } from '../swamp-dungeon';
import { createFarol, createZancudo, FAROL, groundZancudo, stepFarol, stepZancudo, ZANCUDO, type Zancudo } from './zancudo';
import { createWolf, type Wolf, type WolfTarget } from './wolves';

const at = (name: string, x: number, z: number): WolfTarget => ({ name, x, z, dead: false, fires: false });
const run = (b: Zancudo, ts: WolfTarget[], secs: number) => {
  const hits: { name: string; dmg: number }[] = [];
  let drain = 0;
  for (let t = 0; t < secs - 1e-9; t += 0.05) {
    const r = stepZancudo(b, ts, 0.05);
    hits.push(...r.hits);
    drain += r.drain?.dmg ?? 0;
    if (r.hits.length && !b.latch) {
      b.latch = r.hits[0]!.name;
      b.latchLeft = ZANCUDO.latchMax;
    }
  }
  return { hits, drain };
};

describe('El Zancudo', () => {
  it('hovers 4 m up and drifts to the next vent every 6 s', () => {
    const b = createZancudo();
    expect(b.y).toBeCloseTo(S.floor + ZANCUDO.hover);
    const v1 = insideSwamp(S.vents[1]);
    run(b, [], ZANCUDO.driftEvery + 5);
    expect(b.vent).toBe(1);
    expect(Math.hypot(b.x - v1.x, b.z - v1.z)).toBeLessThan(ZANCUDO.overVent);
  });

  it('dives on a fixed shadow after a 1 s windup; the roll-less are hit, the far are not', () => {
    const b = createZancudo();
    b.diveReady = 0;
    const near = at('ana', b.x + 3, b.z);
    const far = at('bea', b.x + 3, b.z + 6);
    stepZancudo(b, [near, far], 0.05);
    expect(b.windup).toBeGreaterThan(0.9);
    expect(b.shadow).toEqual({ x: near.x, z: near.z });
    const r = run(b, [near, far], 1.05);
    expect(r.hits.map((h) => h.name)).toEqual(['ana']);
    expect(r.hits[0]!.dmg).toBe(ZANCUDO.diveDamage);
  });

  it('a latch drains 5 PV/s and lets go after 3 s', () => {
    const b = createZancudo();
    const p = at('ana', b.x, b.z);
    b.latch = 'ana';
    b.latchLeft = ZANCUDO.latchMax;
    b.diveReady = 99;
    const r = run(b, [p], 4);
    expect(r.drain).toBeCloseTo(ZANCUDO.latchDps * ZANCUDO.latchMax, 0);
    expect(b.latch).toBeNull();
  });

  it('grounded it sits on the floor and does not dive, then rises', () => {
    const b = createZancudo();
    b.diveReady = 0;
    groundZancudo(b, ZANCUDO.ventFall);
    const r = run(b, [at('ana', b.x + 1, b.z)], 4.9);
    expect(r.hits).toEqual([]);
    expect(b.y).toBeCloseTo(S.floor);
    run(b, [], 1);
    expect(b.grounded).toBe(0);
    expect(b.y).toBeCloseTo(S.floor + ZANCUDO.hover);
  });

  it('balance: a player standing still under it lasts 30 s', () => {
    const b = createZancudo();
    const r = run(b, [at('ana', b.x, b.z)], 30);
    const total = r.hits.reduce((s, h) => s + h.dmg, 0) + r.drain;
    expect(total).toBeGreaterThan(40);
    expect(total).toBeLessThanOrEqual(100);
  });
});

describe('el farol del Zancudo blanco', () => {
  const heart = { x: 0, z: 0 };
  const flat = () => 0;
  const wolf = (kind: Wolf['kind'], x: number): Wolf => {
    const w = createWolf(1, x, 0, { heightAt: flat, density: () => 0 }, () => 0.5, kind);
    w.raid = true;
    return w;
  };
  it('at night, wolves within 12 m flee 3 s; brutes, the Gata and far wolves do not', () => {
    const a = createFarol(heart, flat);
    const near = wolf('wolf', 5);
    const far = wolf('wolf', 15);
    const brute = wolf('brute', 4);
    const gata = wolf('lieut1', 4);
    expect(stepFarol(a, heart, [near, far, brute, gata], true, 0.05)).toBe(1);
    expect(near.flee).toBe(FAROL.flee);
    expect(near.fleeFrom).toEqual(heart);
    expect(far.flee ?? 0).toBe(0);
    expect(brute.flee ?? 0).toBe(0);
    expect(gata.flee ?? 0).toBe(0);
    near.flee = 0;
    expect(stepFarol(a, heart, [near], true, FAROL.every - 1)).toBe(0);
    expect(stepFarol(a, heart, [near], true, 1.1)).toBe(1);
  });
  it('by day it does nothing', () => {
    const a = createFarol(heart, flat);
    const near = wolf('wolf', 5);
    expect(stepFarol(a, heart, [near], false, 0.05)).toBe(0);
    expect(near.flee ?? 0).toBe(0);
  });
});
