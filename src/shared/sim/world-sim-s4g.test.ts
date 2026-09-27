import { describe, expect, it } from 'vitest';
import type { ServerMsg } from '../protocol';
import { DRAGON, dragonPos, FOG_TEXT } from '../dragon';
import { HALF } from '../terrain';
import { mountainEntrance } from '../mountain-dungeon';
import { weatherAt } from '../weather';
import { DAY_LENGTH, newWorld, WorldSim } from './world-sim';

const msgs = (sim: WorldSim) => sim.drain().map((o) => o.msg);
const toasts = (sim: WorldSim) => msgs(sim).flatMap((m) => (m.t === 'toast' ? [m.text] : m.t === 'vision' ? m.lines : []));
const snap = (sim: WorldSim, name: string) => sim.snapshotFor(name) as Extract<ServerMsg, { t: 'snap' }>;
const priv = (sim: WorldSim) => sim as unknown as { purified4: boolean };
const stormDay = [...Array(20).keys()].find((d) => weatherAt(42, d) === 'storm')!;
const clearDay = [...Array(20).keys()].find((d) => weatherAt(42, d) === 'clear')!;

function setup(day = stormDay, purified = true, ...names: string[]) {
  const sim = new WorldSim(newWorld(42, 'salt'));
  for (const n of names.length ? names : ['Ana']) {
    sim.createPlayer(n, 'hash');
    sim.connect(n);
  }
  sim.time = DAY_LENGTH * (day + 0.4);
  priv(sim).purified4 = purified;
  return sim;
}
/** Stand on the Pico's edge on the dragon's side (at `lag` s of lap from now). */
function overDragon(sim: WorldSim, name: string, lag = 0) {
  const d = dragonPos(sim.pico, sim.time + lag);
  const k = 5 / DRAGON.radius;
  const p = sim.getPlayer(name)!;
  p.x = sim.pico.x + (d.x - sim.pico.x) * k;
  p.z = sim.pico.z + (d.z - sim.pico.z) * k;
  p.y = sim.terrain.heightAt(p.x, p.z);
}
function put(sim: WorldSim, name: string, x: number, z: number, y?: number) {
  const p = sim.getPlayer(name)!;
  p.x = x;
  p.z = z;
  p.y = y ?? sim.terrain.heightAt(x, z);
}
const tapPerfect = (sim: WorldSim, name: string) => {
  const t = snap(sim, name).self.tame!;
  const dt = t.speed > 0 ? t.zone / t.speed : (Math.PI * 2 - t.zone) / -t.speed;
  const at = t.start + dt;
  while (sim.time < at) sim.step(0.1);
  sim.handle(name, { t: 'mount', act: 1, at });
};
function tamed(sim: WorldSim, name = 'Ana') {
  overDragon(sim, name);
  sim.handle(name, { t: 'mount', act: 15 });
  for (let i = 0; i < 5; i++) tapPerfect(sim, name);
}

