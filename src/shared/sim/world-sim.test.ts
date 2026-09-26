import { describe, expect, it } from 'vitest';
import { HARVEST } from '../resources';
import type { ServerMsg } from '../protocol';
import { AWAY_TIMEOUT, DAY_LENGTH, newWorld, WorldSim } from './world-sim';

function setup(...names: string[]) {
  const sim = new WorldSim(newWorld(42, 'salt'));
  for (const n of names) {
    sim.createPlayer(n, 'hash');
    sim.connect(n);
  }
  return sim;
}

/** Teleport for tests (bypasses move validation). */
function put(sim: WorldSim, name: string, x: number, z: number) {
  const p = sim.getPlayer(name)!;
  p.x = x;
  p.z = z;
  p.y = sim.terrain.heightAt(x, z);
}

const tree = (sim: WorldSim) => sim.resources.find((r) => r.kind === 'tree')!;
const msgs = (sim: WorldSim) => sim.drain().map((o) => o.msg);
const snap = (sim: WorldSim, name: string) => sim.snapshotFor(name) as Extract<ServerMsg, { t: 'snap' }>;

describe('WorldSim', () => {
  it('welcomes a new player at spawn', () => {
    const sim = new WorldSim(newWorld(42, 'salt'));
    sim.createPlayer('Ana', 'h');
    const w = sim.connect('Ana');
    expect(w.t).toBe('welcome');
    if (w.t !== 'welcome') return;
    expect(w.seed).toBe(42);
    expect(w.self.x).toBe(0);
    expect(w.self.inv).toEqual({});
  });

  it('accepts plausible moves and rejects teleports', () => {
    const sim = setup('Ana');
    const y = sim.terrain.heightAt(0.5, 0);
    sim.handle('Ana', { t: 'move', x: 0.5, y, z: 0, yaw: 0, anim: 'walk' });
    expect(sim.getPlayer('Ana')!.x).toBe(0.5);
    sim.handle('Ana', { t: 'move', x: 80, y: sim.terrain.heightAt(80, 0), z: 0, yaw: 0, anim: 'run' });
    expect(sim.getPlayer('Ana')!.x).toBe(0.5);
    expect(snap(sim, 'Ana').self.fix).toBe(true);
    expect(snap(sim, 'Ana').self.fix).toBe(false);
  });

  it('harvests in reach, with cooldown, and depletes then regrows', () => {
    const sim = setup('Ana', 'Leo');
    const t = tree(sim);
    sim.handle('Ana', { t: 'harvest', id: t.id });
    expect(sim.getPlayer('Ana')!.inv.wood ?? 0).toBe(0); // too far
    put(sim, 'Ana', t.x + 1, t.z);
    sim.handle('Ana', { t: 'harvest', id: t.id });
    sim.handle('Ana', { t: 'harvest', id: t.id }); // cooldown
    expect(sim.getPlayer('Ana')!.inv.wood).toBe(1);
    for (let i = 0; i < HARVEST.tree.uses; i++) {
      sim.step(0.5);
      sim.handle('Ana', { t: 'harvest', id: t.id });
    }
    expect(sim.getPlayer('Ana')!.inv.wood).toBe(HARVEST.tree.uses);
    expect(msgs(sim)).toContainEqual({ t: 'res', id: t.id, gone: true });
    for (let s = 0; s < HARVEST.tree.regrow + 1; s += 1) sim.step(1);
    expect(msgs(sim)).toContainEqual({ t: 'res', id: t.id, gone: false });
  });

  it('builds a campfire when affordable and uses it as spawn', () => {
    const sim = setup('Ana');
    sim.handle('Ana', { t: 'place', kind: 'campfire', x: 2, z: 0, rot: 0 });
    expect(msgs(sim)).toContainEqual({ t: 'toast', text: 'Faltan materiales' });
    sim.getPlayer('Ana')!.inv = { wood: 6, stone: 3 };
    sim.handle('Ana', { t: 'place', kind: 'campfire', x: 2, z: 0, rot: 0 });
    const out = msgs(sim);
    expect(out.some((m) => m.t === 'built' && m.s.kind === 'campfire' && m.s.owner === 'Ana')).toBe(true);
    expect(sim.getPlayer('Ana')!.inv).toEqual({ wood: 1 });
    sim.getPlayer('Ana')!.inv = { wood: 4 };
    sim.handle('Ana', { t: 'place', kind: 'wall', x: 2.5, z: 0, rot: 0 });
    expect(msgs(sim)).toContainEqual({ t: 'toast', text: 'Hay algo en el camino' });
    expect(sim.spawnFor('Ana')).toEqual({ x: 3.5, z: 0 });
  });

  it('eats berries', () => {
    const sim = setup('Ana');
    const p = sim.getPlayer('Ana')!;
    p.inv = { berries: 2 };
    p.vitals.hunger = 50;
    sim.handle('Ana', { t: 'eat' });
    expect(p.inv).toEqual({ berries: 1 });
    expect(p.vitals.hunger).toBe(65);
  });

  it('shows nearby players, hides far ones, and times out away players', () => {
    const sim = setup('Ana', 'Leo', 'Mia');
    put(sim, 'Mia', 150, 0);
    const s = snap(sim, 'Ana');
    expect(s.players.map((p) => p.name)).toEqual(['Leo']);
    sim.markAway('Leo');
    expect(snap(sim, 'Ana').players[0]!.away).toBe(true);
    for (let t = 0; t <= AWAY_TIMEOUT; t += 1) sim.step(1);
    expect(sim.onlineNames()).not.toContain('Leo');
  });

  it('spawns wolves at nightfall near active players and clears them at dawn', () => {
    const sim = setup('Ana');
    sim.time = DAY_LENGTH * 0.85;
    sim.step(0.1);
    expect(sim.wolfList.length).toBeGreaterThan(0);
    sim.time = DAY_LENGTH * 1.3;
    sim.step(0.1);
    expect(sim.wolfList.length).toBe(0);
  });

  it('wolves hurt and kill; respawn restores and keeps inventory', () => {
    const sim = setup('Ana');
    sim.getPlayer('Ana')!.inv = { wood: 2 };
    sim.time = DAY_LENGTH * 0.85;
    sim.step(0.1);
    const w = sim.wolfList[0]!;
    put(sim, 'Ana', w.x + 1, w.z);
    for (let i = 0; i < 400 && !sim.getPlayer('Ana')!.dead; i++) {
      w.x = sim.getPlayer('Ana')!.x - 1; // keep it glued to the player
      w.z = sim.getPlayer('Ana')!.z;
      sim.step(0.1);
    }
    const p = sim.getPlayer('Ana')!;
    expect(p.dead).toBe(true);
    sim.handle('Ana', { t: 'respawn' });
    expect(p.dead).toBe(false);
    expect(p.vitals.health).toBe(100);
    expect(p.inv).toEqual({ wood: 2 });
  });

  it('punches wolves to death with a cooldown', () => {
    const sim = setup('Ana');
    sim.time = DAY_LENGTH * 0.85;
    sim.step(0.1);
    const w = sim.wolfList[0]!;
    put(sim, 'Ana', w.x + 1, w.z);
    sim.handle('Ana', { t: 'attack', id: w.id });
    sim.handle('Ana', { t: 'attack', id: w.id }); // cooldown
    expect(w.hp).toBe(40);
    for (let i = 0; i < 3; i++) {
      sim.time += 1;
      w.x = sim.getPlayer('Ana')!.x - 1;
      w.z = sim.getPlayer('Ana')!.z;
      sim.handle('Ana', { t: 'attack', id: w.id });
    }
    expect(w.hp).toBe(0);
  });

  it('round-trips through save()', () => {
    const sim = setup('Ana');
    const t = tree(sim);
    put(sim, 'Ana', t.x + 1, t.z);
    for (let i = 0; i < HARVEST.tree.uses; i++) {
      sim.step(0.5);
      sim.handle('Ana', { t: 'harvest', id: t.id });
    }
    sim.getPlayer('Ana')!.inv = { ...sim.getPlayer('Ana')!.inv, wood: 4 };
    sim.handle('Ana', { t: 'place', kind: 'wall', x: t.x + 3, z: t.z, rot: 0 });
    const copy = new WorldSim(JSON.parse(JSON.stringify(sim.save())));
    expect(copy.time).toBe(sim.time);
    expect(copy.getPlayer('Ana')).toEqual(sim.getPlayer('Ana'));
    copy.createPlayer('Leo', 'h');
    const w = copy.connect('Leo');
    if (w.t !== 'welcome') throw new Error('expected welcome');
    expect(w.gone).toContain(t.id);
    expect(w.structures).toHaveLength(1);
  });
});
