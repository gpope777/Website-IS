import { describe, expect, it } from 'vitest';
import { CORRUPT_LANDS, corruptDepth, inCorrupt } from '../terrain';
import { ASH } from '../corrupt-lands';
import { NAMES } from '../names';
import { RAYO } from './rayo';
import { createWolf, type Wolf } from './wolves';
import { DAY_LENGTH, newWorld, WorldSim } from './world-sim';

const CENIZA = { x: 10, z: CORRUPT_LANDS.z1 - 50 };

function setup(open = true) {
  const w = newWorld(42, 'salt');
  w.fogOpen = open;
  const sim = new WorldSim(w);
  sim.createPlayer('Ana', 'hash');
  sim.connect('Ana');
  put(sim, CENIZA.x, CENIZA.z);
  sim.drain();
  return sim;
}
function put(sim: WorldSim, x: number, z: number) {
  const p = sim.getPlayer('Ana')!;
  p.x = x;
  p.z = z;
  p.y = sim.terrain.heightAt(x, z);
}
type Inner = { wolves: Wolf[]; nextWolfId: number; time: number; rng: () => number };
const inner = (sim: WorldSim) => sim as unknown as Inner;
const texts = (sim: WorldSim) => sim.drain().flatMap((o) => (o.msg.t === 'toast' ? [o.msg.text] : []));
const tierras = (sim: WorldSim) => sim.wolfList.filter((w) => inCorrupt(w.x, w.z));
function addFoe(sim: WorldSim, kind: 'wolf' | 'rayo', dx: number, dz: number): Wolf {
  const p = sim.getPlayer('Ana')!;
  const s = inner(sim);
  const w = createWolf(s.nextWolfId++, p.x + dx, p.z + dz, sim.terrain, () => 0.5, kind);
  if (kind === 'rayo') w.y += RAYO.fly;
  s.wolves.push(w);
  return w;
}

describe('day beasts of the Espinar (S5 §7.2–7.3)', () => {
  it('6 ash beasts (1 brute) and 2–4 rayos, once a day, only with the fog open', () => {
    const sim = setup();
    sim.step(0.1);
    const up = tierras(sim);
    const rayos = up.filter((w) => w.kind === 'rayo');
    expect(up.filter((w) => w.kind === 'brute')).toHaveLength(ASH.brutes);
    expect(up.filter((w) => w.kind === 'wolf')).toHaveLength(ASH.beasts - ASH.brutes);
    expect(rayos.length).toBeGreaterThanOrEqual(ASH.rayosMin);
    expect(rayos.length).toBeLessThanOrEqual(ASH.rayosMax);
    for (const w of up) {
      const d = corruptDepth(w.z);
      expect(d).toBeGreaterThanOrEqual(ASH.dMin - 2);
      expect(d).toBeLessThanOrEqual(ASH.dMax + 2);
    }
    const n = sim.wolfList.length;
    sim.step(0.1);
    expect(sim.wolfList.length).toBe(n);
    const closed = setup(false);
    closed.step(0.1);
    expect(tierras(closed)).toHaveLength(0);
  });

  it('nothing while nobody is up there; the next day they come back; rayos never over 8', () => {
    const sim = setup();
    put(sim, 0, 0);
    sim.step(0.1);
    expect(tierras(sim)).toHaveLength(0);
    put(sim, CENIZA.x, CENIZA.z);
    sim.step(0.1);
    expect(tierras(sim).length).toBeGreaterThan(0);
    for (let i = 0; i < 6; i++) addFoe(sim, 'rayo', 30 + i, 30);
    inner(sim).time += DAY_LENGTH;
    sim.step(0.1);
    expect(sim.wolfList.filter((w) => w.kind === 'rayo' && w.hp > 0).length).toBeLessThanOrEqual(ASH.rayoCap);
  });
});

