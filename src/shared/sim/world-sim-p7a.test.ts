import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, type ServerMsg } from '../protocol';
import { LAGUNA } from '../terrain';
import { BLOCK } from './combat';
import { DAY_LENGTH, FX, newWorld, WorldSim } from './world-sim';
import { ENEMY, type Wolf } from './wolves';

function setup(...names: string[]) {
  const sim = new WorldSim(newWorld(42, 'salt'));
  for (const n of names) {
    sim.createPlayer(n, 'hash');
    sim.connect(n);
  }
  return sim;
}
function put(sim: WorldSim, name: string, x: number, z: number) {
  const p = sim.getPlayer(name)!;
  p.x = x;
  p.z = z;
  p.y = sim.terrain.heightAt(x, z);
}
function wolfAt(sim: WorldSim, dx: number, dz = 0): Wolf {
  sim.time = DAY_LENGTH * 0.85;
  sim.step(0.1);
  const w = sim.wolfList[0]!;
  const p = sim.getPlayer('Ana')!;
  w.x = p.x + dx;
  w.z = p.z + dz;
  w.cooldown = 99; // no bites unless a test wants them
  return w;
}
const snap = (sim: WorldSim, who: string) => {
  const m = sim.snapshotFor(who);
  if (!m || m.t !== 'snap') throw new Error('snap');
  return m;
};
type Out = { to: string | null; msg: ServerMsg }[];
const visions = (out: Out) => out.filter((o) => o.msg.t === 'vision');

describe('Impacto (P7-A, server)', () => {
  it('protocol 66', () => {
    expect(PROTOCOL_VERSION).toBe(66);
  });

  it('a landed punch is reported once, with the HP left', () => {
    const sim = setup('Ana');
    const w = wolfAt(sim, 1);
    snap(sim, 'Ana'); // drain anything older
    sim.handle('Ana', { t: 'attack', id: w.id });
    const fx = snap(sim, 'Ana').fx ?? [];
    expect(fx).toHaveLength(1);
    expect(fx[0]).toMatchObject({ id: w.id, kind: 'hit', by: 'Ana' });
    expect(fx[0]!.dmg).toBeGreaterThan(0);
    expect(fx[0]!.hp).toBeCloseTo(w.hp / ENEMY.wolf.hp, 2);
    expect(snap(sim, 'Ana').fx).toBeUndefined();
  });

  it('a killing blow is a kill with hp 0', () => {
    const sim = setup('Ana');
    const w = wolfAt(sim, 1);
    w.hp = 1;
    snap(sim, 'Ana');
    sim.handle('Ana', { t: 'attack', id: w.id });
    expect(snap(sim, 'Ana').fx).toEqual([expect.objectContaining({ id: w.id, kind: 'kill', hp: 0 })]);
  });

  it('only players within 40 m see it; at most 6 per snapshot', () => {
    const sim = setup('Ana', 'Bea', 'Cai');
    const w = wolfAt(sim, 1);
    const a = sim.getPlayer('Ana')!;
    put(sim, 'Bea', a.x + 20, a.z);
    put(sim, 'Cai', a.x + FX.radius + 20, a.z);
    for (const n of ['Ana', 'Bea', 'Cai']) snap(sim, n);
    sim.handle('Ana', { t: 'attack', id: w.id });
    expect(snap(sim, 'Bea').fx?.[0]?.by).toBe('Ana');
    expect(snap(sim, 'Cai').fx).toBeUndefined();
    for (let i = 0; i < 10; i++) {
      sim.time += 1;
      w.hp = ENEMY.wolf.hp;
      sim.handle('Ana', { t: 'attack', id: w.id });
    }
    expect(snap(sim, 'Ana').fx).toHaveLength(FX.max);
  });

  it('a bite reports hurt once; a guard makes it a block; a timely guard a parry', () => {
    const sim = setup('Ana');
    const w = wolfAt(sim, 1);
    snap(sim, 'Ana');
    w.cooldown = 0;
    sim.step(0.1);
    expect(snap(sim, 'Ana').self.hurt).toBeCloseTo(ENEMY.wolf.damage);
    expect(snap(sim, 'Ana').self.hurt).toBeUndefined();

    const s2 = setup('Ana');
    const w2 = wolfAt(s2, 50);
    s2.handle('Ana', { t: 'block', on: true });
    s2.handle('Ana', { t: 'block', on: false });
    s2.handle('Ana', { t: 'block', on: true }); // no fresh parry window
    const p2 = s2.getPlayer('Ana')!;
    w2.x = p2.x + 1;
    w2.z = p2.z;
    w2.cooldown = 0;
    snap(s2, 'Ana');
    s2.step(0.1);
    const m2 = snap(s2, 'Ana');
    expect(m2.self.hurt).toBeCloseTo(ENEMY.wolf.damage * (1 - BLOCK.reduce));
    expect(m2.fx).toEqual([expect.objectContaining({ id: w2.id, kind: 'block', by: 'Ana' })]);

    const s3 = setup('Ana');
    const w3 = wolfAt(s3, 1);
    s3.handle('Ana', { t: 'block', on: true });
    w3.cooldown = 0;
    snap(s3, 'Ana');
    s3.step(0.1);
    const m3 = snap(s3, 'Ana');
    expect(m3.self.hurt).toBeUndefined();
    expect(m3.fx?.map((f) => f.kind)).toEqual(['parry', 'hit']);
  });

  it('the swamp vision reaches each player the first time they walk in', () => {
    const sim = setup('Ana', 'Bea');
    const at = { x: LAGUNA.x + LAGUNA.rx + 10, z: LAGUNA.z - LAGUNA.rz - 10 };
    sim.drain();
    put(sim, 'Ana', at.x, at.z);
    sim.step(0.1);
    const first = visions(sim.drain());
    expect(first).toHaveLength(1);
    expect(first[0]!.to).toBeNull();
    // Bea was online (she got it): nothing more when she walks in.
    put(sim, 'Bea', at.x, at.z);
    sim.step(0.1);
    expect(visions(sim.drain())).toHaveLength(0);
    // Cai joins later: his own vision, with his name.
    sim.createPlayer('Cai', 'hash');
    sim.connect('Cai');
    put(sim, 'Cai', at.x, at.z);
    sim.step(0.1);
    const late = visions(sim.drain());
    expect(late).toHaveLength(1);
    expect(late[0]!.to).toBe('Cai');
    expect(JSON.stringify(late[0]!.msg)).toContain('Cai');
    sim.step(0.1);
    expect(visions(sim.drain())).toHaveLength(0);
    expect(sim.save().players.find((p) => p.name === 'Cai')!.seen).toContain('swamp');
  });

  it('old saves without seen load', () => {
    const w = newWorld(42, 'salt');
    const sim = new WorldSim(w);
    sim.createPlayer('Ana', 'hash');
    const saved = sim.save();
    delete saved.players[0]!.seen;
    expect(() => new WorldSim(saved)).not.toThrow();
  });
});
