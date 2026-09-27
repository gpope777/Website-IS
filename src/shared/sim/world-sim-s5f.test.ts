import { describe, expect, it } from 'vitest';
import type { ServerMsg } from '../protocol';
import { decodeClient } from '../protocol';
import { TOWER_DUNGEON as T } from '../tower-dungeon';
import { FINAL, type FinalBoss } from './marchito-final';
import { DAY_LENGTH, newWorld, WorldSim, type SavedWorld } from './world-sim';

function setup(...names: string[]) {
  const w: SavedWorld = newWorld(42, 'salt');
  w.towerOpen = true;
  const sim = new WorldSim(w);
  for (const n of names) {
    sim.createPlayer(n, 'hash');
    sim.connect(n);
    Object.assign(sim.getPlayer(n)!, { enredadera: true, viento: true, fuego: true, piedra: true });
  }
  sim.time = DAY_LENGTH * 0.4;
  const g = (sim as unknown as { towerLive: { woke: boolean[]; flechaDown: boolean } }).towerLive;
  g.woke = [true, true, true, true];
  g.flechaDown = true;
  return sim;
}
function put(sim: WorldSim, name: string, x: number, z: number) {
  const p = sim.getPlayer(name)!;
  p.x = x;
  p.z = z;
  p.y = T.floor;
}
const msgs = (sim: WorldSim) => sim.drain().map((o) => o.msg);
const toasts = (sim: WorldSim) => msgs(sim).flatMap((m) => (m.t === 'toast' ? [m.text] : []));
const snap = (sim: WorldSim, name = 'Ana') => sim.snapshotFor(name) as Extract<ServerMsg, { t: 'snap' }>;
const fv = (sim: WorldSim) => snap(sim).dungeon.tower.final;
const run = (sim: WorldSim, s: number) => {
  for (let i = 0; i < Math.round(s / 0.1); i++) sim.step(0.1);
};
const boss = (sim: WorldSim) => (sim as unknown as { towerFinal: FinalBoss | null }).towerFinal;
const C = { x: FINAL.x, z: FINAL.z };
/** Everyone into the Copa (2 m apart, 4 m south of him) and one tick: he wakes. */
function inCopa(...names: string[]) {
  const sim = setup(...names);
  names.forEach((n, i) => put(sim, n, C.x + i * 2, C.z - 4));
  sim.step(0.1);
  return sim;
}
/** Keep him from attacking (for damage tests). */
const calm = (b: FinalBoss) => Object.assign(b, { swipeIn: 999, linesIn: 999 });

describe('El Marchito wakes in the Copa (S5-F)', () => {
  it('the first living player in wakes him with 1200 PV; two in the Copa: 1620', () => {
    const sim = setup('Ana');
    put(sim, 'Ana', C.x, C.z - 4);
    sim.step(0.1);
    const t = toasts(sim);
    expect(t.some((x) => x.startsWith('El Marchito baja a la Copa'))).toBe(true);
    expect(t).not.toContain('La Copa está vacía. Arriba solo hay cielo');
    expect(fv(sim)).toMatchObject({ phase: 1, hp: 1200, max: 1200 });
    expect(snap(sim).wolves.some((w) => w.kind === 'boss5' && w.id === FINAL.id)).toBe(true);
    const two = inCopa('Ana', 'Leo');
    expect(fv(two)!.max).toBe(1620);
  });

  it('through the roots a punch does 10 %; a Llamarada within 5 m burns them off 2 s later: full damage', () => {
    const sim = inCopa('Ana');
    calm(boss(sim)!);
    put(sim, 'Ana', C.x, C.z - 2.5);
    sim.handle('Ana', { t: 'attack', id: FINAL.id });
    sim.step(0.1);
    expect(boss(sim)!.hp).toBeCloseTo(1200 - 2);
    sim.handle('Ana', { t: 'power', kind: 'fuego', x: C.x, z: C.z });
    expect(fv(sim)!.catching).toBe(true);
    run(sim, 2.1);
    expect(fv(sim)!.bare).toBe(true);
    const hp = boss(sim)!.hp;
    run(sim, 1);
    sim.handle('Ana', { t: 'attack', id: FINAL.id });
    sim.step(0.1);
    expect(boss(sim)!.hp).toBeCloseTo(hp - 20);
  });

  it('his swipe hurts whoever is within 5 m after the tell; a parry staggers him', () => {
    const sim = inCopa('Ana');
    const b = boss(sim)!;
    Object.assign(b, { swipeIn: 0.05, linesIn: 999 });
    const hp0 = sim.getPlayer('Ana')!.vitals.health;
    run(sim, 1.3);
    expect(sim.getPlayer('Ana')!.vitals.health).toBeCloseTo(hp0 - 18, 0);
    Object.assign(b, { swipeIn: 0.05 });
    sim.step(0.1);
    run(sim, 0.8);
    sim.handle('Ana', { t: 'block', on: true });
    run(sim, 0.3);
    expect(b.stagger).toBeGreaterThan(2);
    expect(fv(sim)!.stagger).toBe(true);
  });

  it('root lines hurt a player still standing on one; rolling dodges', () => {
    const sim = inCopa('Ana');
    const b = boss(sim)!;
    Object.assign(b, { swipeIn: 999, linesIn: 0.05 });
    put(sim, 'Ana', C.x, C.z - 10);
    sim.step(0.1);
    expect(fv(sim)!.lines).toHaveLength(3);
    const hp0 = sim.getPlayer('Ana')!.vitals.health;
    run(sim, 1.3);
    expect(sim.getPlayer('Ana')!.vitals.health).toBeCloseTo(hp0 - 15, 0);
    Object.assign(b, { linesIn: 0.05 });
    run(sim, 1.1);
    sim.handle('Ana', { t: 'roll' });
    const hp1 = sim.getPlayer('Ana')!.vitals.health;
    run(sim, 0.4);
    expect(sim.getPlayer('Ana')!.vitals.health).toBeCloseTo(hp1, 0);
  });

  it('the Copa empties → he resets: next time, full PV', () => {
    const sim = inCopa('Ana');
    boss(sim)!.hp = 900;
    put(sim, 'Ana', T.x, T.stair.z);
    sim.step(0.1);
    expect(boss(sim)).toBeNull();
    put(sim, 'Ana', C.x, C.z - 4);
    sim.step(0.1);
    expect(fv(sim)!.hp).toBe(1200);
  });

  it('decodes dungeon act 28 (pull a brote), refuses 29', () => {
    expect(decodeClient(JSON.stringify({ t: 'dungeon', act: 28 }))).toEqual({ t: 'dungeon', act: 28 });
    expect(decodeClient(JSON.stringify({ t: 'dungeon', act: 29 }))).toBeNull();
  });
});