describe('el Dragón on the server (S4-G)', () => {
  it('circles the Pico only on storm days after El Cucurucho', () => {
    expect(snap(setup(), 'Ana').dragons.filter((d) => d.owner === null)).toHaveLength(0); // Ana is far away at spawn
    const sim = setup();
    overDragon(sim, 'Ana');
    expect(snap(sim, 'Ana').dragons.some((d) => d.owner === null)).toBe(true);
    for (const s of [setup(clearDay), setup(stormDay, false)]) {
      overDragon(s, 'Ana');
      expect(snap(s, 'Ana').dragons).toHaveLength(0);
      s.handle('Ana', { t: 'mount', act: 15 });
      expect(snap(s, 'Ana').self.tame).toBeNull();
    }
  });

  it('A with the dragon below you starts a 5-round ring; a quarter lap off does not', () => {
    const sim = setup();
    overDragon(sim, 'Ana', DRAGON.lap / 4);
    sim.handle('Ana', { t: 'mount', act: 15 });
    expect(snap(sim, 'Ana').self.tame).toBeNull();
    expect(toasts(sim)).toContain('Aún no. Espera a que pase por debajo');
    overDragon(sim, 'Ana');
    expect(sim.getPlayer('Ana')!.y).toBeGreaterThan(dragonPos(sim.pico, sim.time).y);
    sim.handle('Ana', { t: 'mount', act: 15 });
    expect(snap(sim, 'Ana').self.tame).toMatchObject({ round: 0, rounds: 5, beast: 'dragon', speed: 3.4 });
    sim.step(1);
    const d = dragonPos(sim.pico, sim.time);
    const p = sim.getPlayer('Ana')!;
    expect(Math.hypot(p.x - d.x, p.z - d.z)).toBeLessThan(0.1); // carried along its circle
  });

  it('five good taps (rounds 3 and 5 backwards): the dragon is yours', () => {
    const sim = setup(stormDay, true, 'Ana', 'Leo');
    overDragon(sim, 'Ana');
    sim.handle('Ana', { t: 'mount', act: 15 });
    tapPerfect(sim, 'Ana');
    tapPerfect(sim, 'Ana');
    expect(snap(sim, 'Ana').self.tame!.speed).toBe(-4.4);
    tapPerfect(sim, 'Ana');
    tapPerfect(sim, 'Ana');
    expect(snap(sim, 'Ana').self.tame!.speed).toBe(-5.4);
    tapPerfect(sim, 'Ana');
    const self = snap(sim, 'Ana').self;
    expect(self.tame).toBeNull();
    expect(self.dragon).toBe(true);
    expect(self.onDragon).toBe(true);
    expect(sim.getPlayer('Ana')!.dragon).toBeDefined();
    expect(toasts(sim).some((t) => t.includes('Mi dragón… Eso sí que no, Ana'))).toBe(true);
    const a = sim.getPlayer('Ana')!;
    put(sim, 'Leo', a.x + 2, a.z);
    expect(snap(sim, 'Leo').players.find((p) => p.name === 'Ana')!.ride).toBe('dragon');
  });

  it('a bad tap throws you off in the air; you may fall from there', () => {
    const sim = setup();
    overDragon(sim, 'Ana');
    sim.handle('Ana', { t: 'mount', act: 15 });
    const t = snap(sim, 'Ana').self.tame!;
    sim.handle('Ana', { t: 'mount', act: 1, at: t.start + (t.zone + Math.PI) / t.speed - 100 });
    expect(snap(sim, 'Ana').self.tame).toBeNull();
    expect(toasts(sim)).toContain('Te tira. ¡Abre el planeador!');
    const p = sim.getPlayer('Ana')!;
    const y0 = p.y;
    sim.step(0.2);
    sim.handle('Ana', { t: 'move', x: p.x + 1, y: y0 - 0.5, z: p.z, yaw: 0, anim: 'glide' });
    expect(sim.getPlayer('Ana')!.y).toBeCloseTo(y0 - 0.5, 5);
  });
});

