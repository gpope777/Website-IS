import { describe, expect, it } from 'vitest';
import type { ServerMsg, Structure } from '../protocol';
import { PIEDRA } from '../piedra';
import { DBLOCKS_SOLUTION, dungeonBlockCell, insideMountain, MOUNTAIN_DUNGEON as M } from '../mountain-dungeon';
import { DAY_LENGTH, newWorld, WorldSim } from './world-sim';
import type { Wolf } from './wolves';

function setup(...names: string[]) {
  const sim = new WorldSim(newWorld(42, 'salt'));
  for (const n of names) {
    sim.createPlayer(n, 'hash');
    sim.connect(n);
  }
  return sim;
}
function put(sim: WorldSim, name: string, x: number, z: number, dy = 0) {
  const p = sim.getPlayer(name)!;
  p.x = x;
  p.z = z;
  p.y = sim.terrain.heightAt(x, z) + dy;
}
const msgs = (sim: WorldSim) => sim.drain().map((o) => o.msg);
const toasts = (sim: WorldSim) => msgs(sim).flatMap((m) => (m.t === 'toast' ? [m.text] : []));
const snap = (sim: WorldSim, name: string) => sim.snapshotFor(name) as Extract<ServerMsg, { t: 'snap' }>;
const priv = (sim: WorldSim) => sim as unknown as { structures: Structure[]; wolves: Wolf[]; cleansed: Set<number>; raidGoal(): { blockers: { id: number }[] } | null };
const pillars = (sim: WorldSim) => priv(sim).structures.filter((s) => s.kind === 'pillar');
const run = (sim: WorldSim, s: number) => {
  for (let i = 0; i < Math.round(s / 0.1); i++) sim.step(0.1);
};
const stone = (sim: WorldSim, name: string, x: number, z: number) => sim.handle(name, { t: 'power', x, z, kind: 'piedra' });
function withPiedra(...names: string[]) {
  const sim = setup(...names);
  for (const n of names) sim.getPlayer(n)!.piedra = true;
  sim.time = DAY_LENGTH * 0.4;
  return sim;
}