describe('rayos marchitos on the server (S5 §7.2)', () => {
  it('a dive hurts the player', () => {
    const sim = setup();
    sim.step(0.1);
    inner(sim).wolves = [];
    addFoe(sim, 'rayo', 6, 0);
    const p = sim.getPlayer('Ana')!;
    const hp = p.vitals.health;
    for (let i = 0; i < 60; i++) sim.step(0.05);
    expect(hp - p.vitals.health).toBeGreaterThanOrEqual(RAYO.damage - 1) // minus a little regen;
  });

  it('the sword only reaches it low; arrows always; a gust grounds it', () => {
    const sim = setup();
    sim.step(0.1);
    inner(sim).wolves = [];
    const w = addFoe(sim, 'rayo', 0, 1);
    sim.handle('Ana', { t: 'attack', id: w.id });
    expect(w.hp).toBe(RAYO.hp);
    expect(texts(sim)).toContain('Vuela alto. Flechas, o viento');
    sim.handle('Ana', { t: 'shoot', id: w.id });
    expect(w.hp).toBeLessThan(RAYO.hp);
    const hp = w.hp;
    sim.getPlayer('Ana')!.viento = true;
    sim.handle('Ana', { t: 'power', kind: 'viento', x: w.x, z: w.z });
    expect(w.grounded).toBeGreaterThan(0);
    expect(w.hp).toBeLessThan(hp);
    expect(w.y).toBeCloseTo(sim.terrain.heightAt(w.x, w.z), 3);
    const p = sim.getPlayer('Ana')!;
    put(sim, w.x, w.z - 1);
    const hp2 = w.hp;
    inner(sim).time += 2;
    sim.handle('Ana', { t: 'attack', id: w.id });
    expect(w.hp).toBeLessThan(hp2);
    expect(p.dead).toBe(false);
  });
});

describe('espinas negras (S5 §7.4)', () => {
  it('ash beasts drop one to the killer; forest wolves none', () => {
    const sim = setup();
    sim.step(0.1);
    inner(sim).wolves = [];
    const w = addFoe(sim, 'wolf', 0, 1);
    w.hp = 1;
    sim.handle('Ana', { t: 'attack', id: w.id });
    expect(sim.getPlayer('Ana')!.inv.thorn).toBe(1);
    expect(texts(sim).some((t) => t.includes(NAMES.thorn))).toBe(true);
    put(sim, 30, 0);
    const f = addFoe(sim, 'wolf', 0, 1);
    f.hp = 1;
    inner(sim).time += 2;
    sim.handle('Ana', { t: 'attack', id: f.id });
    expect(f.hp).toBe(0);
    expect(sim.getPlayer('Ana')!.inv.thorn).toBe(1);
  });

  it('rayos drop one about half the time', () => {
    const sim = setup();
    sim.step(0.1);
    inner(sim).wolves = [];
    let got = 0;
    for (let i = 0; i < 40; i++) {
      const w = addFoe(sim, 'rayo', 0, 5);
      w.hp = 1;
      inner(sim).time += 2;
      sim.handle('Ana', { t: 'shoot', id: w.id });
      expect(w.hp).toBe(0);
    }
    got = sim.getPlayer('Ana')!.inv.thorn ?? 0;
    expect(got).toBeGreaterThan(8);
    expect(got).toBeLessThan(32);
  });
});

describe('the last upgrades (S5 §7.4)', () => {
  function atHeart() {
    const sim = setup();
    put(sim, 0, 0);
    const p = sim.getPlayer('Ana')!;
    p.inv = { wood: 20, stone: 10 };
    sim.handle('Ana', { t: 'place', kind: 'heart', x: 2, z: 0, rot: 0 });
    sim.drain();
    return { sim, p };
  }
  it('arma 6: 6 espinas + 3 cuarzo + 10 piedra, +90 %, then the top', () => {
    const { sim, p } = atHeart();
    p.weaponLvl = 5;
    p.inv = { thorn: 6, quartz: 3, stone: 10 };
    sim.handle('Ana', { t: 'upgrade' });
    expect(p.weaponLvl).toBe(6);
    expect(p.inv).toEqual({});
    expect(texts(sim).some((t) => t.includes('+90 %'))).toBe(true);
    p.inv = { thorn: 60, quartz: 30, stone: 100, pearl: 9, wood: 50 };
    sim.handle('Ana', { t: 'upgrade' });
    expect(texts(sim)).toContain('El arma ya no da más de sí');
    expect(p.weaponLvl).toBe(6);
  });
  it('Capa 4: 4 espinas + 2 ámbar, then the top', () => {
    const { sim, p } = atHeart();
    p.capaLvl = 3;
    p.inv = { thorn: 4, amber: 2 };
    sim.handle('Ana', { t: 'capa' });
    expect(p.capaLvl).toBe(4);
    expect(p.inv).toEqual({});
    p.inv = { thorn: 40, amber: 20, wood: 50, berries: 50 };
    sim.handle('Ana', { t: 'capa' });
    expect(texts(sim)).toContain('La capa ya no admite más corteza');
    expect(p.capaLvl).toBe(4);
  });
});

