import { describe, expect, it } from 'vitest';
import type { ServerMsg } from '../protocol';
import { decodeClient, PROTOCOL_VERSION } from '../protocol';
import { FOGATA } from '../fogatas';
import { LOOKOUT, lookoutTop } from '../ending';
import { estrellaAt } from '../estrella';
import { NAMES } from '../names';
import { DAY_LENGTH, newWorld, WorldSim } from './world-sim';

const HEART = { x: 20, z: 20 };
type Priv = { structures: unknown[] };

function setup(ending: boolean, time = DAY_LENGTH * 0.4) {
  const w = newWorld(42, 'salt');
  w.towerOpen = true;
  w.ending = ending;
  w.raidsOff = true;
  const sim = new WorldSim(w);
  (sim as unknown as Priv).structures.push({ id: 900, kind: 'heart', x: HEART.x, y: 0, z: HEART.z, rot: 0, owner: 'Ana', hp: 500 });
  sim.createPlayer('Ana', 'hash');
  sim.connect('Ana');
  sim.time = time;
  sim.drain();
  return sim;
}
function put(sim: WorldSim, x: number, z: number) {
  Object.assign(sim.getPlayer('Ana')!, { x, z, y: sim.terrain.heightAt(x, z) });
}
const snap = (sim: WorldSim) => sim.snapshotFor('Ana') as Extract<ServerMsg, { t: 'snap' }>;
const toasts = (sim: WorldSim) => sim.drain().flatMap((o) => (o.msg.t === 'toast' ? [o.msg.text] : []));
const MOON_NIGHT = DAY_LENGTH * 8.9;

describe('el Árbol-torre (S5-H)', () => {
  it('after the ending the door takes you to the top; before, it is the Torre', () => {
    const before = setup(false);
    put(before, before.towerDoor.x, before.towerDoor.z);
    before.handle('Ana', { t: 'dungeon', act: 26 });
    expect(before.getPlayer('Ana')!.y).toBeLessThan(lookoutTop(before.terrain).y - 50);
    const sim = setup(true);
    put(sim, sim.towerDoor.x, sim.towerDoor.z);
    sim.handle('Ana', { t: 'dungeon', act: 26 });
    const p = sim.getPlayer('Ana')!;
    const top = lookoutTop(sim.terrain);
    expect(p.y).toBeCloseTo(top.y, 0);
    expect(Math.hypot(p.x - top.x, p.z - top.z)).toBeLessThan(LOOKOUT.r);
    expect(toasts(sim).some((t) => t.includes(NAMES.treeTower))).toBe(true);
  });

  it('fogata 7 is lit by the ending, the tower is drawn whole, and from the top A goes home', () => {
    const sim = setup(true);
    expect(snap(sim).fogatas[FOGATA.lookout]).toBe(true);
    expect(snap(sim).towerH).toBe(LOOKOUT.h);
    expect(snap(setup(false)).fogatas[FOGATA.lookout]).toBe(false);
    put(sim, sim.towerDoor.x, sim.towerDoor.z);
    sim.handle('Ana', { t: 'dungeon', act: 26 });
    sim.handle('Ana', { t: 'travel', to: 'heart' });
    for (let i = 0; i < 60; i++) sim.step(0.1);
    const p = sim.getPlayer('Ana')!;
    expect(Math.hypot(p.x - HEART.x, p.z - HEART.z)).toBeLessThan(4);
  });
});

describe('la Estrella (S5-H)', () => {
  it('rolls only on full-moon nights after the ending', () => {
    const near = (sim: WorldSim) => {
      const e = estrellaAt(sim.time);
      put(sim, e.x + 1, e.z);
      return snap(sim).estrella;
    };
    expect(near(setup(true))).toBeNull(); // day
    expect(near(setup(false, MOON_NIGHT))).toBeNull();
    expect(near(setup(true, DAY_LENGTH * 9.9))).toBeNull(); // no full moon
    expect(near(setup(true, MOON_NIGHT))).toMatchObject({ owner: null });
  });

  it('the dusk of a full-moon day is announced once', () => {
    const sim = setup(true, DAY_LENGTH * 8.73);
    sim.step(0.1);
    expect(toasts(sim).filter((t) => t.startsWith('Luna llena'))).toHaveLength(1);
    sim.step(0.1);
    expect(toasts(sim).filter((t) => t.startsWith('Luna llena'))).toHaveLength(0);
  });

  it('tamed in 4 rounds she is your steed, saved, and runs up to 14 m/s', () => {
    const sim = setup(true, MOON_NIGHT);
    const e = estrellaAt(sim.time);
    put(sim, e.x + 10, e.z);
    sim.handle('Ana', { t: 'mount', act: 18 });
    expect(snap(sim).self.tame).toBeNull();
    put(sim, e.x + 1, e.z);
    sim.handle('Ana', { t: 'mount', act: 18 });
    expect(snap(sim).self.tame).toMatchObject({ beast: 'star', rounds: 4 });
    for (let i = 0; i < 4; i++) {
      const t = snap(sim).self.tame!;
      const at = t.start + t.zone / t.speed;
      while (sim.time < at) sim.step(0.1);
      sim.handle('Ana', { t: 'mount', act: 1, at });
    }
    const s = snap(sim).self;
    expect(s).toMatchObject({ tame: null, star: true, steed: true, riding: true });
    expect(sim.getPlayer('Ana')!.star).toBe(true);
    sim.createPlayer('Bea', 'hash');
    sim.connect('Bea');
    Object.assign(sim.getPlayer('Bea')!, { x: sim.getPlayer('Ana')!.x + 3, z: sim.getPlayer('Ana')!.z });
    expect((sim.snapshotFor('Bea') as Extract<ServerMsg, { t: 'snap' }>).players.find((p) => p.name === 'Ana')!.star).toBe(true);
    // speed: 13.5 m/s accepted, 17 refused
    const p = sim.getPlayer('Ana')!;
    const go = (d: number) => {
      const from = { x: p.x, z: p.z };
      sim.step(1);
      const x = from.x + d;
      sim.handle('Ana', { t: 'move', x, y: sim.terrain.heightAt(x, from.z), z: from.z, yaw: 0, anim: 'run' });
      return p.x === x;
    };
    expect(go(13.5)).toBe(true);
    expect(go(17)).toBe(false);
    sim.drain();
    sim.handle('Ana', { t: 'mount', act: 3 });
    const e2 = estrellaAt(sim.time);
    put(sim, e2.x + 1, e2.z);
    sim.handle('Ana', { t: 'mount', act: 18 });
    expect(toasts(sim).some((t) => t.startsWith('Ya tienes'))).toBe(true);
  });

  it('protocol: mount act 18, version 54', () => {
    expect(decodeClient(JSON.stringify({ t: 'mount', act: 18 }))).toEqual({ t: 'mount', act: 18 });
    expect(decodeClient(JSON.stringify({ t: 'mount', act: 19 }))).toBeNull();
    expect(PROTOCOL_VERSION).toBe(61);
  });
});