describe('Piedra: pillars (S4-E)', () => {
  it('needs the power; raises a pillar 4 m ahead with 80 PV; 3 s cooldown', () => {
    const sim = setup('Ana');
    put(sim, 'Ana', 0, 0);
    stone(sim, 'Ana', 10, 0);
    expect(toasts(sim)).toContain('Aún no tienes ese poder');
    sim.getPlayer('Ana')!.piedra = true;
    stone(sim, 'Ana', 10, 0);
    const built = msgs(sim).find((m) => m.t === 'built');
    expect(built).toMatchObject({ s: { kind: 'pillar', x: 4, z: 0, hp: PIEDRA.hp, owner: 'Ana' } });
    stone(sim, 'Ana', 0, 10);
    expect(toasts(sim).some((t) => t.startsWith('La roca aún no responde'))).toBe(true);
    run(sim, PIEDRA.cooldown);
    stone(sim, 'Ana', 0, 10);
    expect(pillars(sim)).toHaveLength(2);
    expect(snap(sim, 'Ana').self.piedra).toBe(true);
  });

  it('keeps 3 per player (the oldest crumbles), each 120 s, never saved', () => {
    const sim = withPiedra('Ana');
    put(sim, 'Ana', 0, 0);
    const aims = [[10, 0], [0, 10], [-10, 0], [0, -10]];
    for (const [x, z] of aims) {
      stone(sim, 'Ana', x!, z!);
      run(sim, PIEDRA.cooldown);
    }
    const first = msgs(sim).find((m) => m.t === 'built') as Extract<ServerMsg, { t: 'built' }>;
    expect(pillars(sim)).toHaveLength(3);
    expect(pillars(sim).some((s) => s.id === first.s.id)).toBe(false);
    expect(sim.save().structures.some((s) => (s.kind as string) === 'pillar')).toBe(false);
    run(sim, PIEDRA.life);
    expect(pillars(sim)).toHaveLength(0);
  });

  it('throws a beast standing on the spot; is climbable; raiders see it as a blocker', () => {
    const sim = withPiedra('Ana');
    put(sim, 'Ana', 0, 0);
    const w = { id: 5555, x: 4, y: 0, z: 0, yaw: 0, hp: 50, target: null, cooldown: 0, deadFor: 0, wander: 0, anim: 'idle', raid: false, kind: 'wolf', stun: 0 } as Wolf;
    priv(sim).wolves.push(w);
    stone(sim, 'Ana', 10, 0);
    expect(w.hp).toBe(50 - PIEDRA.liftDamage);
    expect(w.stun).toBeGreaterThan(0);
    const p = pillars(sim)[0]!;
    expect(sim.climbables().some((c) => c.id === PIEDRA.cragId + p.id && c.top === p.y + PIEDRA.height)).toBe(true);
    priv(sim).structures.push({ id: 900, kind: 'heart', x: 20, y: 0, z: 20, rot: 0, owner: 'Ana', hp: 500 });
    (sim as unknown as { raid: unknown }).raid = { phase: 'active', dir: 0 };
    expect(priv(sim).raidGoal()!.blockers.some((b) => b.id === p.id)).toBe(true);
  });

  it('a pillar ≤ 2 m from a mountain root (15–17) crushes it; 14 never', () => {
    const sim = withPiedra('Ana');
    const z15 = sim.zones.find((z) => z.id === 15)!;
    put(sim, 'Ana', z15.x, z15.z + 4);
    stone(sim, 'Ana', z15.x, z15.z);
    expect(sim.corrupt()).not.toContain(15);
    expect(toasts(sim)).toContain('La roca aplasta la raíz marchita. La montaña respira');
    run(sim, PIEDRA.cooldown);
    const z14 = sim.zones.find((z) => z.id === 14)!;
    put(sim, 'Ana', z14.x, z14.z + 4);
    stone(sim, 'Ana', z14.x, z14.z);
    expect(sim.corrupt()).toContain(14);
  });

  it('refuses the sea and other structures', () => {
    const sim = withPiedra('Ana');
    put(sim, 'Ana', 0, 0);
    priv(sim).structures.push({ id: 901, kind: 'wall', x: 4, y: 0, z: 0, rot: 0, owner: 'Ana', hp: 150 });
    stone(sim, 'Ana', 10, 0);
    expect(toasts(sim)).toContain('Hay algo en el camino');
  });
});


const act = (sim: WorldSim, name: string, a: number) => sim.handle(name, { t: 'dungeon', act: a });
const mview = (sim: WorldSim) => snap(sim, 'Ana').dungeon.mountain;
function inCave(...names: string[]) {
  const sim = withPiedra(...names);
  const e = sim.mountainEntrance;
  for (const n of names) {
    put(sim, n, e.x, e.z + 2);
    act(sim, n, 18);
  }
  return sim;
}
const pillar = (sim: WorldSim, id: number, x: number, z: number) => priv(sim).structures.push({ id, kind: 'pillar', x, y: M.floor, z, rot: 0, owner: 'Ana', hp: PIEDRA.hp });

