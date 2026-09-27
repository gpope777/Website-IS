import { describe, expect, it } from 'vitest';
import type { ServerMsg } from '../protocol';
import { DRAGON, dragonPos } from '../dragon';
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