describe('flying the dragon on the server (S4-G)', () => {
  /** Ana owns a dragon, parked on flat ground at the spawn, and is on it. */
  function flying(...names: string[]) {
    const sim = setup(clearDay, true, 'Ana', ...names);
    const a = sim.getPlayer('Ana')!;
    a.dragon = { x: a.x, z: a.z };
    sim.handle('Ana', { t: 'mount', act: 16 });
    expect(snap(sim, 'Ana').self.onDragon).toBe(true);
    return sim;
  }
  const fly = (sim: WorldSim, dx: number, y: number, dz = 0, dt = 0.5) => {
    const a = sim.getPlayer('Ana')!;
    const before = { x: a.x, y: a.y, z: a.z };
    for (let i = 0; i < Math.round(dt / 0.1); i++) sim.step(0.1);
    sim.handle('Ana', { t: 'move', x: a.x + dx, y, z: a.z + dz, yaw: 0, anim: 'idle' });
    const b = sim.getPlayer('Ana')!;
    return !(b.x === before.x && b.y === before.y && b.z === before.z);
  };
  const g = (sim: WorldSim) => {
    const a = sim.getPlayer('Ana')!;
    return (dx: number) => sim.terrain.heightAt(a.x + dx, a.z);
  };

  it('15 m/s and up to ground + 35 pass; too fast or too high does not', () => {
    const sim = flying();
    expect(fly(sim, 7.5, g(sim)(7.5) + 30)).toBe(true);
    expect(fly(sim, 12.5, g(sim)(12.5) + 30)).toBe(false);
    expect(fly(sim, 5, g(sim)(5) + 40)).toBe(false);
    expect(fly(sim, 5, 125)).toBe(false);
    expect(fly(sim, 5, g(sim)(5) + 20)).toBe(true); // going down is always fine
  });

  it('the fog north of the rim turns it back', () => {
    const sim = flying();
    const a = sim.getPlayer('Ana')!;
    a.x = 0;
    a.z = -HALF - 199;
    a.y = sim.terrain.heightAt(0, a.z) + 10;
    sim.drain();
    expect(fly(sim, 0, a.y, -5)).toBe(false);
    expect(toasts(sim)).toContain(FOG_TEXT);
  });

  it('A gets off only once landed; A beside it gets back on', () => {
    const sim = flying();
    fly(sim, 3, g(sim)(3) + 10);
    sim.handle('Ana', { t: 'mount', act: 17 });
    expect(snap(sim, 'Ana').self.onDragon).toBe(true);
    fly(sim, 2, g(sim)(2));
    sim.handle('Ana', { t: 'mount', act: 17 });
    expect(snap(sim, 'Ana').self.onDragon).toBe(false);
    const parked = { ...sim.getPlayer('Ana')!.dragon! };
    expect(snap(sim, 'Ana').dragons.some((d) => d.owner === 'Ana')).toBe(true);
    const a = sim.getPlayer('Ana')!;
    a.x += 20;
    sim.handle('Ana', { t: 'mount', act: 16 });
    expect(snap(sim, 'Ana').self.onDragon).toBe(false);
    a.x = parked.x + 2;
    sim.handle('Ana', { t: 'mount', act: 16 });
    expect(snap(sim, 'Ana').self.onDragon).toBe(true);
  });

  it('carries one passenger; a second cannot get on', () => {
    const sim = flying('Leo', 'Eva');
    const a = sim.getPlayer('Ana')!;
    for (const n of ['Leo', 'Eva']) {
      const o = sim.getPlayer(n)!;
      Object.assign(o, { x: a.x + 1, z: a.z, y: a.y });
    }
    sim.handle('Leo', { t: 'mount', act: 4 });
    sim.handle('Eva', { t: 'mount', act: 4 });
    expect(snap(sim, 'Leo').self.seat).toBe('Ana');
    expect(snap(sim, 'Eva').self.seat).toBeNull();
    fly(sim, 5, g(sim)(5) + 20);
    sim.step(0.1);
    expect(sim.getPlayer('Leo')!.y).toBeCloseTo(sim.getPlayer('Ana')!.y, 5);
  });

  it('in a raid it does not land near the Heart; a dungeon drops you off', () => {
    const sim = flying();
    const a = sim.getPlayer('Ana')!;
    const pv = sim as unknown as { raid: unknown; heart: () => { x: number; z: number } };
    pv.raid = { phase: 'active', dir: 0 };
    pv.heart = () => ({ x: a.x, z: a.z });
    a.y = sim.terrain.heightAt(a.x, a.z) + 10;
    expect(fly(sim, 2, g(sim)(2) + 1)).toBe(false);
    expect(fly(sim, 2, g(sim)(2) + 6)).toBe(true);
    pv.raid = null;
    const e = mountainEntrance();
    Object.assign(a, { x: e.x, z: e.z + 2, y: sim.terrain.heightAt(e.x, e.z + 2) });
    sim.handle('Ana', { t: 'dungeon', act: 18 });
    expect(snap(sim, 'Ana').self.onDragon).toBe(false);
  });
});
