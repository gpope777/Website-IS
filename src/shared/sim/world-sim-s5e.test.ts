import { describe, expect, it } from 'vitest';
import type { PowerKind, ServerMsg, Structure } from '../protocol';
import { PIEDRA } from '../piedra';
import { MOUNTAIN_DUNGEON as M } from '../mountain-dungeon';
import { insideTower, TOWER_DUNGEON as T, TOWER_ROCKFALL } from '../tower-dungeon';
import { DAY_LENGTH, newWorld, WorldSim, type SavedWorld } from './world-sim';
import type { Wolf } from './wolves';

function setup(opts: { open?: boolean; pillars?: number[] } = {}, ...names: string[]) {
  const w: SavedWorld = newWorld(42, 'salt');
  if (opts.open) w.towerOpen = true;
  if (opts.pillars) w.pillars = opts.pillars;
  const sim = new WorldSim(w);
  for (const n of names) {
    sim.createPlayer(n, 'hash');
    sim.connect(n);
    Object.assign(sim.getPlayer(n)!, { enredadera: true, viento: true, fuego: true, piedra: true });
  }
  sim.time = DAY_LENGTH * 0.4;
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
const snap = (sim: WorldSim, name = 'Ana') => sim.snapshotFor(name) as Extract<ServerMsg, { t: 'snap' }>;
const tview = (sim: WorldSim) => snap(sim).dungeon.tower;
const act = (sim: WorldSim, name: string, a: number) => sim.handle(name, { t: 'dungeon', act: a });
const cast = (sim: WorldSim, name: string, kind: PowerKind, x: number, z: number) => sim.handle(name, { t: 'power', x, z, kind });
const run = (sim: WorldSim, s: number) => {
  for (let i = 0; i < Math.round(s / 0.1); i++) sim.step(0.1);
};
const priv = (sim: WorldSim) => sim as unknown as { structures: Structure[]; wolves: Wolf[] };
function inTower(...names: string[]) {
  const sim = setup({ open: true }, ...names);
  const d = sim.towerDoor;
  for (const n of names) {
    put(sim, n, d.x, d.z + 2);
    act(sim, n, 26);
  }
  msgs(sim);
  return sim;
}

describe('the tower door (S5-E)', () => {
  it('stays shut until the dawn after Invasion 3', () => {
    const sim = setup({}, 'Ana');
    const d = sim.towerDoor;
    put(sim, 'Ana', d.x, d.z + 2);
    act(sim, 'Ana', 26);
    expect(toasts(sim)).toContain('Una raíz cierra la puerta. Rompan los Pilares');
    const later = setup({ pillars: [0, 1, 2, 3] }, 'Ana');
    put(later, 'Ana', d.x, d.z + 2);
    act(later, 'Ana', 26);
    expect(toasts(later)).toContain('Una raíz cierra la puerta. Él vendrá antes');
    expect(later.getPlayer('Ana')!.x).toBe(d.x);
  });

  it('open: in at the door, out by the entry', () => {
    const sim = setup({ open: true }, 'Ana');
    put(sim, 'Ana', 0, 0);
    act(sim, 'Ana', 26);
    expect(sim.getPlayer('Ana')!.x).toBe(0);
    const d = sim.towerDoor;
    put(sim, 'Ana', d.x, d.z + 3);
    act(sim, 'Ana', 26);
    expect(sim.getPlayer('Ana')!.x).toBe(T.x);
    expect(sim.getPlayer('Ana')!.y).toBe(T.floor);
    act(sim, 'Ana', 27);
    expect(sim.getPlayer('Ana')!).toMatchObject({ x: d.x, z: d.z + 4 });
  });
});

describe('the four floors (S5-E)', () => {
  it('floor 1: the pit needs both root bridges', () => {
    const sim = inTower('Ana');
    put(sim, 'Ana', T.x, T.gatesZ[0] - 1);
    sim.handle('Ana', { t: 'move', x: T.x, y: T.floor, z: T.gatesZ[0] + 0.8, yaw: 0, anim: 'walk' });
    expect(snap(sim).self.fix).toBe(true);
    const r0 = insideTower(T.roots[0]);
    put(sim, 'Ana', r0.x, r0.z - 3);
    cast(sim, 'Ana', 'enredadera', r0.x, r0.z);
    expect(toasts(sim)).toContain('Una raíz cruza el foso (1/2)');
    expect(tview(sim).gates[0]).toBe(false);
    const r1 = insideTower(T.roots[1]);
    put(sim, 'Ana', r1.x, r1.z - 3);
    run(sim, 13);
    cast(sim, 'Ana', 'enredadera', r1.x, r1.z);
    expect(tview(sim).bridges).toEqual([true, true]);
    expect(tview(sim).gates[0]).toBe(true);
  });

  it('floor 2: three vents clear within 15 s open gate 1; one alone does not last', () => {
    const sim = inTower('Ana');
    const v = T.vents.map((x) => insideTower(x));
    put(sim, 'Ana', v[0]!.x, v[0]!.z - 4);
    cast(sim, 'Ana', 'viento', v[0]!.x, v[0]!.z);
    expect(tview(sim).vents[0]).toBe(true);
    run(sim, T.ventClear + 0.5);
    expect(tview(sim).vents[0]).toBe(false);
    for (const at of v) {
      put(sim, 'Ana', at.x, at.z - 4);
      cast(sim, 'Ana', 'viento', at.x, at.z);
      run(sim, 6.1);
    }
    expect(tview(sim).gates[1]).toBe(true);
  });

  it('floor 3: four Llamaradas light the braziers for good', () => {
    const sim = inTower('Ana');
    for (const b of T.braziers) {
      const at = insideTower(b);
      put(sim, 'Ana', at.x, at.z - 3);
      cast(sim, 'Ana', 'fuego', at.x, at.z);
      run(sim, 5.1);
    }
    expect(tview(sim).braziers).toEqual([true, true, true, true]);
    expect(tview(sim).gates[2]).toBe(true);
  });

  it('floor 4: a pillar on the plate opens gate 3; once someone is through it jams', () => {
    const sim = inTower('Ana');
    const plate = insideTower(T.shelf);
    put(sim, 'Ana', plate.x, plate.z - 4);
    priv(sim).structures.push({ id: 990, kind: 'pillar', x: plate.x, y: T.floor, z: plate.z, rot: 0, owner: 'Ana', hp: PIEDRA.hp });
    sim.step(0.1);
    expect(tview(sim).gates[3]).toBe(true);
    put(sim, 'Ana', T.x, T.gatesZ[3] + 2);
    sim.step(0.1);
    priv(sim).structures = priv(sim).structures.filter((s) => s.id !== 990);
    sim.step(0.1);
    expect(tview(sim).gates[3]).toBe(true);
    const solo = inTower('Ana');
    put(solo, 'Ana', plate.x, plate.z, T.shelf.h);
    solo.step(0.1);
    expect(tview(solo).plate).toBe(true);
  });

  it('floor 4: boulders roll down the tower’s lanes', () => {
    const sim = inTower('Ana');
    const z = TOWER_ROCKFALL.span[0] + 10;
    put(sim, 'Ana', T.x, z);
    const hp = sim.getPlayer('Ana')!.vitals.health;
    run(sim, 2.5);
    expect(sim.getPlayer('Ana')!.vitals.health).toBeLessThan(hp);
    expect(sim.getPlayer('Ana')!.z).toBeLessThan(z);
    expect(M.damage).toBeGreaterThan(0);
  });
});
