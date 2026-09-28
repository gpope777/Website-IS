import { describe, expect, it } from 'vitest';
import type { PowerKind, ServerMsg, Structure } from '../protocol';
import { PIEDRA } from '../piedra';
import { MOUNTAIN_DUNGEON as M } from '../mountain-dungeon';
import { insideTower, TOWER_DUNGEON as T, TOWER_ROCKFALL } from '../tower-dungeon';
import { DAY_LENGTH, newWorld, WorldSim, type SavedWorld } from './world-sim';
import { ENEMY, type Wolf } from './wolves';

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
/** Inside the tower; `calm` keeps the floors' beasts asleep (puzzle tests). */
function inTower(...names: string[]) {
  return enter(false, ...names);
}
function calmTower(...names: string[]) {
  return enter(true, ...names);
}
function enter(calm: boolean, ...names: string[]) {
  const sim = setup({ open: true }, ...names);
  if (calm) (sim as unknown as { towerLive: { woke: boolean[] } }).towerLive.woke = [true, true, true, true];
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
    (sim as unknown as { live: Map<string, { dragon: boolean }> }).live.get('Ana')!.dragon = true;
    put(sim, 'Ana', d.x, d.z + 3);
    act(sim, 'Ana', 26);
    expect(toasts(sim)).toContain('Bájate antes de entrar');
    expect(sim.getPlayer('Ana')!.x).toBe(d.x);
  });
});

describe('the four floors (S5-E)', () => {
  it('floor 1: the pit needs both root bridges', () => {
    const sim = calmTower('Ana');
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
    const sim = calmTower('Ana');
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
    const sim = calmTower('Ana');
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
    const sim = calmTower('Ana');
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
    const solo = calmTower('Ana');
    put(solo, 'Ana', plate.x, plate.z, T.shelf.h);
    solo.step(0.1);
    expect(tview(solo).plate).toBe(true);
  });

  it('floor 4: boulders roll down the tower’s lanes', () => {
    const sim = calmTower('Ana');
    const z = TOWER_ROCKFALL.span[0] + 10;
    put(sim, 'Ana', T.x, z);
    const hp = sim.getPlayer('Ana')!.vitals.health;
    run(sim, 2.5);
    expect(sim.getPlayer('Ana')!.vitals.health).toBeLessThan(hp);
    expect(sim.getPlayer('Ana')!.z).toBeLessThan(z);
    expect(M.damage).toBeGreaterThan(0);
  });
});

describe('beasts and white allies on the floors (S5-E)', () => {
  it('floor 1 wakes 2 wolves once; they hunt you in the tower, stay inside, and survive the dawn', () => {
    const sim = inTower('Ana');
    put(sim, 'Ana', T.x, 30);
    sim.step(0.1);
    const tw = () => priv(sim).wolves.filter((w) => w.hp > 0 && w.x > T.x - 20);
    expect(tw()).toHaveLength(2);
    put(sim, 'Ana', T.x, 31);
    sim.step(0.1);
    expect(tw()).toHaveLength(2);
    const hp = sim.getPlayer('Ana')!.vitals.health;
    run(sim, 6);
    expect(sim.getPlayer('Ana')!.vitals.health).toBeLessThan(hp);
    for (const w of tw()) expect(Math.abs(w.x - T.x)).toBeLessThanOrEqual(T.halfW);
    for (const w of tw()) expect(w.z).toBeGreaterThan(T.gatesZ[0]);
    (sim as unknown as { wasNight: boolean }).wasNight = true;
    sim.step(0.1);
    expect(tw().length).toBeGreaterThan(0);
  });

  it('no purified boss, no ally; with the Tragón purified it follows and bites', () => {
    const none = inTower('Ana');
    put(none, 'Ana', T.x, 30);
    none.step(0.1);
    expect(tview(none).allies).toEqual([]);
    const sim = inTower('Ana');
    (sim as unknown as { purified: boolean }).purified = true;
    put(sim, 'Ana', T.x, 30);
    sim.step(0.1);
    expect(tview(sim).allies.map((a) => a.kind)).toEqual(['tragon']);
    const wolves = priv(sim).wolves.filter((w) => w.x > T.x - 20);
    const before = wolves.reduce((n, w) => n + w.hp, 0);
    run(sim, 4);
    expect(wolves.reduce((n, w) => n + Math.max(0, w.hp), 0)).toBeLessThan(before);
  });

  it('the Antenón, the Zancudo and the Cucurucho work their floors', () => {
    const sim = inTower('Ana');
    Object.assign(sim as unknown as Record<string, boolean>, { purified2: true, purified3: true, purified4: true });
    put(sim, 'Ana', T.x, 60);
    sim.step(0.1);
    run(sim, 3);
    const f2 = priv(sim).wolves.filter((w) => w.x > T.x - 20 && w.z > 46 && w.z < 86);
    expect(f2.some((w) => w.hp <= 0)).toBe(true);
    put(sim, 'Ana', T.x, 105);
    run(sim, 3);
    const z = tview(sim).allies.find((a) => a.kind === 'zancudo')!;
    expect(Math.hypot(z.x - T.x, z.z - 105)).toBeLessThan(4);
    put(sim, 'Ana', T.x, 155);
    run(sim, 0.2);
    const f4 = priv(sim).wolves.filter((w) => w.x > T.x - 20 && w.z > 126);
    expect(f4).toHaveLength(2);
    expect(f4.reduce((n, w) => n + w.hp, 0)).toBeLessThan(ENEMY.wolf.hp + ENEMY.brute.hp);
    expect(tview(sim).allies.map((a) => a.kind)).toEqual(['antenon', 'zancudo', 'cucurucho']);
  });
});

