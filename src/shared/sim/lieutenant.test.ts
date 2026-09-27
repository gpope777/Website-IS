import { describe, expect, it } from 'vitest';
import type { Terrain } from '../terrain';
import { GATA, gataLeads, hasteNear, stepGata } from './lieutenant';
import { createWolf, stepRaider, type RaidGoal, type WolfTarget } from './wolves';

const flat: Terrain = { heightAt: () => 0, density: () => 0.5 };
const rng = () => 0.5;
const goal: RaidGoal = { heartId: 1, x: 0, z: 0, blockers: [] };
const target = (x: number, z = 0): WolfTarget => ({ name: 'Ana', x, z, dead: false, fires: false });

describe('La Gata Araña (S3-D)', () => {
  it('leads every 3rd raid once the swamp is seen and zone 10 is corrupt', () => {
    expect(gataLeads(3, true, [10])).toBe(true);
    expect(gataLeads(6, true, [0, 10, 11])).toBe(true);
    expect(gataLeads(2, true, [10])).toBe(false);
    expect(gataLeads(4, true, [10])).toBe(false);
    expect(gataLeads(3, false, [10])).toBe(false);
    expect(gataLeads(3, true, [11, 12])).toBe(false);
    expect(gataLeads(0, true, [10])).toBe(false);
  });

  it('hunts a player in sight and bites', () => {
    const w = createWolf(1, 40, 0, flat, rng, 'lieut1');
    expect(w.hp).toBe(GATA.hp);
    stepGata(w, [target(60)], goal, flat, 0.1, rng);
    expect(w.x).toBeGreaterThan(40);
    const bit = stepGata(Object.assign(w, { x: 59 }), [target(60)], goal, flat, 0.1, rng);
    expect(bit).toBe('Ana');
  });

  it('with nobody near she walks to the Heart and waits short of it', () => {
    const w = createWolf(1, 40, 0, flat, rng, 'lieut1');
    for (let i = 0; i < 200; i++) stepGata(w, [target(-200)], goal, flat, 0.1, rng);
    expect(w.x).toBeCloseTo(GATA.hold, 1);
    expect(w.anim).toBe('idle');
  });

  it('her aura makes raiders 20 % faster', () => {
    expect(hasteNear({ x: 0, z: 0 }, 5, 5)).toBe(GATA.haste);
    expect(hasteNear({ x: 0, z: 0 }, 9, 0)).toBe(1);
    expect(hasteNear(null, 0, 0)).toBe(1);
    const a = createWolf(1, 30, 0, flat, rng);
    const b = createWolf(2, 30, 0, flat, rng);
    a.raid = b.raid = true;
    b.haste = GATA.haste;
    stepRaider(a, [], goal, flat, 0.1, rng);
    stepRaider(b, [], goal, flat, 0.1, rng);
    expect(30 - b.x).toBeCloseTo((30 - a.x) * GATA.haste, 5);
  });
});
