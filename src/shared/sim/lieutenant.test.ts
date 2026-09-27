import { describe, expect, it } from 'vitest';
import type { Terrain } from '../terrain';
import { clavadaStop, FLECHA, flechaLeads, stepFlecha, GATA, gataLeads, hasteNear, rockTarget, stepGata, stepTriangulo, TRIANGULO, triLeads } from './lieutenant';
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

describe('El Triángulo (S4-D)', () => {
  it('leads raids with raidN % 3 === 1 from the 4th, once the mountains are seen and zone 14 is corrupt; never with the Gata', () => {
    expect(triLeads(4, true, [14])).toBe(true);
    expect(triLeads(7, true, [0, 14, 15])).toBe(true);
    expect(triLeads(1, true, [14])).toBe(false);
    expect(triLeads(3, true, [14])).toBe(false);
    expect(triLeads(5, true, [14])).toBe(false);
    expect(triLeads(4, false, [14])).toBe(false);
    expect(triLeads(4, true, [15, 16])).toBe(false);
    for (let n = 0; n < 30; n++) expect(triLeads(n, true, [10, 14]) && gataLeads(n, true, [10, 14])).toBe(false);
  });

  it('kicks a player in sight; with nobody near he waits short of the Heart', () => {
    const w = createWolf(1, 40, 0, flat, rng, 'lieut2');
    expect(w.hp).toBe(TRIANGULO.hp);
    expect(stepTriangulo(Object.assign(w, { x: 59 }), [target(60)], goal, flat, 0.1, rng)).toBe('Ana');
    const v = createWolf(2, 40, 0, flat, rng, 'lieut2');
    for (let i = 0; i < 200; i++) stepTriangulo(v, [target(-200)], goal, flat, 0.1, rng);
    expect(v.x).toBeCloseTo(GATA.hold, 1);
  });

  it('throws rocks at the nearest player structure within 25 m, never the Heart', () => {
    const at = { x: 0, z: 0 };
    const heart = { id: 1, kind: 'heart', x: 1, z: 0 };
    expect(rockTarget(at, [heart])).toBeNull();
    expect(rockTarget(at, [heart, { id: 2, kind: 'wall', x: 20, z: 0 }, { id: 3, kind: 'spikes', x: 0, z: 10 }])).toBe(3);
    expect(rockTarget(at, [heart, { id: 3, kind: 'spikes', x: 0, z: 10 }, { id: 4, kind: 'pillar', x: 4, z: 0 }])).toBe(4); // S4-E: Piedra pillars too
    expect(rockTarget(at, [{ id: 4, kind: 'wall', x: 30, z: 0 }])).toBeNull();
  });
});

describe('La Flecha (S5-C)', () => {
  it('leads raids with raidN % 3 === 2, never on a Gata or Triángulo night', () => {
    for (const n of [2, 5, 8]) expect(flechaLeads(n, true, [18])).toBe(true);
    expect(flechaLeads(3, true, [18])).toBe(false);
    expect(flechaLeads(2, false, [18])).toBe(false);
    expect(flechaLeads(2, true, [19])).toBe(false);
    for (let n = 1; n <= 30; n++) {
      const who = [gataLeads(n, true, [10]), triLeads(n, true, [14]), flechaLeads(n, true, [18])].filter(Boolean).length;
      expect(who).toBeLessThanOrEqual(1);
    }
  });

  it('the clavada sticks in a wall on the line, never in the Heart', () => {
    const wall = { kind: 'wall', x: 10, z: 0.5 };
    const hit = clavadaStop({ x: 0, z: 0 }, { x: 20, z: 0 }, [wall]);
    expect(hit.stuck).toBe(true);
    expect(hit.x).toBeLessThan(10);
    expect(clavadaStop({ x: 0, z: 0 }, { x: 20, z: 0 }, [{ kind: 'heart', x: 10, z: 0 }])).toEqual({ x: 20, z: 0, stuck: false });
    expect(clavadaStop({ x: 0, z: 0 }, { x: 20, z: 0 }, [{ kind: 'wall', x: 10, z: 3 }]).stuck).toBe(false);
  });

  it('every 7 s: aims 1 s, then dashes through the player once', () => {
    const w = createWolf(1, 0, 0, flat, rng, 'lieut3');
    expect(w.hp).toBe(FLECHA.hp);
    const t = [target(10)];
    let aimed = 0;
    const hits: string[] = [];
    for (let i = 0; i < 90; i++) {
      const ev = stepFlecha(w, t, [], goal, flat, 0.1, rng);
      if (w.aim) aimed++;
      hits.push(...ev.hits);
    }
    expect(aimed).toBeGreaterThanOrEqual(9);
    expect(aimed).toBeLessThanOrEqual(11);
    expect(hits).toEqual(['Ana']);
  });

  it('stuck in a wall she does nothing for 4 s', () => {
    const w = createWolf(1, 0, 0, flat, rng, 'lieut3');
    Object.assign(w, { aim: { x: 20, z: 0 }, aimFor: 0.05 });
    const walls = [{ kind: 'wall', x: 10, z: 0 }];
    for (let i = 0; i < 12; i++) stepFlecha(w, [target(-50)], walls, goal, flat, 0.1, rng);
    expect(w.stuck).toBeGreaterThan(0);
    const x = w.x;
    for (let i = 0; i < 30; i++) stepFlecha(w, [target(x + 1)], walls, goal, flat, 0.1, rng);
    expect(w.x).toBe(x);
    for (let i = 0; i < 15; i++) stepFlecha(w, [target(x + 1)], walls, goal, flat, 0.1, rng);
    expect(w.stuck).toBe(0);
  });
});