type PrivF = { towerFlecha: Wolf | null; towerLive: { flechaDown: boolean; woke: boolean[] } };
const pf = (sim: WorldSim) => sim as unknown as PrivF;

describe('La Flecha, the stair and the Copa (S5-E)', () => {
  it('wakes in the arena with 470 PV, never leaves it, and resets if the arena empties', () => {
    const sim = calmTower('Ana');
    put(sim, 'Ana', T.x, T.arena.z - 8);
    sim.step(0.1);
    const f = pf(sim).towerFlecha!;
    expect(f).toMatchObject({ id: T.flechaId, kind: 'lieut3', hp: T.flechaHp });
    expect(tview(sim).flecha).toMatchObject({ hp: T.flechaHp, max: T.flechaHp });
    expect(snap(sim).wolves.some((w) => w.id === T.flechaId)).toBe(true);
    const hp = sim.getPlayer('Ana')!.vitals.health;
    run(sim, 10);
    expect(sim.getPlayer('Ana')!.vitals.health).toBeLessThan(hp);
    const w = pf(sim).towerFlecha!;
    expect(Math.abs(w.x - T.x)).toBeLessThanOrEqual(T.halfW);
    expect(Math.abs(w.z - T.arena.z)).toBeLessThanOrEqual(T.arena.half);
    w.hp = 100;
    put(sim, 'Ana', T.x, 150);
    sim.step(0.1);
    expect(pf(sim).towerFlecha).toBeNull();
    put(sim, 'Ana', T.x, T.arena.z - 8);
    sim.step(0.1);
    expect(pf(sim).towerFlecha!.hp).toBe(T.flechaHp);
  });

  it('her clavada sticks in a column', () => {
    const sim = calmTower('Ana');
    const c = insideTower(T.columns[0]);
    put(sim, 'Ana', c.x, c.z - 6);
    sim.step(0.1);
    const f = pf(sim).towerFlecha!;
    Object.assign(f, { x: c.x, z: c.z + 6, clavIn: 0.05 });
    let stuck = false;
    for (let i = 0; i < 30 && !stuck; i++) {
      put(sim, 'Ana', c.x, c.z - 6);
      sim.step(0.1);
      stuck = (pf(sim).towerFlecha!.stuck ?? 0) > 0;
    }
    expect(stuck).toBe(true);
    expect(tview(sim).flecha!.stuck).toBe(true);
  });

  it('beaten: gate 4 opens, 2 espinas to each fighter, and she stays down', () => {
    const sim = calmTower('Ana');
    put(sim, 'Ana', T.x, T.arena.z - 8);
    sim.step(0.1);
    const f = pf(sim).towerFlecha!;
    f.hp = 1;
    Object.assign(f, { x: T.x, z: T.arena.z - 7, stun: 5 });
    sim.handle('Ana', { t: 'attack', id: T.flechaId });
    sim.step(0.1);
    expect(tview(sim).gates[4]).toBe(true);
    expect(sim.getPlayer('Ana')!.inv.thorn ?? 0).toBe(2);
    run(sim, 6);
    expect(pf(sim).towerFlecha).toBeNull();
    expect(tview(sim).flecha).toBeNull();
  });

  it('dying on the stair or in the Copa respawns at the stair; lower down, at the Heart', () => {
    const sim = calmTower('Ana');
    pf(sim).towerLive.flechaDown = true;
    put(sim, 'Ana', T.x + 3, T.copa.z);
    sim.step(0.1);
    expect(toasts(sim).some((t) => t.startsWith('El Marchito baja a la Copa'))).toBe(true); // S5-F: the Copa is no longer empty
    const p = sim.getPlayer('Ana')!;
    const kill = () => (sim as unknown as { kill(p: unknown): void }).kill(p);
    kill();
    expect(p.dead).toBe(true);
    sim.handle('Ana', { t: 'respawn' });
    expect(p).toMatchObject({ dead: false, ...insideTower(T.stair) });
    put(sim, 'Ana', T.x, 60);
    kill();
    sim.handle('Ana', { t: 'respawn' });
    expect(p.dead).toBe(false);
    expect(Math.abs(p.x - T.x)).toBeGreaterThan(50);
  });
});