describe('mountain dungeon (S4-E)', () => {
  it('enters at the cave mouth and leaves by the door', () => {
    const sim = withPiedra('Ana');
    put(sim, 'Ana', 0, 0);
    act(sim, 'Ana', 18);
    expect(sim.getPlayer('Ana')!.x).toBe(0);
    const e = sim.mountainEntrance;
    put(sim, 'Ana', e.x, e.z + 3);
    act(sim, 'Ana', 18);
    expect(sim.getPlayer('Ana')!.x).toBe(M.x);
    expect(sim.getPlayer('Ana')!.y).toBe(M.floor);
    act(sim, 'Ana', 19);
    const p = sim.getPlayer('Ana')!;
    expect(Math.hypot(p.x - e.x, p.z - e.z)).toBeLessThan(M.mouthR + 3);
  });

  it('two levers open gate 0; the altar gives Piedra (saved)', () => {
    const sim = inCave('Ana');
    sim.getPlayer('Ana')!.piedra = false;
    for (const i of [0, 1]) {
      const l = insideMountain(M.levers[i]!);
      put(sim, 'Ana', l.x, l.z);
      act(sim, 'Ana', 20 + i);
    }
    expect(mview(sim).gates[0]).toBe(true);
    put(sim, 'Ana', M.x, M.altarZ);
    act(sim, 'Ana', 22);
    expect(sim.save().players[0]!.piedra).toBe(true);
  });

  it('the high plate: a pillar or someone on the shelf holds gate 1 open; a shut gate stops you', () => {
    const sim = inCave('Ana');
    put(sim, 'Ana', M.x, M.gatesZ[1] - 1);
    sim.handle('Ana', { t: 'move', x: M.x, y: M.floor, z: M.gatesZ[1] + 0.8, yaw: 0, anim: 'walk' });
    expect(snap(sim, 'Ana').self.fix).toBe(true);
    const plate = insideMountain(M.shelf);
    put(sim, 'Ana', plate.x, plate.z - 4);
    stone(sim, 'Ana', plate.x, plate.z);
    sim.step(0.1);
    expect(mview(sim).plate).toBe(true);
    expect(mview(sim).gates[1]).toBe(true);
    run(sim, PIEDRA.life);
    expect(mview(sim).gates[1]).toBe(false);
    put(sim, 'Ana', plate.x, plate.z, M.shelf.h);
    sim.step(0.1);
    expect(mview(sim).gates[1]).toBe(true);
  });

  it('blocks: no Piedra, no push; 5 pushes open gate 2; the lever resets', () => {
    const sim = inCave('Ana', 'Leo');
    sim.getPlayer('Leo')!.piedra = false;
    const b0 = dungeonBlockCell(M.blocks.starts[0]);
    put(sim, 'Leo', b0.x, b0.z - 1.5);
    act(sim, 'Leo', 23);
    expect(toasts(sim)).toContain('No se mueve');
    put(sim, 'Ana', b0.x, b0.z - 1.5);
    act(sim, 'Ana', 23);
    expect(mview(sim).blocks[0]).toEqual(dungeonBlockCell([1, 2]));
    const lever = insideMountain(M.resetLever);
    put(sim, 'Ana', lever.x, lever.z);
    act(sim, 'Ana', 25);
    expect(mview(sim).blocks[0]).toEqual(b0);
    for (const m of DBLOCKS_SOLUTION) {
      const at = mview(sim).blocks[m.i]!;
      put(sim, 'Ana', at.x - m.dir[0] * 1.5, at.z - m.dir[1] * 1.5);
      act(sim, 'Ana', 23 + m.i);
    }
    expect(mview(sim).gates[2]).toBe(true);
  });

  it('rockfall: a boulder hits and pushes you back; behind a pillar you are safe', () => {
    const sim = inCave('Ana');
    put(sim, 'Ana', M.x, 100);
    const hp = sim.getPlayer('Ana')!.vitals.health;
    run(sim, 2.5);
    expect(sim.getPlayer('Ana')!.vitals.health).toBeLessThan(hp);
    expect(sim.getPlayer('Ana')!.z).toBeLessThan(100);
    const safe = inCave('Ana');
    pillar(safe, 990, M.x, 104);
    put(safe, 'Ana', M.x, 100);
    const hp2 = safe.getPlayer('Ana')!.vitals.health;
    run(safe, 6);
    expect(safe.getPlayer('Ana')!.vitals.health).toBeGreaterThanOrEqual(hp2 - 1);
  });
});
