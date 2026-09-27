import { describe, expect, it } from 'vitest';
import { HARVEST } from '../resources';
import { STRUCTURE_HP } from '../items';
import { BLOCK, BOW } from './combat';
import { ENEMY } from './wolves';
import type { ServerMsg } from '../protocol';
import { ENREDADERA } from '../enredadera';
import { DUNGEON, inDungeon, inside, leverPos } from '../dungeon';
import { ELITE } from './elite';
import { CORRUPTION } from '../corruption';
import { HALF, WATER_LEVEL } from '../terrain';
import { CIENAGA, depthAt } from '../coast';
import { BOSS } from './boss';
import { ALLY } from './ally';
import { MOUNT } from '../mount';
import { FISH, fishFloor, fishStepOk } from '../fish';
import { NAMES } from '../names';
import { NET, PUNCH, AWAY_TIMEOUT, DAY_LENGTH, GRAVE, newWorld, REVIVE, WorldSim } from './world-sim';

function setup(...names: string[]) {
  const sim = new WorldSim(newWorld(42, 'salt'));
  for (const n of names) {
    sim.createPlayer(n, 'hash');
    sim.connect(n);
  }
  return sim;
}

/** Purify the coast Raíz-madre (zone 6) so raids get no coast brutes. */
function calmCoast(sim: WorldSim) {
  (sim as unknown as { cleansed: Set<number> }).cleansed.add(6);
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

  it('rejects a big jump after idling, even though no move refreshed the anchor', () => {
    const sim = setup('Ana');
    for (let i = 0; i < 60; i++) sim.step(1); // idle a full minute; naive elapsed-since-last-move would allow 9*60+1 m
    const before = { x: sim.getPlayer('Ana')!.x, z: sim.getPlayer('Ana')!.z };
    sim.handle('Ana', { t: 'move', x: before.x + 50, y: sim.terrain.heightAt(before.x + 50, before.z), z: before.z, yaw: 0, anim: 'run' });
    expect(sim.getPlayer('Ana')!.x).toBe(before.x);
    expect(sim.getPlayer('Ana')!.z).toBe(before.z);
    expect(snap(sim, 'Ana').self.fix).toBe(true);
  });

  it('rejects a flood of small moves within one tick that would sum past the anchor budget', () => {
    const sim = setup('Ana');
    const start = { x: sim.getPlayer('Ana')!.x, z: sim.getPlayer('Ana')!.z };
    for (let i = 1; i <= 10; i++) {
      // Each hop is 1.8 m from the ORIGINAL anchor, not cumulative — a client flooding moves within
      // one tick (no sim.step between them) can't walk further than the single-tick budget allows.
      const x = start.x + 1.8 * i;
      sim.handle('Ana', { t: 'move', x, y: sim.terrain.heightAt(x, start.z), z: start.z, yaw: 0, anim: 'run' });
    }
    // Budget for a single tick is MAX_SPEED*TICK_DT+1 = 1.9 m from the anchor, so nothing past the
    // first ~1 hop should have been accepted.
    expect(sim.getPlayer('Ana')!.x).toBeLessThanOrEqual(start.x + 1.9 + 1e-9);
  });

  it('accepts normal walking pace tick after tick', () => {
    const sim = setup('Ana');
    let x = sim.getPlayer('Ana')!.x;
    const z = sim.getPlayer('Ana')!.z;
    for (let i = 0; i < 20; i++) {
      sim.step(0.1);
      x += 0.75; // 7.5 m/s, under MAX_SPEED = 9
      sim.handle('Ana', { t: 'move', x, y: sim.terrain.heightAt(x, z), z, yaw: 0, anim: 'run' });
      expect(sim.getPlayer('Ana')!.x).toBeCloseTo(x);
    }
  });

  it('accepts a move covering the stall gap after a lag spike, instead of snapping back', () => {
    const sim = setup('Ana');
    let x = sim.getPlayer('Ana')!.x;
    const z = sim.getPlayer('Ana')!.z;
    sim.step(0.1);
    x += 0.75; // one normal step, to establish a recent accepted move
    sim.handle('Ana', { t: 'move', x, y: sim.terrain.heightAt(x, z), z, yaw: 0, anim: 'run' });
    expect(sim.getPlayer('Ana')!.x).toBeCloseTo(x);
    for (let i = 0; i < 15; i++) sim.step(0.1); // 1.5 s network stall: no moves arrive
    const jump = x + 1.5 * 7.5; // catch-up move covering the stalled distance at a plausible pace
    sim.handle('Ana', { t: 'move', x: jump, y: sim.terrain.heightAt(jump, z), z, yaw: 0, anim: 'run' });
    expect(sim.getPlayer('Ana')!.x).toBeCloseTo(jump);
    expect(snap(sim, 'Ana').self.fix).toBe(false);
  });

  it('rejects creating a player whose name already exists', () => {
    const sim = setup('Ana');
    expect(() => sim.createPlayer('Ana', 'other-hash')).toThrow('player exists: Ana');
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

  it('accepts a harvest exactly at the cooldown boundary despite float drift', () => {
    // this.time accumulates 0.1s ticks in floating point; with the default world start time
    // (DAY_LENGTH*0.33), 4 ticks of 0.1 land ~2.8e-14 short of harvestReadyAt (time + 0.4),
    // which a naive `this.time < l.harvestReadyAt` check rejects.
    const sim = setup('Ana');
    const t = tree(sim);
    put(sim, 'Ana', t.x + 1, t.z);
    sim.handle('Ana', { t: 'harvest', id: t.id });
    for (let i = 0; i < 4; i++) sim.step(0.1);
    sim.handle('Ana', { t: 'harvest', id: t.id });
    expect(sim.getPlayer('Ana')!.inv.wood).toBe(2);
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

  it('wolves hurt and kill; respawn restores and leaves the backpack in a grave', () => {
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
    expect(p.inv).toEqual({});
    expect(sim.save().graves).toEqual([expect.objectContaining({ owner: 'Ana', inv: { wood: 2 } })]);
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

function giveHeartMats(sim: WorldSim, name: string) {
  sim.getPlayer(name)!.inv = { wood: 40, stone: 20, berries: 20 };
}

function plantHeart(sim: WorldSim, name = 'Ana') {
  giveHeartMats(sim, name);
  const p = sim.getPlayer(name)!;
  sim.handle(name, { t: 'place', kind: 'heart', x: p.x + 2, z: p.z, rot: 0 });
  return sim.heart()!;
}

describe('Corazón del Bosque', () => {
  it('plants one heart per world with full HP', () => {
    const sim = setup('Ana', 'Leo');
    const h = plantHeart(sim);
    expect(h.hp).toBe(STRUCTURE_HP.heart);
    giveHeartMats(sim, 'Leo');
    const l = sim.getPlayer('Leo')!;
    sim.handle('Leo', { t: 'place', kind: 'heart', x: l.x - 3, z: l.z + 3, rot: 0 });
    expect(sim.save().structures.filter((s) => s.kind === 'heart')).toHaveLength(1);
  });

  it('warms like a fire while alive', () => {
    const sim = setup('Ana');
    const h = plantHeart(sim);
    put(sim, 'Ana', h.x + 5, h.z);
    sim.time = DAY_LENGTH * 0.9; // night: without the Heart, warmth would drop
    sim.getPlayer('Ana')!.vitals.warmth = 10;
    for (let i = 0; i < 20; i++) sim.step(0.1);
    expect(sim.getPlayer('Ana')!.vitals.warmth).toBeGreaterThan(10);
  });

  it('tending costs 5 berries and heals, capped at max', () => {
    const sim = setup('Ana');
    const h = plantHeart(sim);
    h.hp = 50;
    sim.handle('Ana', { t: 'tend', id: h.id });
    expect(h.hp).toBe(150);
    expect(sim.getPlayer('Ana')!.inv.berries).toBe(15);
    h.hp = STRUCTURE_HP.heart - 10;
    sim.handle('Ana', { t: 'tend', id: h.id });
    expect(h.hp).toBe(STRUCTURE_HP.heart);
    expect(msgs(sim)).toContainEqual({ t: 'hit', id: h.id, hp: STRUCTURE_HP.heart });
  });

  it('refuses tending from too far or without berries', () => {
    const sim = setup('Ana');
    const h = plantHeart(sim);
    h.hp = 50;
    put(sim, 'Ana', h.x + 20, h.z);
    sim.handle('Ana', { t: 'tend', id: h.id });
    expect(h.hp).toBe(50);
    put(sim, 'Ana', h.x + 1, h.z);
    sim.getPlayer('Ana')!.inv = {};
    sim.handle('Ana', { t: 'tend', id: h.id });
    expect(h.hp).toBe(50);
  });

  it('respawns at the heart when there is no own campfire', () => {
    const sim = setup('Ana');
    const h = plantHeart(sim);
    expect(sim.spawnFor('Ana')).toEqual({ x: h.x + 2, z: h.z });
  });

  it('loads old saves: missing hp and raidLevel get defaults', () => {
    const saved = newWorld(1, 's');
    saved.structures.push({ id: 1, kind: 'wall', x: 0, y: 0, z: 0, rot: 0, owner: 'Ana' } as never);
    const sim = new WorldSim(saved);
    expect(sim.save().structures[0]!.hp).toBe(STRUCTURE_HP.wall);
    expect(sim.raidLevel).toBe(0);
  });
});

import { RAID } from './wolves';
import { SPIKES } from './world-sim';

/** Step the clock until dayFraction reaches f (wrapping through midnight if needed). */
function stepTo(sim: WorldSim, f: number) {
  const target = f * DAY_LENGTH;
  let guard = 0;
  while (Math.abs((sim.time % DAY_LENGTH) - target) > 0.06 && guard++ < DAY_LENGTH * 10 + 10) sim.step(0.1);
}

describe('asedios', () => {
  it('no raid without a heart', () => {
    const sim = setup('Ana');
    stepTo(sim, 0.85);
    expect(sim.raidState()).toBeNull();
    expect(sim.wolfList.some((w) => w.raid)).toBe(false);
  });

  it('warns at dusk, attacks at night, levels up at dawn', () => {
    const sim = setup('Ana');
    calmCoast(sim); // Rule change (S2-D): coast zones add raid brutes; these tests count forest waves only.
    plantHeart(sim);
    stepTo(sim, RAID.warnAt + 0.01);
    expect(sim.raidState()?.phase).toBe('warn');
    expect(snap(sim, 'Ana').raid).toMatchObject({ phase: 'warn', level: 0 });
    stepTo(sim, 0.81);
    expect(sim.raidState()?.phase).toBe('active');
    expect(sim.wolfList.filter((w) => w.raid).length).toBe(RAID.base);
    put(sim, 'Ana', 150, 150); // out of the way so raiders ignore Ana
    sim.heart()!.hp = 100_000; // survives any chewing
    stepTo(sim, 0.3);
    expect(sim.raidState()).toBeNull();
    expect(sim.raidLevel).toBe(1);
    expect(sim.wolfList.some((w) => w.raid)).toBe(false);
  });

  it('bigger waves with level and players', () => {
    const sim = setup('Ana', 'Leo');
    calmCoast(sim); // Rule change (S2-D): coast zones add raid brutes; these tests count forest waves only.
    plantHeart(sim);
    sim.raidLevel = 2;
    stepTo(sim, 0.81);
    expect(sim.wolfList.filter((w) => w.raid).length).toBe(RAID.base + RAID.perLevel * 2 + RAID.perPlayer);
  });

  it('raiders chew walls until they are wrecked', () => {
    const sim = setup('Ana');
    const h = plantHeart(sim);
    stepTo(sim, 0.81);
    const w = sim.wolfList.find((x) => x.raid)!;
    const wall = { id: 500, kind: 'wall' as const, x: w.x, y: 0, z: w.z, rot: 0, owner: 'Ana', hp: RAID.damage };
    (sim as unknown as { structures: unknown[] }).structures.push(wall);
    put(sim, 'Ana', h.x + 150, h.z + 150);
    for (let i = 0; i < 30; i++) sim.step(0.1);
    expect(msgs(sim)).toContainEqual({ t: 'wrecked', id: 500 });
    expect(sim.save().structures.some((s) => s.id === 500)).toBe(false);
  });

  it('a heart at 0 withers: raid ends, raiders leave, no level up, heart stays', () => {
    const sim = setup('Ana');
    const h = plantHeart(sim);
    stepTo(sim, 0.81);
    for (const w of sim.wolfList) if (w.raid) Object.assign(w, { x: h.x + 1, z: h.z });
    h.hp = 1;
    put(sim, 'Ana', h.x + 150, h.z + 150);
    for (let i = 0; i < 5; i++) sim.step(0.1);
    expect(h.hp).toBe(0);
    expect(sim.raidState()).toBeNull();
    expect(sim.wolfList.some((w) => w.raid)).toBe(false);
    expect(sim.heart()).toBeDefined();
    stepTo(sim, 0.3);
    expect(sim.raidLevel).toBe(0);
  });

  it('a withered heart never warns', () => {
    const sim = setup('Ana');
    plantHeart(sim).hp = 0;
    stepTo(sim, 0.78);
    expect(sim.raidState()).toBeNull();
  });

  it('spikes hurt wolves standing on them and wear out', () => {
    const sim = setup('Ana');
    const h = plantHeart(sim);
    stepTo(sim, 0.81);
    const w = sim.wolfList.find((x) => x.raid)!;
    const sp = { id: 600, kind: 'spikes' as const, x: w.x, y: 0, z: w.z, rot: 0, owner: 'Ana', hp: 1 };
    (sim as unknown as { structures: unknown[] }).structures.push(sp);
    const hp0 = w.hp;
    put(sim, 'Ana', h.x + 150, h.z + 150);
    sim.step(0.1);
    expect(w.hp).toBeLessThan(hp0);
    expect(w.slow).toBeGreaterThan(0); // spikes slow what stands on them
    for (let i = 0; i < 5; i++) sim.step(0.1); // no more holding the raider in place: the slow keeps it there
    expect(sim.save().structures.some((s) => s.id === 600)).toBe(false);
    expect(SPIKES.dps).toBeGreaterThan(0);
  });

  it('a raider marching over spikes is slowed and dies on them (no holding it in place)', () => {
    const sim = setup('Ana');
    const h = plantHeart(sim);
    stepTo(sim, 0.81);
    put(sim, 'Ana', h.x + 150, h.z + 150);
    const raiders = sim.wolfList.filter((x) => x.raid);
    const w = raiders[0]!;
    for (const o of raiders.slice(1)) o.hp = 0;
    w.kind = 'wolf';
    w.hp = ENEMY.wolf.hp;
    // spikes on its straight line to the Heart, 6 m ahead
    const d = Math.hypot(h.x - w.x, h.z - w.z);
    const sx = w.x + ((h.x - w.x) / d) * 6;
    const sz = w.z + ((h.z - w.z) / d) * 6;
    (sim as unknown as { structures: unknown[] }).structures.push({ id: 601, kind: 'spikes', x: sx, y: 0, z: sz, rot: 0, owner: 'Ana', hp: 80 });
    for (let i = 0; i < 40 && w.hp > 0; i++) sim.step(0.1);
    expect(w.hp).toBe(0);
  });

  it('a red de raíces holds a raider, rearms, wears and breaks', () => {
    const sim = setup('Ana');
    calmCoast(sim); // Rule change (S2-D): coast zones add raid brutes; these tests count forest waves only.
    const h = plantHeart(sim);
    sim.getPlayer('Ana')!.inv = { wood: 4, berries: 2 };
    const p = sim.getPlayer('Ana')!;
    sim.handle('Ana', { t: 'place', kind: 'roots', x: p.x - 2, z: p.z, rot: 0 });
    const net = sim.save().structures.find((s) => s.kind === 'roots')!;
    expect(net.hp).toBe(STRUCTURE_HP.roots);
    expect(sim.getPlayer('Ana')!.inv).toEqual({});
    stepTo(sim, 0.81);
    put(sim, 'Ana', h.x + 150, h.z + 150);
    const [a, b] = sim.wolfList.filter((x) => x.raid);
    Object.assign(a!, { x: net.x, z: net.z, stun: 0 });
    sim.step(0.1);
    expect(a!.stun).toBeGreaterThan(NET.hold - 0.3);
    const held = { x: a!.x, z: a!.z };
    for (let i = 0; i < 20; i++) sim.step(0.1);
    expect({ x: a!.x, z: a!.z }).toEqual(held);
    const live = () => sim.save().structures.find((s) => s.id === net.id);
    expect(live()!.hp).toBe(STRUCTURE_HP.roots - NET.wear);
    // still rearming: a second raider walks through
    Object.assign(b!, { x: net.x, z: net.z, stun: 0 });
    sim.step(0.1);
    expect(b!.stun).toBe(0);
    for (let i = 0; i < NET.rearm * 10; i++) sim.step(0.1);
    for (let n = 0; n < 5 && live(); n++) {
      const c = sim.wolfList.find((x) => x.raid && x.hp > 0)!;
      Object.assign(c, { x: net.x, z: net.z, stun: 0 });
      sim.step(0.1);
      for (let i = 0; i < NET.rearm * 10 + 1; i++) sim.step(0.1);
    }
    expect(live()).toBeUndefined(); // 60 HP / 15 per catch
  });

  it('snap carries the heart for everyone, even far away', () => {
    const sim = setup('Ana', 'Leo');
    const h = plantHeart(sim);
    put(sim, 'Leo', h.x + 180, h.z);
    expect(snap(sim, 'Leo').heart).toEqual({ id: h.id, hp: h.hp, max: 500 });
  });

  it('raid level survives save/load', () => {
    const sim = setup('Ana');
    sim.raidLevel = 3;
    expect(new WorldSim(sim.save()).raidLevel).toBe(3);
  });

  it('brutes join raids from siege level 1 and show their kind', () => {
    const sim = setup('Ana');
    plantHeart(sim);
    sim.raidLevel = 1;
    stepTo(sim, 0.81);
    const raiders = sim.wolfList.filter((w) => w.raid);
    expect(raiders.some((w) => w.kind === 'brute')).toBe(true);
    put(sim, 'Ana', raiders[0]!.x, raiders[0]!.z);
    expect(snap(sim, 'Ana').wolves[0]).toHaveProperty('kind');
  });
});

function wolfAt(sim: WorldSim, dx: number, dz = 0) {
  sim.time = DAY_LENGTH * 0.85;
  sim.step(0.1);
  const w = sim.wolfList[0]!;
  const p = sim.getPlayer('Ana')!;
  w.x = p.x + dx;
  w.z = p.z + dz;
  return w;
}

describe('combat', () => {
  it('rolling through a bite takes no damage, then goes on cooldown', () => {
    const sim = setup('Ana');
    const w = wolfAt(sim, 1);
    sim.handle('Ana', { t: 'roll' });
    sim.step(0.1);
    expect(sim.getPlayer('Ana')!.vitals.health).toBe(100);
    expect(w.cooldown).toBeGreaterThan(0); // it did bite
  });

  it('a well-timed guard parries: no damage, the wolf is stunned and hurt', () => {
    const sim = setup('Ana');
    const w = wolfAt(sim, 1);
    sim.handle('Ana', { t: 'block', on: true });
    sim.step(0.1);
    expect(sim.getPlayer('Ana')!.vitals.health).toBe(100);
    expect(w.stun).toBeGreaterThan(1);
    expect(w.hp).toBe(ENEMY.wolf.hp - BLOCK.parryDamage);
    expect(sim.drain().some((o) => o.to === 'Ana' && o.msg.t === 'toast' && o.msg.text === 'Parada')).toBe(true);
  });

  it('a held guard only blocks most of the damage; spamming it does not re-arm the parry', () => {
    const sim = setup('Ana');
    const w = wolfAt(sim, 50); // far away while Ana raises her guard
    sim.handle('Ana', { t: 'block', on: true });
    sim.handle('Ana', { t: 'block', on: false });
    sim.handle('Ana', { t: 'block', on: true }); // re-raised within rearm: no fresh parry window
    const p = sim.getPlayer('Ana')!;
    w.x = p.x + 1;
    w.z = p.z;
    sim.step(0.1);
    expect(p.vitals.health).toBeCloseTo(100 - ENEMY.wolf.damage * (1 - BLOCK.reduce));
    expect(w.stun).toBe(0);
  });

  it('shoots what is in front and in range, with a cooldown', () => {
    const sim = setup('Ana');
    const w = wolfAt(sim, 0, 10); // yaw 0 faces +z
    sim.handle('Ana', { t: 'shoot', id: w.id });
    sim.handle('Ana', { t: 'shoot', id: w.id }); // cooldown
    expect(w.hp).toBe(ENEMY.wolf.hp - BOW.damage);
    sim.time += 1;
    sim.getPlayer('Ana')!.yaw = Math.PI; // turned away
    sim.handle('Ana', { t: 'shoot', id: w.id });
    expect(w.hp).toBe(ENEMY.wolf.hp - BOW.damage);
    sim.getPlayer('Ana')!.yaw = 0;
    w.z = sim.getPlayer('Ana')!.z + BOW.range + 2; // too far
    sim.handle('Ana', { t: 'shoot', id: w.id });
    expect(w.hp).toBe(ENEMY.wolf.hp - BOW.damage);
  });

  it('dead players cannot roll, block or shoot', () => {
    const sim = setup('Ana');
    const w = wolfAt(sim, 0, 5);
    sim.getPlayer('Ana')!.dead = true;
    sim.handle('Ana', { t: 'shoot', id: w.id });
    expect(w.hp).toBe(ENEMY.wolf.hp);
  });
});

function down(sim: WorldSim, name: string) {
  const p = sim.getPlayer(name)!;
  p.vitals = { health: 0.01, hunger: 0, warmth: 0 }; // starving and frozen: gone within a tick
  for (let i = 0; i < 20 && !p.dead; i++) sim.step(0.1);
  return p;
}

describe('graves', () => {
  it('respawning drops the backpack in a grave where you fell', () => {
    const sim = setup('Ana');
    put(sim, 'Ana', 20, 20);
    const p = sim.getPlayer('Ana')!;
    p.inv = { wood: 3, berries: 1 };
    down(sim, 'Ana');
    expect(p.dead).toBe(true);
    sim.handle('Ana', { t: 'respawn' });
    expect(p.inv).toEqual({});
    const g = snap(sim, 'Ana').graves;
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ owner: 'Ana', x: 20, z: 20 });
    expect(g[0]).not.toHaveProperty('inv');
    expect(sim.save().graves![0]!.inv).toEqual({ wood: 3, berries: 1 });
  });

  it('an empty backpack leaves no grave', () => {
    const sim = setup('Ana');
    down(sim, 'Ana');
    sim.handle('Ana', { t: 'respawn' });
    expect(snap(sim, 'Ana').graves).toEqual([]);
  });

  it('the owner picks it up by walking onto it; others cannot', () => {
    const sim = setup('Ana', 'Leo');
    put(sim, 'Ana', 20, 20);
    const p = sim.getPlayer('Ana')!;
    p.inv = { wood: 3 };
    down(sim, 'Ana');
    sim.handle('Ana', { t: 'respawn' });
    put(sim, 'Leo', 20, 20);
    sim.step(0.1);
    expect(snap(sim, 'Leo').graves).toHaveLength(1);
    expect(sim.getPlayer('Leo')!.inv).toEqual({});
    p.inv = { wood: 1 };
    put(sim, 'Ana', 21, 20);
    sim.drain();
    sim.step(0.1);
    expect(p.inv).toEqual({ wood: 4 });
    expect(snap(sim, 'Ana').graves).toEqual([]);
    expect(sim.drain().some((o) => o.to === 'Ana' && o.msg.t === 'toast' && o.msg.text === 'Recuperaste tus cosas')).toBe(true);
  });

  it('graves survive save/load and old saves without graves load', () => {
    const sim = setup('Ana');
    put(sim, 'Ana', 20, 20);
    sim.getPlayer('Ana')!.inv = { stone: 2 };
    down(sim, 'Ana');
    sim.handle('Ana', { t: 'respawn' });
    const saved = sim.save();
    const again = new WorldSim(saved);
    again.connect('Ana');
    expect(snap(again, 'Ana').graves).toHaveLength(1);
    delete saved.graves;
    const old = new WorldSim(saved);
    old.connect('Ana');
    expect(snap(old, 'Ana').graves).toEqual([]);
  });

  it('keeps at most GRAVE.max graves, dropping the oldest', () => {
    const sim = setup('Ana');
    for (let i = 0; i <= GRAVE.max; i++) {
      put(sim, 'Ana', 20 + (i % 5) * 3, 20 + Math.floor(i / 5) * 3);
      sim.getPlayer('Ana')!.inv = { wood: 1 };
      down(sim, 'Ana');
      sim.handle('Ana', { t: 'respawn' });
    }
    const g = sim.save().graves!;
    expect(g).toHaveLength(GRAVE.max);
    expect(g[0]!.id).toBe(2);
  });
});

describe('revive', () => {
  function pair() {
    const sim = setup('Ana', 'Leo');
    put(sim, 'Ana', 10, 10);
    put(sim, 'Leo', 11, 10);
    return sim;
  }

  it('a teammate in reach gets you up with your backpack', () => {
    const sim = pair();
    const ana = sim.getPlayer('Ana')!;
    ana.inv = { stone: 4 };
    down(sim, 'Ana');
    expect(ana.dead).toBe(true);
    expect(snap(sim, 'Ana').self.reviveLeft).toBe(REVIVE.window);
    sim.handle('Leo', { t: 'revive', name: 'Ana' });
    expect(ana.dead).toBe(false);
    expect(ana.vitals.health).toBe(REVIVE.health);
    expect(ana.vitals.hunger).toBeGreaterThanOrEqual(REVIVE.floor);
    expect(ana.vitals.warmth).toBeGreaterThanOrEqual(REVIVE.floor);
    expect(ana.inv).toEqual({ stone: 4 });
    expect(ana.x).toBe(10);
    expect(snap(sim, 'Ana').self.reviveLeft).toBe(0);
    expect(snap(sim, 'Ana').graves).toEqual([]);
    sim.step(0.1);
    expect(ana.dead).toBe(false); // does not starve again at once
  });

  it('too far, self, dead reviver or live target: nothing happens', () => {
    const sim = pair();
    const ana = down(sim, 'Ana');
    put(sim, 'Leo', 15, 10);
    sim.handle('Leo', { t: 'revive', name: 'Ana' });
    expect(ana.dead).toBe(true);
    sim.handle('Ana', { t: 'revive', name: 'Ana' });
    expect(ana.dead).toBe(true);
    put(sim, 'Leo', 11, 10);
    const leo = down(sim, 'Leo');
    sim.handle('Leo', { t: 'revive', name: 'Ana' });
    expect(ana.dead).toBe(true);
    sim.handle('Leo', { t: 'respawn' });
    put(sim, 'Leo', 11, 10);
    const hp = leo.vitals.health;
    sim.handle('Ana', { t: 'revive', name: 'Leo' });
    expect(leo.vitals.health).toBe(hp);
    sim.handle('Leo', { t: 'revive', name: 'Nadie' });
    expect(ana.dead).toBe(true);
  });

  it('after the window it is too late', () => {
    const sim = pair();
    const ana = down(sim, 'Ana');
    for (let i = 0; i < REVIVE.window * 10 + 2; i++) sim.step(0.1);
    expect(snap(sim, 'Ana').self.reviveLeft).toBe(0);
    sim.drain();
    sim.handle('Leo', { t: 'revive', name: 'Ana' });
    expect(ana.dead).toBe(true);
    expect(sim.drain().some((o) => o.to === 'Leo' && o.msg.t === 'toast' && o.msg.text === 'Ya es tarde')).toBe(true);
  });
});

describe('traversal moves', () => {
  it('accepts climbing up the side of a crag and standing on top', () => {
    const sim = setup('Ana');
    const c = sim.crags[0]!;
    const x = c.x + c.r + 0.45;
    put(sim, 'Ana', x, c.z);
    sim.step(1.1); // let the move-check anchor catch up with the teleport
    for (let y = sim.getPlayer('Ana')!.y + 0.22; y < c.top; y += 0.22) {
      sim.handle('Ana', { t: 'move', x, y, z: c.z, yaw: 0, anim: 'climb' });
      expect(sim.getPlayer('Ana')!.y).toBeCloseTo(y);
      sim.step(0.1);
    }
    sim.handle('Ana', { t: 'move', x: c.x + c.r - 0.6, y: c.top, z: c.z, yaw: 0, anim: 'idle' });
    expect(sim.getPlayer('Ana')!.y).toBeCloseTo(c.top);
    expect(snap(sim, 'Ana').self.fix).toBe(false);
  });

  it('accepts a glide that keeps going down, far from the crag', () => {
    const sim = setup('Ana');
    const c = sim.crags[0]!;
    const p = sim.getPlayer('Ana')!;
    p.x = c.x;
    p.z = c.z;
    p.y = c.top;
    sim.step(1.1);
    let x = c.x;
    let y = c.top;
    for (let i = 0; i < 40; i++) {
      x += 0.7;
      y = Math.max(y - 0.16, sim.terrain.heightAt(x, c.z));
      sim.handle('Ana', { t: 'move', x, y, z: c.z, yaw: 0, anim: 'glide' });
      expect(p.x).toBeCloseTo(x);
      sim.step(0.1);
    }
    expect(x - c.x).toBeGreaterThan(c.r + 20);
  });

  it('rejects rising in mid-air away from any crag', () => {
    const sim = setup('Ana');
    const x = 5;
    const z = 5;
    expect(sim.crags.every((c) => Math.hypot(c.x - x, c.z - z) > c.r + 10)).toBe(true);
    put(sim, 'Ana', x, z);
    const g = sim.terrain.heightAt(x, z);
    sim.handle('Ana', { t: 'move', x, y: g + 6, z, yaw: 0, anim: 'jump' });
    expect(sim.getPlayer('Ana')!.y).toBeCloseTo(g);
    let y = g;
    for (let i = 0; i < 10; i++) {
      y += 0.5;
      sim.handle('Ana', { t: 'move', x, y, z, yaw: 0, anim: 'jump' });
      sim.step(0.1);
    }
    expect(sim.getPlayer('Ana')!.y).toBeLessThan(g + 4);
  });
});

describe('shrines', () => {
  const kind = (sim: WorldSim, k: string) => sim.shrines.find((s) => s.kind === k)!;
  const view = (sim: WorldSim, name: string, id: number) => snap(sim, name).shrines.find((v) => v.id === id)!;
  const use = (sim: WorldSim, name: string, id: number, part: number) => sim.handle(name, { t: 'shrine', id, part });

  it('the orb stays shut until both levers are pulled within the window', () => {
    const sim = setup('Ana');
    const s = kind(sim, 'levers');
    put(sim, 'Ana', s.orb.x, s.orb.z);
    use(sim, 'Ana', s.id, 0);
    expect(snap(sim, 'Ana').self.shrines).toEqual([]);
    put(sim, 'Ana', s.parts[0]!.x, s.parts[0]!.z);
    use(sim, 'Ana', s.id, 1);
    expect(view(sim, 'Ana', s.id).parts).toEqual([true, false]);
    for (let i = 0; i < 70; i++) sim.step(0.1); // too slow
    put(sim, 'Ana', s.parts[1]!.x, s.parts[1]!.z);
    use(sim, 'Ana', s.id, 2);
    expect(view(sim, 'Ana', s.id).open).toBe(false);
    put(sim, 'Ana', s.parts[0]!.x, s.parts[0]!.z);
    use(sim, 'Ana', s.id, 1);
    expect(view(sim, 'Ana', s.id).open).toBe(true);
    put(sim, 'Ana', s.orb.x, s.orb.z);
    use(sim, 'Ana', s.id, 0);
    expect(snap(sim, 'Ana').self.shrines).toEqual([s.id]);
    expect(sim.save().players[0]!.shrines).toEqual([s.id]);
    // Plan F: the power comes from the dungeon altar, not the first orb.
    expect(msgs(sim)).not.toContainEqual({ t: 'toast', text: expect.stringContaining('Enredadera') });
    expect(snap(sim, 'Ana').self.power).toBe(false);
  });

  it('a lever out of reach does nothing', () => {
    const sim = setup('Ana');
    const s = kind(sim, 'levers');
    put(sim, 'Ana', s.parts[0]!.x + 5, s.parts[0]!.z);
    use(sim, 'Ana', s.id, 1);
    expect(view(sim, 'Ana', s.id).parts).toEqual([false, false]);
  });

  it('the plate holds the gate open while pressed and a few seconds after', () => {
    const sim = setup('Ana');
    const s = kind(sim, 'plate');
    put(sim, 'Ana', s.parts[0]!.x, s.parts[0]!.z);
    sim.step(0.1);
    expect(view(sim, 'Ana', s.id)).toEqual({ id: s.id, open: true, parts: [true] });
    put(sim, 'Ana', s.orb.x + 30, s.orb.z);
    for (let i = 0; i < 20; i++) sim.step(0.1);
    expect(view(sim, 'Ana', s.id)).toEqual({ id: s.id, open: true, parts: [false] });
    for (let i = 0; i < 20; i++) sim.step(0.1);
    expect(view(sim, 'Ana', s.id).open).toBe(false);
    put(sim, 'Ana', s.orb.x, s.orb.z);
    use(sim, 'Ana', s.id, 0);
    expect(snap(sim, 'Ana').self.shrines).toEqual([]);
  });

  it('a friend can hold the plate; each player clears a shrine once', () => {
    const sim = setup('Ana', 'Leo');
    const s = kind(sim, 'plate');
    put(sim, 'Leo', s.parts[0]!.x, s.parts[0]!.z);
    put(sim, 'Ana', s.orb.x, s.orb.z);
    sim.step(0.1);
    use(sim, 'Ana', s.id, 0);
    use(sim, 'Ana', s.id, 0);
    expect(snap(sim, 'Ana').self.shrines).toEqual([s.id]);
    expect(snap(sim, 'Leo').self.shrines).toEqual([]);
  });

  it('the ledge orb needs you on top of the rock', () => {
    const sim = setup('Ana');
    const s = kind(sim, 'ledge');
    put(sim, 'Ana', s.orb.x, s.orb.z);
    use(sim, 'Ana', s.id, 0);
    expect(snap(sim, 'Ana').self.shrines).toEqual([]);
    sim.getPlayer('Ana')!.y = s.pillar!.top;
    use(sim, 'Ana', s.id, 0);
    expect(snap(sim, 'Ana').self.shrines).toEqual([s.id]);
  });

  it('ignores dead players and bad ids or parts', () => {
    const sim = setup('Ana');
    const s = kind(sim, 'ledge');
    put(sim, 'Ana', s.orb.x, s.orb.z);
    sim.getPlayer('Ana')!.y = s.pillar!.top;
    use(sim, 'Ana', 99, 0);
    use(sim, 'Ana', s.id, 1);
    sim.getPlayer('Ana')!.dead = true;
    use(sim, 'Ana', s.id, 0);
    expect(snap(sim, 'Ana').self.shrines).toEqual([]);
  });

  it('old saves without shrines load', () => {
    const sim = setup('Ana');
    const saved = sim.save();
    delete saved.players[0]!.shrines;
    const again = new WorldSim(saved);
    again.connect('Ana');
    expect(snap(again, 'Ana').self.shrines).toEqual([]);
    expect(snap(again, 'Ana').shrines).toHaveLength(6); // S2-C: the coast's three follow the forest's (intentional change)
  });
});

describe('coast shrines', () => {
  const kind = (sim: WorldSim, k: string) => sim.shrines.find((s) => s.kind === k)!;
  const view = (sim: WorldSim, name: string, id: number) => snap(sim, name).shrines.find((v) => v.id === id)!;
  const use = (sim: WorldSim, name: string, id: number, part: number) => sim.handle(name, { t: 'shrine', id, part });
  const take = (sim: WorldSim, name: string, id: number) => {
    const s = sim.shrines[id]!;
    put(sim, name, s.orb.x, s.orb.z);
    use(sim, name, id, 0);
    return snap(sim, name).self.shrines.includes(id);
  };

  it('Marea: a friend on the tide plate opens it', () => {
    const sim = setup('Ana', 'Leo');
    const s = kind(sim, 'tide');
    expect(s.id).toBe(3);
    expect(take(sim, 'Ana', s.id)).toBe(false);
    put(sim, 'Leo', s.parts[0]!.x, s.parts[0]!.z);
    sim.step(0.1);
    expect(view(sim, 'Ana', s.id).open).toBe(true);
    expect(take(sim, 'Ana', s.id)).toBe(true);
  });

  it('Marea: the pumice block carried onto the plate keeps it open', () => {
    const sim = setup('Ana');
    const s = kind(sim, 'tide');
    const [plate, start] = s.parts as [{ x: number; z: number }, { x: number; z: number }];
    expect(view(sim, 'Ana', s.id).block).toEqual({ x: expect.closeTo(start.x, 1), z: expect.closeTo(start.z, 1), held: null });
    put(sim, 'Ana', plate.x + 20, plate.z);
    use(sim, 'Ana', s.id, 1); // too far from the block
    expect(view(sim, 'Ana', s.id).block!.held).toBe(null);
    put(sim, 'Ana', start.x, start.z);
    use(sim, 'Ana', s.id, 1);
    expect(view(sim, 'Ana', s.id).block!.held).toBe('Ana');
    put(sim, 'Ana', plate.x, plate.z);
    sim.step(0.1);
    expect(view(sim, 'Ana', s.id).block).toMatchObject({ x: expect.closeTo(plate.x, 1), held: 'Ana' });
    use(sim, 'Ana', s.id, 1); // drop it on the plate
    expect(view(sim, 'Ana', s.id).block!.held).toBe(null);
    put(sim, 'Ana', s.orb.x + 30, s.orb.z);
    for (let i = 0; i < 60; i++) sim.step(0.1);
    expect(view(sim, 'Ana', s.id)).toMatchObject({ open: true, parts: [true] });
    expect(take(sim, 'Ana', s.id)).toBe(true);
  });

  it('Marea: the block drops where its holder dies', () => {
    const sim = setup('Ana');
    const s = kind(sim, 'tide');
    put(sim, 'Ana', s.parts[1]!.x, s.parts[1]!.z);
    use(sim, 'Ana', s.id, 1);
    sim.getPlayer('Ana')!.dead = true;
    sim.step(0.1);
    expect(view(sim, 'Ana', s.id).block!.held).toBe(null);
  });

  it('Hundido: the seabed lever needs a diver, and both levers within 8 s', () => {
    const sim = setup('Ana');
    const s = kind(sim, 'sunken');
    const [beach, bed] = s.parts as [{ x: number; z: number }, { x: number; z: number }];
    const p = sim.getPlayer('Ana')!;
    put(sim, 'Ana', bed.x, bed.z);
    p.y = WATER_LEVEL - 0.5; // swimming at the surface
    use(sim, 'Ana', s.id, 2);
    expect(view(sim, 'Ana', s.id).parts).toEqual([false, false]);
    expect(msgs(sim)).toContainEqual({ t: 'toast', text: 'Está en el fondo' });
    p.y = sim.terrain.heightAt(bed.x, bed.z) + 0.6; // diving
    use(sim, 'Ana', s.id, 2);
    expect(view(sim, 'Ana', s.id).parts).toEqual([false, true]);
    for (let i = 0; i < 75; i++) sim.step(0.1);
    put(sim, 'Ana', beach.x, beach.z);
    use(sim, 'Ana', s.id, 1);
    expect(view(sim, 'Ana', s.id).open).toBe(true);
    expect(take(sim, 'Ana', s.id)).toBe(true);
  });

  it('Hundido: too slow and it stays shut', () => {
    const sim = setup('Ana');
    const s = kind(sim, 'sunken');
    const [beach, bed] = s.parts as [{ x: number; z: number }, { x: number; z: number }];
    put(sim, 'Ana', bed.x, bed.z);
    use(sim, 'Ana', s.id, 2);
    for (let i = 0; i < 90; i++) sim.step(0.1);
    put(sim, 'Ana', beach.x, beach.z);
    use(sim, 'Ana', s.id, 1);
    expect(view(sim, 'Ana', s.id).open).toBe(false);
  });

  it('Islote: three wheels within 6 s open the fan-gate; one alone does not', () => {
    const sim = setup('Ana', 'Leo', 'Eva');
    const s = kind(sim, 'fan');
    const names = ['Ana', 'Leo', 'Eva'];
    put(sim, 'Ana', s.parts[0]!.x, s.parts[0]!.z);
    use(sim, 'Ana', s.id, 1);
    expect(view(sim, 'Ana', s.id).open).toBe(false);
    expect(msgs(sim)).toContainEqual({ t: 'toast', text: `La verja-molino no se mueve. Quizá con ${NAMES.powerWind.toLowerCase()}… o con tres manos` });
    names.forEach((n, i) => {
      put(sim, n, s.parts[i]!.x, s.parts[i]!.z);
      use(sim, n, s.id, i + 1);
    });
    expect(view(sim, 'Ana', s.id).open).toBe(true);
    expect(view(sim, 'Ana', s.id).parts).toEqual([true, true, true]);
    expect(take(sim, 'Leo', s.id)).toBe(true);
    expect(snap(sim, 'Leo').self.vitals).toBeDefined();
  });

  it('a coast orb cleanses no forest zone', () => {
    const sim = setup('Ana', 'Leo');
    const s = kind(sim, 'tide');
    const before = sim.corrupt();
    put(sim, 'Leo', s.parts[0]!.x, s.parts[0]!.z);
    sim.step(0.1);
    expect(take(sim, 'Ana', s.id)).toBe(true);
    // Rule change (S2-D): a coast orb now cleanses a coast zone; the forest ones stay.
    expect(sim.corrupt().filter((i) => i < 6)).toEqual(before.filter((i) => i < 6));
  });
});

describe('Enredadera', () => {
  function caster(...names: string[]) {
    const sim = setup(...names);
    for (const n of names) sim.getPlayer(n)!.enredadera = true;
    return sim;
  }
  const cast = (sim: WorldSim, x: number, z: number) => sim.handle('Ana', { t: 'power', x, z });

  it('needs the dungeon altar: a shrine orb is not enough', () => {
    const sim = setup('Ana');
    sim.getPlayer('Ana')!.shrines = [0];
    cast(sim, 2, 0);
    expect(snap(sim, 'Ana').vines).toEqual([]);
    expect(msgs(sim)).toContainEqual({ t: 'toast', text: 'Aún no tienes ese poder' });
  });

  it('grows a climbable vine, with a cooldown, one per player', () => {
    const sim = caster('Ana');
    cast(sim, 2, 0);
    const s = snap(sim, 'Ana');
    expect(s.vines).toHaveLength(1);
    expect(s.vines[0]).toMatchObject({ x: 2, z: 0, r: ENREDADERA.r });
    expect(s.self.powerLeft).toBe(ENREDADERA.cooldown);
    cast(sim, -2, 0);
    expect(snap(sim, 'Ana').vines[0]!.x).toBe(2);
    for (let i = 0; i < ENREDADERA.cooldown * 10 + 1; i++) sim.step(0.1);
    cast(sim, -2, 0);
    expect(snap(sim, 'Ana').vines.map((v) => v.x)).toEqual([-2]);
  });

  it('refuses far targets and water, and vines wither after a while', () => {
    const sim = caster('Ana');
    cast(sim, 20, 0);
    expect(snap(sim, 'Ana').vines).toEqual([]);
    cast(sim, 2, 0);
    for (let i = 0; i < ENREDADERA.life * 10 + 1; i++) sim.step(0.1);
    expect(snap(sim, 'Ana').vines).toEqual([]);
  });

  it('the server accepts climbing a fresh vine', () => {
    const sim = caster('Ana');
    const g = sim.terrain.heightAt(0.5, 0);
    sim.handle('Ana', { t: 'move', x: 0.5, y: g + 6, z: 0, yaw: 0, anim: 'climb' });
    expect(snap(sim, 'Ana').self.fix).toBe(true);
    cast(sim, 2, 0);
    sim.handle('Ana', { t: 'move', x: 0.5, y: g + 6, z: 0, yaw: 0, anim: 'climb' });
    expect(snap(sim, 'Ana').self.fix).toBe(false);
    expect(sim.getPlayer('Ana')!.y).toBe(g + 6);
  });

  it('wraps the smooth shrine rock so its orb can be reached', () => {
    const sim = caster('Ana');
    const s = sim.shrines.find((x) => x.kind === 'ledge')!;
    put(sim, 'Ana', s.x + s.pillar!.r + 1, s.z);
    cast(sim, s.x, s.z);
    expect(snap(sim, 'Ana').vines.map((v) => v.id)).toEqual([s.pillar!.id]);
    expect(sim.climbables().filter((c) => c.id === s.pillar!.id).map((c) => !!c.bare)).toEqual([false]);
  });

  it('walls near a vine regrow', () => {
    const saved = newWorld(42, 'salt');
    const y = 1;
    saved.structures = [
      { id: 1, kind: 'wall', x: 4, y, z: 0, rot: 0, owner: 'Ana', hp: 50 },
      { id: 2, kind: 'wall', x: -40, y, z: 0, rot: 0, owner: 'Ana', hp: 50 },
    ];
    const sim = new WorldSim(saved);
    sim.createPlayer('Ana', 'h');
    sim.connect('Ana');
    sim.getPlayer('Ana')!.enredadera = true;
    cast(sim, 2, 0);
    msgs(sim);
    for (let i = 0; i < 20; i++) sim.step(0.1);
    const hits = msgs(sim).filter((m) => m.t === 'hit');
    expect(hits).toContainEqual({ t: 'hit', id: 1, hp: 50 + 2 * ENREDADERA.regen });
    expect(hits.some((m) => m.t === 'hit' && m.id === 2)).toBe(false);
  });

  it('the dead cannot cast', () => {
    const sim = caster('Ana');
    sim.getPlayer('Ana')!.dead = true;
    cast(sim, 2, 0);
    expect(snap(sim, 'Ana').vines).toEqual([]);
  });
});

describe('dungeon', () => {
  const act = (sim: WorldSim, name: string, a: number) => sim.handle(name, { t: 'dungeon', act: a });
  function enter(sim: WorldSim, name: string) {
    put(sim, name, sim.entrance.x + DUNGEON.trunkR + 1, sim.entrance.z);
    act(sim, name, 0);
  }
  function openGate(sim: WorldSim, name: string) {
    for (const i of [0, 1]) {
      const l = leverPos(i);
      put(sim, name, l.x, l.z);
      act(sim, name, 2 + i);
    }
  }

  it('the hollow takes you inside and the exit brings you back', () => {
    const sim = setup('Ana');
    act(sim, 'Ana', 0); // at spawn, far from the root
    expect(inDungeon(sim.getPlayer('Ana')!.x, sim.getPlayer('Ana')!.z)).toBe(false);
    enter(sim, 'Ana');
    const p = sim.getPlayer('Ana')!;
    expect(inDungeon(p.x, p.z)).toBe(true);
    expect(p.y).toBe(DUNGEON.floor);
    expect(snap(sim, 'Ana').self.fix).toBe(true);
    sim.step(0.1);
    sim.handle('Ana', { t: 'move', x: p.x + 0.5, y: DUNGEON.floor, z: p.z, yaw: 0, anim: 'walk' });
    expect(snap(sim, 'Ana').self.fix).toBe(false);
    expect(p.x).toBe(DUNGEON.x + 0.5);
    put(sim, 'Ana', DUNGEON.x, DUNGEON.entryZ);
    act(sim, 'Ana', 1);
    expect(inDungeon(p.x, p.z)).toBe(false);
    expect(Math.hypot(p.x - sim.entrance.x, p.z - sim.entrance.z)).toBeLessThan(DUNGEON.trunkR + DUNGEON.enterReach);
  });

  it('exit only works at the door, and only from inside', () => {
    const sim = setup('Ana');
    put(sim, 'Ana', sim.entrance.x + 5, sim.entrance.z);
    act(sim, 'Ana', 1);
    expect(sim.getPlayer('Ana')!.x).toBe(sim.entrance.x + 5);
    enter(sim, 'Ana');
    put(sim, 'Ana', DUNGEON.x, 20);
    act(sim, 'Ana', 1);
    expect(inDungeon(sim.getPlayer('Ana')!.x, sim.getPlayer('Ana')!.z)).toBe(true);
  });

  it('the gate stays shut until both root levers are pulled in time, then the altar gives Enredadera', () => {
    const sim = setup('Ana');
    enter(sim, 'Ana');
    const p = sim.getPlayer('Ana')!;
    put(sim, 'Ana', DUNGEON.x, DUNGEON.gateZ - 1);
    for (let i = 0; i < 11; i++) sim.step(0.1); // let the move anchor catch up with the teleport
    sim.handle('Ana', { t: 'move', x: DUNGEON.x, y: DUNGEON.floor, z: DUNGEON.gateZ + 0.2, yaw: 0, anim: 'walk' });
    expect(p.z).toBe(DUNGEON.gateZ - 1);
    expect(snap(sim, 'Ana').self.fix).toBe(true);
    expect(snap(sim, 'Ana').dungeon).toMatchObject({ gate: false, levers: [false, false] });
    put(sim, 'Ana', DUNGEON.x, DUNGEON.altarZ);
    act(sim, 'Ana', 4); // the altar is behind the gate
    expect(snap(sim, 'Ana').self.power).toBe(false);
    openGate(sim, 'Ana');
    expect(snap(sim, 'Ana').dungeon).toMatchObject({ gate: true, levers: [true, true] });
    put(sim, 'Ana', DUNGEON.x, DUNGEON.gateZ - 1);
    for (let i = 0; i < 11; i++) sim.step(0.1); // let the move anchor catch up with the teleport
    sim.handle('Ana', { t: 'move', x: DUNGEON.x, y: DUNGEON.floor, z: DUNGEON.gateZ + 0.2, yaw: 0, anim: 'walk' });
    expect(p.z).toBe(DUNGEON.gateZ + 0.2);
    put(sim, 'Ana', DUNGEON.x, DUNGEON.altarZ);
    msgs(sim);
    act(sim, 'Ana', 4);
    expect(snap(sim, 'Ana').self.power).toBe(true);
    expect(msgs(sim)).toContainEqual({ t: 'toast', text: expect.stringContaining('Enredadera') });
    expect(sim.save().players[0]!.enredadera).toBe(true);
    sim.handle('Ana', { t: 'power', x: DUNGEON.x, z: DUNGEON.altarZ + 3 });
    expect(snap(sim, 'Ana').vines).toHaveLength(1);
  });

  it('levers pulled too far apart do not open it; levers need reach', () => {
    const sim = setup('Ana');
    enter(sim, 'Ana');
    const l0 = leverPos(0);
    const l1 = leverPos(1);
    put(sim, 'Ana', l1.x, l1.z);
    act(sim, 'Ana', 2); // lever 0 is on the other side
    expect(snap(sim, 'Ana').dungeon.levers).toEqual([false, false]);
    put(sim, 'Ana', l0.x, l0.z);
    act(sim, 'Ana', 2);
    for (let i = 0; i < (DUNGEON.leverWindow + 1) * 10; i++) sim.step(0.1);
    put(sim, 'Ana', l1.x, l1.z);
    act(sim, 'Ana', 3);
    expect(snap(sim, 'Ana').dungeon.gate).toBe(false);
  });

  it('old saves with a shrine orb keep the power; new orbs do not give it', () => {
    const sim = setup('Ana', 'Leo');
    sim.getPlayer('Ana')!.shrines = [0];
    const saved = sim.save();
    delete saved.players[0]!.enredadera;
    saved.players[1]!.enredadera = false;
    saved.players[1]!.shrines = [1];
    const again = new WorldSim(saved);
    again.connect('Ana');
    again.connect('Leo');
    expect(snap(again, 'Ana').self.power).toBe(true);
    expect(snap(again, 'Leo').self.power).toBe(false);
  });

  it('the dead cannot use it, and it is warm inside at night', () => {
    const sim = setup('Ana');
    sim.getPlayer('Ana')!.dead = true;
    enter(sim, 'Ana');
    expect(inDungeon(sim.getPlayer('Ana')!.x, sim.getPlayer('Ana')!.z)).toBe(false);
    sim.getPlayer('Ana')!.dead = false;
    enter(sim, 'Ana');
    sim.time = DAY_LENGTH * 0.9;
    const before = sim.getPlayer('Ana')!.vitals.warmth;
    for (let i = 0; i < 50; i++) sim.step(0.1);
    expect(sim.getPlayer('Ana')!.vitals.warmth).toBeGreaterThanOrEqual(before);
  });
});

describe('boss', () => {
  function arena(...names: string[]) {
    const sim = setup(...names);
    for (const n of names) put(sim, n, DUNGEON.x, DUNGEON.bossZ - 3);
    sim.step(0.1);
    return sim;
  }
  const bossOf = (sim: WorldSim, name = 'Ana') => snap(sim, name).wolves.find((w) => w.kind === 'boss');
  const hp = (sim: WorldSim) => snap(sim, 'Ana').dungeon.boss?.hp;

  it('wakes when someone enters its room and shows a bar', () => {
    const sim = setup('Ana');
    sim.step(0.1);
    expect(bossOf(sim)).toBeUndefined();
    put(sim, 'Ana', DUNGEON.x, DUNGEON.bossZ - 3);
    sim.step(0.1);
    expect(bossOf(sim)).toMatchObject({ id: BOSS.id, kind: 'boss' });
    expect(snap(sim, 'Ana').dungeon.boss).toEqual({ hp: ENEMY.boss.hp, max: ENEMY.boss.hp, weak: false });
    expect(msgs(sim)).toContainEqual({ t: 'toast', text: expect.stringContaining('Tragón') });
  });

  it('folded paper shrugs off punches and arrows', () => {
    const sim = arena('Ana');
    sim.handle('Ana', { t: 'attack', id: BOSS.id });
    sim.getPlayer('Ana')!.yaw = 0;
    sim.handle('Ana', { t: 'shoot', id: BOSS.id });
    expect(hp(sim)).toBe(ENEMY.boss.hp);
    expect(msgs(sim)).toContainEqual({ t: 'toast', text: expect.stringContaining('aguanta') });
  });

  it('a parried bite unfolds it and then blows land', () => {
    const sim = arena('Ana');
    // Wait for the wind-up, then raise the guard just before the bite lands.
    let parried = false;
    for (let i = 0; i < 60 && !parried; i++) {
      if (bossOf(sim)!.anim === 'attack') {
        for (let k = 0; k < Math.round(BOSS.windup / 0.1) - 2; k++) sim.step(0.1);
        sim.handle('Ana', { t: 'block', on: true });
        for (let k = 0; k < 3; k++) sim.step(0.1);
      } else sim.step(0.1);
      parried = msgs(sim).some((m) => m.t === 'toast' && m.text.startsWith('Parada'));
    }
    expect(parried).toBe(true);
    expect(snap(sim, 'Ana').dungeon.boss!.weak).toBe(true);
    const before = hp(sim)!;
    expect(before).toBeLessThan(ENEMY.boss.hp); // the parry itself hurts
    sim.handle('Ana', { t: 'block', on: false });
    const b = snap(sim, 'Ana').wolves.find((w) => w.kind === 'boss')!;
    put(sim, 'Ana', b.x, b.z - 1.5);
    sim.handle('Ana', { t: 'attack', id: BOSS.id });
    expect(hp(sim)).toBe(before - 20);
  });

  it('Enredadera next to it tangles it: it stops and can be hurt', () => {
    const sim = arena('Ana');
    sim.getPlayer('Ana')!.enredadera = true;
    const b0 = bossOf(sim)!;
    put(sim, 'Ana', b0.x, b0.z - 4);
    sim.handle('Ana', { t: 'power', x: b0.x + 1.5, z: b0.z - 1 });
    expect(snap(sim, 'Ana').vines).toHaveLength(1);
    expect(snap(sim, 'Ana').dungeon.boss!.weak).toBe(true);
    expect(msgs(sim)).toContainEqual({ t: 'toast', text: expect.stringContaining('atrapa') });
    sim.step(1);
    expect(bossOf(sim)!.z).toBe(b0.z);
    put(sim, 'Ana', b0.x, b0.z - 2);
    sim.handle('Ana', { t: 'attack', id: BOSS.id });
    expect(hp(sim)).toBe(ENEMY.boss.hp - 20);
  });

  it('an empty room resets it', () => {
    const sim = arena('Ana');
    sim.getPlayer('Ana')!.enredadera = true;
    const b0 = bossOf(sim)!;
    put(sim, 'Ana', b0.x, b0.z - 2);
    sim.handle('Ana', { t: 'power', x: b0.x + 1.5, z: b0.z });
    sim.handle('Ana', { t: 'attack', id: BOSS.id });
    expect(hp(sim)).toBeLessThan(ENEMY.boss.hp);
    put(sim, 'Ana', DUNGEON.x, DUNGEON.altarZ);
    sim.step(0.1);
    expect(bossOf(sim)).toBeUndefined();
    put(sim, 'Ana', DUNGEON.x, DUNGEON.bossZ - 3);
    sim.step(0.1);
    expect(hp(sim)).toBe(ENEMY.boss.hp);
  });

  it('beaten, it is purified for good (saved), and old saves load', () => {
    const sim = arena('Ana');
    const b0 = bossOf(sim)!;
    put(sim, 'Ana', b0.x, b0.z - 2);
    sim.getPlayer('Ana')!.enredadera = true;
    for (let i = 0; i < 400 && hp(sim)! > 0; i++) {
      const b = bossOf(sim)!;
      const s = snap(sim, 'Ana');
      const ana = sim.getPlayer('Ana')!;
      ana.vitals = { ...ana.vitals, health: 100 };
      put(sim, 'Ana', b.x, b.z - 2);
      if (!s.dungeon.boss!.weak && s.self.powerLeft === 0) sim.handle('Ana', { t: 'power', x: b.x + 1.5, z: b.z });
      sim.handle('Ana', { t: 'attack', id: BOSS.id });
      sim.step(PUNCH.cooldown);
    }
    expect(snap(sim, 'Ana').dungeon.purified).toBe(true);
    expect(snap(sim, 'Ana').dungeon.boss).toBeNull();
    expect(msgs(sim)).toContainEqual({ t: 'toast', text: 'Ana derrotó al Tragón de Papel' });
    for (let i = 0; i < 60; i++) sim.step(0.1);
    expect(bossOf(sim)).toBeUndefined();
    const saved = sim.save();
    expect(saved.purified).toBe(true);
    const again = new WorldSim(saved);
    again.connect('Ana');
    again.step(0.1);
    expect(snap(again, 'Ana').dungeon.purified).toBe(true);
    expect(snap(again, 'Ana').wolves.find((w) => w.kind === 'boss')).toBeUndefined();
    delete saved.purified;
    const old = new WorldSim(saved);
    old.connect('Ana');
    expect(snap(old, 'Ana').dungeon.purified).toBe(false);
  });
});

describe('purified defender', () => {
  it('no defender until the boss is purified, and none without a living Heart', () => {
    const sim = setup('Ana');
    plantHeart(sim);
    sim.step(0.1);
    expect(snap(sim, 'Ana').ally).toBeNull();
    const saved = sim.save();
    saved.purified = true;
    saved.structures = [];
    const bare = new WorldSim(saved);
    bare.connect('Ana');
    bare.step(0.1);
    expect(snap(bare, 'Ana').ally).toBeNull();
  });

  it('with both, it waits by the Heart for everyone and bites raiders during a raid', () => {
    const sim = setup('Ana', 'Leo');
    const h = plantHeart(sim);
    sim.purified = true;
    put(sim, 'Leo', 200, 200);
    sim.step(0.1);
    expect(snap(sim, 'Leo').ally).toMatchObject({ x: h.x + ALLY.home, z: h.z });
    put(sim, 'Ana', 150, 150);
    sim.heart()!.hp = 100_000;
    stepTo(sim, 0.81);
    const w = sim.wolfList.find((x) => x.raid)!;
    const full = w.hp;
    w.stun = 100; // hold it still beside the Heart
    Object.assign(w, { x: h.x + 4, z: h.z });
    for (let i = 0; i < 15; i++) sim.step(0.1);
    expect(w.hp).toBeLessThanOrEqual(full - ALLY.damage);
  });
});

describe('taming the deer', () => {
  const atWild = (sim: WorldSim, name: string, dx = 1) => put(sim, name, sim.wild.x + dx, sim.wild.z);
  /** Wait until the needle reaches the zone centre and tap at exactly that sim time. */
  const tapPerfect = (sim: WorldSim, name: string) => {
    const t = snap(sim, name).self.tame!;
    const at = t.start + t.zone / t.speed;
    while (sim.time < at) sim.step(0.1);
    sim.handle(name, { t: 'mount', act: 1, at });
  };
  const texts = (sim: WorldSim) => msgs(sim).flatMap((m) => (m.t === 'toast' ? [m.text] : []));

  it('starts only within reach of the wild deer', () => {
    const sim = setup('Ana');
    put(sim, 'Ana', sim.wild.x + MOUNT.reach + 2, sim.wild.z);
    sim.handle('Ana', { t: 'mount', act: 0 });
    expect(snap(sim, 'Ana').self.tame).toBeNull();
    atWild(sim, 'Ana');
    sim.handle('Ana', { t: 'mount', act: 0 });
    const t = snap(sim, 'Ana').self.tame!;
    expect(t).toMatchObject({ round: 0, rounds: 3, speed: MOUNT.rounds[0].speed, width: MOUNT.rounds[0].width });
  });

  it('three good taps tame it; each round is faster and narrower', () => {
    const sim = setup('Ana');
    atWild(sim, 'Ana');
    sim.handle('Ana', { t: 'mount', act: 0 });
    tapPerfect(sim, 'Ana');
    expect(snap(sim, 'Ana').self.tame).toMatchObject({ round: 1, speed: MOUNT.rounds[1].speed, width: MOUNT.rounds[1].width });
    tapPerfect(sim, 'Ana');
    expect(snap(sim, 'Ana').self.tame!.round).toBe(2);
    tapPerfect(sim, 'Ana');
    const self = snap(sim, 'Ana').self;
    expect(self.tame).toBeNull();
    expect(self.steed).toBe(true);
    expect(sim.getPlayer('Ana')!.steed).toBeDefined();
    expect(texts(sim)).toContain('El ciervo es tuyo. A para bajar, A junto a él para montar');
    expect(self.riding).toBe(true);
  });

  it('a tap outside the zone throws you off and the deer needs a moment', () => {
    const sim = setup('Ana');
    atWild(sim, 'Ana');
    sim.handle('Ana', { t: 'mount', act: 0 });
    const t = snap(sim, 'Ana').self.tame!;
    const at = t.start + (t.zone + Math.PI) / t.speed; // opposite side of the ring
    while (sim.time < at) sim.step(0.1);
    sim.handle('Ana', { t: 'mount', act: 1, at });
    expect(snap(sim, 'Ana').self.tame).toBeNull();
    expect(texts(sim)).toContain('Te tira al suelo. Otra vez');
    sim.handle('Ana', { t: 'mount', act: 0 });
    expect(snap(sim, 'Ana').self.tame).toBeNull();
    for (let i = 0; i < 21; i++) sim.step(0.1);
    sim.handle('Ana', { t: 'mount', act: 0 });
    expect(snap(sim, 'Ana').self.tame).not.toBeNull();
  });

  it('a tap time far from now fails, even if it would hit the zone', () => {
    const sim = setup('Ana');
    atWild(sim, 'Ana');
    sim.handle('Ana', { t: 'mount', act: 0 });
    const t = snap(sim, 'Ana').self.tame!;
    const period = (2 * Math.PI) / t.speed;
    const at = t.start + t.zone / t.speed + period; // a later lap
    while (sim.time < at - period + 0.2) sim.step(0.1); // "now" is a whole lap before
    sim.handle('Ana', { t: 'mount', act: 1, at });
    expect(snap(sim, 'Ana').self.tame).toBeNull();
    expect(sim.getPlayer('Ana')!.steed).toBeUndefined();
  });

  it('waiting too long or walking off throws you', () => {
    const sim = setup('Ana');
    atWild(sim, 'Ana');
    sim.handle('Ana', { t: 'mount', act: 0 });
    for (let i = 0; i < MOUNT.roundTimeout * 10 + 2; i++) sim.step(0.1);
    expect(snap(sim, 'Ana').self.tame).toBeNull();
    for (let i = 0; i < 25; i++) sim.step(0.1);
    sim.handle('Ana', { t: 'mount', act: 0 });
    expect(snap(sim, 'Ana').self.tame).not.toBeNull();
    atWild(sim, 'Ana', MOUNT.leash + 1);
    sim.step(0.1);
    expect(snap(sim, 'Ana').self.tame).toBeNull();
  });

  it('a friend near the deer widens the zone', () => {
    const sim = setup('Ana', 'Leo');
    atWild(sim, 'Ana');
    sim.handle('Ana', { t: 'mount', act: 0 });
    expect(snap(sim, 'Ana').self.tame!.width).toBe(MOUNT.rounds[0].width);
    atWild(sim, 'Leo', -2);
    expect(snap(sim, 'Ana').self.tame!.width).toBeCloseTo(MOUNT.rounds[0].width * MOUNT.calmWidth, 2);
  });

  it('you only tame one', () => {
    const sim = setup('Ana');
    sim.getPlayer('Ana')!.steed = { x: 0, z: 0 };
    atWild(sim, 'Ana');
    sim.handle('Ana', { t: 'mount', act: 0 });
    expect(snap(sim, 'Ana').self.tame).toBeNull();
    expect(texts(sim)).toContain('Ya tienes montura');
  });
});

describe('riding the deer', () => {
  /** Ana owns a deer parked beside her at (x, z). */
  const owner = (x = 5, z = 5) => {
    const sim = setup('Ana');
    put(sim, 'Ana', x, z);
    sim.getPlayer('Ana')!.steed = { x: x + 1, z };
    return sim;
  };
  /** Try moving `dist` metres along +x after a 1 s pause. */
  const dash = (sim: WorldSim, dist: number) => {
    const p = sim.getPlayer('Ana')!;
    for (let i = 0; i < 10; i++) sim.step(0.1);
    const x = p.x + dist;
    sim.handle('Ana', { t: 'move', x, y: sim.terrain.heightAt(x, p.z), z: p.z, yaw: 0, anim: 'run' });
    return p.x === x;
  };

  it('gets on only beside your own deer, and off anywhere', () => {
    const sim = owner();
    put(sim, 'Ana', 20, 5);
    sim.handle('Ana', { t: 'mount', act: 2 });
    expect(snap(sim, 'Ana').self.riding).toBe(false);
    put(sim, 'Ana', 5, 5);
    sim.handle('Ana', { t: 'mount', act: 2 });
    expect(snap(sim, 'Ana').self.riding).toBe(true);
    put(sim, 'Ana', 8, 9);
    sim.handle('Ana', { t: 'mount', act: 3 });
    expect(snap(sim, 'Ana').self.riding).toBe(false);
    expect(sim.getPlayer('Ana')!.steed).toEqual({ x: 8, z: 9 });
    const other = setup('Leo');
    put(other, 'Leo', other.wild.x + 1, other.wild.z);
    other.handle('Leo', { t: 'mount', act: 2 });
    expect(snap(other, 'Leo').self.riding).toBe(false); // the wild deer is not yours
  });

  it('only riders get the deer speed (plus a short grace after getting off)', () => {
    const walker = owner(0, 0);
    expect(dash(walker, 12)).toBe(false);
    const rider = owner(0, 0);
    rider.handle('Ana', { t: 'mount', act: 2 });
    expect(dash(rider, 12)).toBe(true);
    expect(dash(rider, 15)).toBe(false);
    rider.handle('Ana', { t: 'mount', act: 3 });
    rider.step(0.1);
    rider.handle('Ana', { t: 'move', x: rider.getPlayer('Ana')!.x + 1, y: rider.getPlayer('Ana')!.y, z: 0, yaw: 0, anim: 'walk' });
    for (let i = 0; i < MOUNT.grace * 10 + 5; i++) rider.step(0.1);
    // The anchor window is now 2 s: a rider could cover 13 × 2 + 1 = 27 m, a walker only 19.
    expect(dash(rider, 21)).toBe(false);
  });

  it('the deer will not swim or climb', () => {
    const sim = owner(0, 0);
    let wet: { x: number; z: number } | null = null;
    for (let x = -200; x <= 200 && !wet; x += 2) for (let z = -200; z <= 200 && !wet; z += 2) if (sim.terrain.heightAt(x, z) < WATER_LEVEL - 1) wet = { x, z };
    expect(wet).not.toBeNull();
    put(sim, 'Ana', wet!.x, wet!.z);
    sim.getPlayer('Ana')!.steed = { x: wet!.x, z: wet!.z };
    sim.handle('Ana', { t: 'mount', act: 2 });
    sim.step(0.1);
    const before = sim.getPlayer('Ana')!.x;
    sim.handle('Ana', { t: 'move', x: before + 0.5, y: WATER_LEVEL - 0.9, z: wet!.z, yaw: 0, anim: 'walk' });
    expect(sim.getPlayer('Ana')!.x).toBe(before);
    const c = sim.crags[0]!;
    const cx = c.x + c.r + 0.5;
    put(sim, 'Ana', cx, c.z);
    sim.getPlayer('Ana')!.steed = { x: cx, z: c.z };
    const s2 = snap(sim, 'Ana');
    expect(s2.self.riding).toBe(true);
    sim.handle('Ana', { t: 'move', x: cx, y: sim.terrain.heightAt(cx, c.z) + 6, z: c.z, yaw: 0, anim: 'jump' });
    expect(sim.getPlayer('Ana')!.y).toBeLessThan(sim.terrain.heightAt(cx, c.z) + 1);
  });

  it('entering the Raíz-madre or dying leaves the deer where you were', () => {
    const sim = setup('Ana');
    const e = sim.entrance;
    put(sim, 'Ana', e.x + DUNGEON.trunkR + 1, e.z);
    const at = { x: Math.round(sim.getPlayer('Ana')!.x * 100) / 100, z: Math.round(sim.getPlayer('Ana')!.z * 100) / 100 };
    sim.getPlayer('Ana')!.steed = { ...at };
    sim.handle('Ana', { t: 'mount', act: 2 });
    sim.handle('Ana', { t: 'dungeon', act: 0 });
    expect(inDungeon(sim.getPlayer('Ana')!.x, sim.getPlayer('Ana')!.z)).toBe(true);
    expect(snap(sim, 'Ana').self.riding).toBe(false);
    expect(sim.getPlayer('Ana')!.steed).toEqual(at);
    sim.handle('Ana', { t: 'mount', act: 2 });
    expect(snap(sim, 'Ana').self.riding).toBe(false);

    const d = owner(3, 3);
    d.handle('Ana', { t: 'mount', act: 2 });
    down(d, 'Ana');
    expect(d.getPlayer('Ana')!.dead).toBe(true);
    expect(snap(d, 'Ana').self.riding).toBe(false);
    expect(d.getPlayer('Ana')!.steed).toEqual({ x: 3, z: 3 });
  });

  it('others see the wild deer, parked deer and who rides', () => {
    const sim = setup('Ana', 'Leo');
    put(sim, 'Ana', 5, 5);
    put(sim, 'Leo', 6, 5);
    sim.getPlayer('Ana')!.steed = { x: 6, z: 5 };
    let s = snap(sim, 'Leo');
    expect(s.steeds.filter((v) => v.owner === 'Ana')).toHaveLength(1);
    expect(s.players.find((p) => p.name === 'Ana')!.ride).toBeNull();
    sim.handle('Ana', { t: 'mount', act: 2 });
    s = snap(sim, 'Leo');
    expect(s.steeds.filter((v) => v.owner === 'Ana')).toHaveLength(0);
    expect(s.players.find((p) => p.name === 'Ana')!.ride).toBe('deer');
    put(sim, 'Leo', sim.wild.x, sim.wild.z + 2);
    expect(snap(sim, 'Leo').steeds.some((v) => v.owner === null)).toBe(true);
  });

  it('the deer is saved; old saves without one still load', () => {
    const sim = owner(2, 2);
    const saved = sim.save();
    expect(saved.players[0]!.steed).toEqual({ x: 3, z: 2 });
    const again = new WorldSim(saved);
    again.connect('Ana');
    expect(snap(again, 'Ana').self).toMatchObject({ steed: true, riding: false });
    const old = sim.save();
    delete old.players[0]!.steed;
    const legacy = new WorldSim(old);
    legacy.connect('Ana');
    expect(snap(legacy, 'Ana').self).toMatchObject({ steed: false, riding: false, tame: null });
  });
});

import { MARCHITO, marchitoWill, VISION } from './marchito';

describe('El Marchito', () => {
  type Priv = { boss: { hp: number } | null; marchito: { x: number; z: number; hp: number; laugh: number } | null; structures: { id: number; kind: string; x: number; y: number; z: number; rot: number; owner: string; hp: number }[] };
  const priv = (sim: WorldSim) => sim as unknown as Priv;
  const visions = (m: ServerMsg[]) => m.filter((x): x is Extract<ServerMsg, { t: 'vision' }> => x.t === 'vision');

  /** A base with a Heart and some walls, then the Tragón falls with Ana and Leo online. */
  function beaten(walls = 4) {
    const sim = setup('Ana', 'Leo');
    const h = plantHeart(sim);
    for (let i = 0; i < walls; i++) priv(sim).structures.push({ id: 700 + i, kind: 'wall', x: h.x + 3 + i * 3, y: 0, z: h.z, rot: 0, owner: 'Ana', hp: STRUCTURE_HP.wall });
    put(sim, 'Ana', DUNGEON.x, DUNGEON.bossZ - 3);
    sim.step(0.1);
    priv(sim).boss!.hp = 0;
    sim.step(0.1);
    put(sim, 'Ana', h.x + 60, h.z + 60); // out of his way
    put(sim, 'Leo', h.x - 60, h.z - 60);
    return { sim, h };
  }
  const arrive = (sim: WorldSim) => {
    for (let i = 0; i < MARCHITO.delay * 10 + 2 && !priv(sim).marchito; i++) sim.step(0.1);
  };

  it('beating the Tragón sends a vision naming the players and owes an invasion (saved)', () => {
    const { sim } = beaten();
    const v = visions(msgs(sim));
    expect(v[0]!.lines.join(' ')).toContain('Ana y Leo');
    expect(sim.invasion).toBe('pending');
    expect(sim.save().invasion).toBe('pending');
    expect(new WorldSim(sim.save()).invasion).toBe('pending');
  });

  it('an old world that already beat the Tragón is never invaded', () => {
    const sim = setup('Ana');
    plantHeart(sim);
    const saved = sim.save();
    saved.purified = true;
    expect(saved.invasion).toBeUndefined();
    const old = new WorldSim(saved);
    old.connect('Ana');
    for (let i = 0; i < 400; i++) old.step(0.1);
    expect(snap(old, 'Ana').marchito).toBeNull();
    expect(old.invasion).toBe('none');
  });

  it('arrives after the delay from the Raíz-madre side, and shows himself', () => {
    const { sim, h } = beaten();
    msgs(sim);
    for (let i = 0; i < MARCHITO.delay * 10 - 5; i++) sim.step(0.1);
    expect(priv(sim).marchito).toBeNull();
    arrive(sim);
    const m = priv(sim).marchito!;
    expect(m).not.toBeNull();
    expect(visions(msgs(sim))[0]!.lines).toEqual(VISION.arrive);
    const e = sim.entrance;
    const toRoot = Math.atan2(e.x - h.x, e.z - h.z);
    const toHim = Math.atan2(m.x - h.x, m.z - h.z);
    expect(Math.abs(Math.atan2(Math.sin(toRoot - toHim), Math.cos(toRoot - toHim)))).toBeLessThan(0.3);
    expect(snap(sim, 'Ana').marchito).toEqual({ will: marchitoWill(2), max: marchitoWill(2), laughing: false });
    put(sim, 'Ana', m.x + 5, m.z);
    expect(snap(sim, 'Ana').wolves.find((w) => w.kind === 'marchito')).toMatchObject({ id: MARCHITO.id });
  });

  it('smashes the nearer half of the defenses, never the Heart, laughs and leaves for good', () => {
    const { sim, h } = beaten(4);
    arrive(sim);
    msgs(sim);
    const out: ServerMsg[] = [];
    for (let i = 0; i < 1500 && priv(sim).marchito; i++) {
      sim.step(0.1);
      out.push(...msgs(sim));
    }
    expect(priv(sim).marchito).toBeNull();
    const wrecked = out.filter((m) => m.t === 'wrecked').map((m) => (m as { id: number }).id);
    expect(wrecked.sort()).toEqual([700, 701]);
    expect(sim.save().structures.map((s) => s.id)).toEqual(expect.arrayContaining([h.id, 702, 703]));
    expect(sim.heart()!.hp).toBe(STRUCTURE_HP.heart);
    expect(visions(out).map((v) => v.lines)).toContainEqual(VISION.laugh);
    expect(sim.invasion).toBe('done');
    expect(sim.save().invasion).toBe('done');
    for (let i = 0; i < 400; i++) sim.step(0.1);
    expect(priv(sim).marchito).toBeNull();
  });

  it('blows wear his voluntad; at 0 he is driven off. He mocks each player once', () => {
    const { sim } = beaten();
    arrive(sim);
    msgs(sim);
    const m = priv(sim).marchito!;
    put(sim, 'Ana', m.x + 1, m.z);
    sim.getPlayer('Ana')!.vitals.health = 100;
    sim.handle('Ana', { t: 'attack', id: MARCHITO.id });
    expect(m.hp).toBe(marchitoWill(2) - PUNCH.damage);
    sim.step(PUNCH.cooldown);
    sim.handle('Ana', { t: 'attack', id: MARCHITO.id });
    const taunts = msgs(sim).filter((x) => x.t === 'toast' && x.text === VISION.taunt('Ana'));
    expect(taunts).toHaveLength(1);
    m.hp = 1;
    sim.step(PUNCH.cooldown);
    put(sim, 'Ana', m.x + 1, m.z);
    sim.handle('Ana', { t: 'attack', id: MARCHITO.id });
    expect(priv(sim).marchito).toBeNull();
    expect(visions(msgs(sim))[0]!.lines.join(' ')).toContain('Ana');
    expect(sim.invasion).toBe('done');
    expect(sim.save().structures.filter((s) => s.kind === 'wall').length).toBeGreaterThan(0);
  });

  it('swats a player standing next to him', () => {
    const { sim } = beaten();
    arrive(sim);
    const m = priv(sim).marchito!;
    put(sim, 'Leo', m.x + 1, m.z);
    sim.step(0.1);
    expect(sim.getPlayer('Leo')!.vitals.health).toBe(100 - ENEMY.marchito.damage);
  });

  it('freezes while nobody is active, and a mid-invasion save owes it again', () => {
    const { sim } = beaten();
    arrive(sim);
    const m = priv(sim).marchito!;
    const at = { x: m.x, z: m.z };
    sim.markAway('Ana');
    sim.markAway('Leo');
    for (let i = 0; i < 20; i++) sim.step(0.1);
    expect({ x: m.x, z: m.z }).toEqual(at);
    expect(sim.save().invasion).toBe('pending');
  });

  it('waits while everyone is inside the Raíz-madre', () => {
    const { sim } = beaten();
    put(sim, 'Ana', DUNGEON.x, DUNGEON.entryZ + 2);
    put(sim, 'Leo', DUNGEON.x, DUNGEON.entryZ + 3);
    for (let i = 0; i < MARCHITO.delay * 10 + 20; i++) sim.step(0.1);
    expect(priv(sim).marchito).toBeNull();
    put(sim, 'Ana', 0, 0);
    sim.step(0.1);
    expect(priv(sim).marchito).not.toBeNull();
  });
});

describe('corruption from the Raíz-madre', () => {
  it('raids are warned from the Raíz-madre side of the Heart (once the other zones are clean)', () => {
    for (const seed of [1, 42, 777]) {
      // Rule change (cierre S1): raids come from the nearest corrupt zone; with only zone 0 left, that is the Raíz-madre.
      const w = newWorld(seed, 's');
      const probe = new WorldSim(w);
      w.cleansed = probe.zones.filter((z) => z.id !== 0).map((z) => z.id);
      const sim = new WorldSim(w);
      sim.createPlayer('Ana', 'h');
      sim.connect('Ana');
      const h = plantHeart(sim);
      stepTo(sim, RAID.warnAt + 0.01);
      const toRoot = Math.atan2(sim.entrance.x - h.x, sim.entrance.z - h.z);
      const d = sim.raidState()!.dir - toRoot;
      expect(Math.abs(Math.atan2(Math.sin(d), Math.cos(d)))).toBeLessThanOrEqual(RAID.jitter / 2 + 1e-9);
      expect(msgs(sim)).toContainEqual({ t: 'toast', text: expect.stringContaining('hacia la Raíz-madre') });
    }
  });

  it('once purified, waves are smaller and bring no brutes', () => {
    const sim = setup('Ana', 'Leo');
    calmCoast(sim); // Rule change (S2-D): coast zones add raid brutes; these tests count forest waves only.
    plantHeart(sim);
    sim.raidLevel = 2;
    sim.purified = true;
    stepTo(sim, 0.81);
    const raiders = sim.wolfList.filter((w) => w.raid);
    const full = RAID.base + RAID.perLevel * 2 + RAID.perPlayer;
    expect(raiders.length).toBe(Math.ceil(full * RAID.cleansed));
    expect(raiders.some((w) => w.kind === 'brute')).toBe(false);
    expect(msgs(sim)).toContainEqual({ t: 'toast', text: expect.stringContaining('Vienen menos') });
  });
});

describe('corruption by zones', () => {
  type Priv = { boss: { hp: number } | null };
  it('every zone starts corrupt; the snap and the save carry it; old saves load', () => {
    const sim = setup('Ana');
    const all = sim.zones.map((z) => z.id);
    expect(all.length).toBeGreaterThanOrEqual(4);
    expect(snap(sim, 'Ana').corrupt).toEqual(all);
    expect(sim.save().cleansed).toBeUndefined();
    const saved = sim.save();
    saved.cleansed = [1];
    expect(new WorldSim(saved).corrupt()).toEqual(all.filter((i) => i !== 1));
    const old = sim.save();
    old.purified = true; // an old world that beat the Tragón before zones existed
    expect(new WorldSim(old).corrupt()).not.toContain(0);
  });

  it('raids come from the nearest corrupt zone', () => {
    const sim = setup('Ana');
    const h = plantHeart(sim);
    const corrupt = sim.corrupt();
    const near = [...sim.zones].filter((z) => corrupt.includes(z.id)).sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z))[0]!;
    stepTo(sim, RAID.warnAt + 0.01);
    const to = Math.atan2(near.x - h.x, near.z - h.z);
    const d = sim.raidState()!.dir - to;
    expect(Math.abs(Math.atan2(Math.sin(d), Math.cos(d)))).toBeLessThanOrEqual(RAID.jitter / 2 + 1e-9);
  });

  it('beating the Tragón cleanses zone 0 (saved)', () => {
    const sim = setup('Ana');
    put(sim, 'Ana', DUNGEON.x, DUNGEON.bossZ - 3);
    sim.step(0.1);
    (sim as unknown as Priv).boss!.hp = 0;
    sim.step(0.1);
    expect(sim.corrupt()).not.toContain(0);
    expect(sim.save().cleansed).toContain(0);
  });

  it('Enredadera at a zone\'s withered root cleanses it', () => {
    const sim = setup('Ana');
    sim.getPlayer('Ana')!.enredadera = true;
    const z = sim.zones.find((x) => x.id !== 0)!;
    put(sim, 'Ana', z.x - 3, z.z);
    msgs(sim);
    sim.handle('Ana', { t: 'power', x: z.x, z: z.z });
    expect(sim.corrupt()).not.toContain(z.id);
    expect(msgs(sim)).toContainEqual({ t: 'toast', text: expect.stringContaining('El bosque respira') });
  });

  it('a shrine orb cleanses the corrupt zone nearest that shrine', () => {
    const sim = setup('Ana');
    const i = sim.shrines.findIndex((s) => s.kind === 'ledge');
    const s = sim.shrines[i]!;
    const p = sim.getPlayer('Ana')!;
    Object.assign(p, { x: s.orb.x, y: s.orb.y, z: s.orb.z });
    const before = sim.corrupt();
    sim.handle('Ana', { t: 'shrine', id: i, part: 0 });
    expect(p.shrines).toContain(i);
    expect(sim.corrupt().length).toBe(before.length - 1);
    expect(sim.corrupt()).toContain(0);
  });

  it('a night in a corrupt zone brings extra beasts, one a brute', () => {
    const count = (clean: boolean) => {
      const w = newWorld(42, 'salt');
      const probe = new WorldSim(w);
      const z = probe.zones.find((x) => x.id !== 0)!;
      if (clean) w.cleansed = [z.id];
      const sim = new WorldSim(w);
      sim.createPlayer('Ana', 'h');
      sim.connect('Ana');
      put(sim, 'Ana', z.x, z.z);
      stepTo(sim, 0.81);
      return sim.wolfList.filter((x) => !x.raid);
    };
    const dirty = count(false);
    const clean = count(true);
    expect(dirty.length).toBe(clean.length + CORRUPTION.extraWolves);
    expect(dirty.some((w) => w.kind === 'brute')).toBe(true);
  });
});

describe('dungeon: four puzzles and the mini-boss (cierre S1)', () => {
  type Priv = { elite: { hp: number; windup: number; charge: number; chargeReady: number; x: number; z: number } | null; boss: unknown };
  const priv = (sim: WorldSim) => sim as unknown as Priv;
  const act = (sim: WorldSim, name: string, a: number) => sim.handle(name, { t: 'dungeon', act: a });
  const at = (p: { x: number; z: number }) => inside(p);
  const view = (sim: WorldSim) => snap(sim, 'Ana').dungeon;
  const tryCross = (sim: WorldSim, gz: number) => {
    put(sim, 'Ana', DUNGEON.x, gz - 1);
    for (let i = 0; i < 11; i++) sim.step(0.1); // let the move anchor catch up with the teleport
    sim.handle('Ana', { t: 'move', x: DUNGEON.x, y: DUNGEON.floor, z: gz + 0.2, yaw: 0, anim: 'walk' });
    return sim.getPlayer('Ana')!.z > gz;
  };

  it('all five gates start shut and block the way', () => {
    const sim = setup('Ana');
    expect(view(sim).gates).toEqual([false, false, false, false, false]);
    for (const gz of DUNGEON.gatesZ) expect(tryCross(sim, gz)).toBe(false);
  });

  it('gate 1: Enredadera grown at the knot opens it', () => {
    const sim = setup('Ana');
    sim.getPlayer('Ana')!.enredadera = true;
    const k = at(DUNGEON.knot);
    put(sim, 'Ana', k.x, k.z - 4);
    sim.handle('Ana', { t: 'power', x: k.x, z: k.z - 1.5 });
    expect(view(sim).gates[1]).toBe(true);
    expect(tryCross(sim, DUNGEON.gatesZ[1])).toBe(true);
  });

  it('gate 2: a friend on the plate holds it; it jams open once someone is through', () => {
    const sim = setup('Ana', 'Leo');
    const pl = at(DUNGEON.plate);
    put(sim, 'Leo', pl.x, pl.z);
    sim.step(0.1);
    expect(view(sim).plate).toBe(true);
    expect(view(sim).gates[2]).toBe(true);
    expect(tryCross(sim, DUNGEON.gatesZ[2])).toBe(true);
    sim.step(0.1);
    put(sim, 'Leo', pl.x + 6, pl.z);
    for (let i = 0; i < 30; i++) sim.step(0.1);
    expect(view(sim).gates[2]).toBe(true); // jammed: nobody gets locked in
  });

  it('gate 2 solo: the plate alone closes too fast, the block holds it', () => {
    const sim = setup('Ana');
    const pl = at(DUNGEON.plate);
    put(sim, 'Ana', pl.x, pl.z);
    sim.step(0.1);
    put(sim, 'Ana', DUNGEON.x, DUNGEON.gatesZ[2] - 8);
    for (let i = 0; i < 20; i++) sim.step(0.1);
    expect(view(sim).gates[2]).toBe(false);
    const b = at(DUNGEON.blockStart);
    put(sim, 'Ana', b.x, b.z);
    act(sim, 'Ana', 5);
    expect(view(sim).block.held).toBe('Ana');
    put(sim, 'Ana', pl.x, pl.z);
    sim.step(0.1);
    expect(view(sim).block).toMatchObject({ held: 'Ana' });
    act(sim, 'Ana', 5); // drop it on the plate
    expect(view(sim).block).toMatchObject({ held: null });
    expect(tryCross(sim, DUNGEON.gatesZ[2])).toBe(true);
  });

  it('gate 3: carry the lantern to the brazier; one thing at a time', () => {
    const sim = setup('Ana');
    const b = at(DUNGEON.blockStart);
    put(sim, 'Ana', b.x, b.z);
    act(sim, 'Ana', 5);
    const ln = at(DUNGEON.lantern);
    put(sim, 'Ana', ln.x, ln.z);
    sim.step(0.1);
    act(sim, 'Ana', 6);
    expect(view(sim).lantern.held).toBeNull(); // hands full
    act(sim, 'Ana', 5);
    act(sim, 'Ana', 6);
    expect(view(sim).lantern.held).toBe('Ana');
    act(sim, 'Ana', 7); // too far from the brazier
    expect(view(sim).lit).toBe(false);
    const br = at(DUNGEON.brazier);
    put(sim, 'Ana', br.x + 1, br.z);
    sim.step(0.1);
    act(sim, 'Ana', 7);
    expect(view(sim)).toMatchObject({ lit: true, lantern: { held: null } });
    expect(view(sim).gates[3]).toBe(true);
  });

  it('a carrier who leaves the Raíz-madre gives the thing back to its place', () => {
    const sim = setup('Ana');
    const ln = at(DUNGEON.lantern);
    put(sim, 'Ana', ln.x, ln.z);
    act(sim, 'Ana', 6);
    put(sim, 'Ana', 0, 0);
    sim.step(0.1);
    expect(view(sim).lantern).toEqual({ x: ln.x, z: ln.z, held: null });
  });

  it('gate 4: the bruto reforzado wakes in its room, charges with a warning, and its fall opens the way', () => {
    const sim = setup('Ana');
    put(sim, 'Ana', DUNGEON.x, DUNGEON.eliteZ - 9);
    sim.step(0.1);
    const e = priv(sim).elite!;
    expect(e).not.toBeNull();
    expect(snap(sim, 'Ana').wolves.find((w) => w.kind === 'elite')).toMatchObject({ id: ELITE.id });
    e.chargeReady = 0;
    let warned = false;
    for (let i = 0; i < 30; i++) {
      put(sim, 'Ana', DUNGEON.x, DUNGEON.eliteZ - 9);
      sim.step(0.1);
      if (view(sim).elite?.charging) warned = true;
    }
    expect(warned).toBe(true);
    expect(sim.getPlayer('Ana')!.vitals.health).toBeLessThan(100);
    // an empty room resets it
    put(sim, 'Ana', DUNGEON.x, DUNGEON.eliteRoomZ - 5);
    sim.step(0.1);
    expect(priv(sim).elite).toBeNull();
    put(sim, 'Ana', DUNGEON.x, DUNGEON.eliteZ - 2);
    sim.step(0.1);
    priv(sim).elite!.hp = 1;
    sim.step(PUNCH.cooldown);
    const e2 = priv(sim).elite!;
    put(sim, 'Ana', e2.x, e2.z - 1);
    sim.handle('Ana', { t: 'attack', id: ELITE.id });
    sim.step(0.1);
    expect(view(sim).gates[4]).toBe(true);
    expect(msgs(sim)).toContainEqual({ t: 'toast', text: expect.stringContaining('derrotó al bruto reforzado') });
  });

  it('rolling through the charge takes no damage', () => {
    const sim = setup('Ana');
    put(sim, 'Ana', DUNGEON.x, DUNGEON.eliteZ - 9);
    sim.step(0.1);
    const e = priv(sim).elite!;
    e.chargeReady = 0;
    for (let i = 0; i < 40; i++) {
      put(sim, 'Ana', DUNGEON.x, DUNGEON.eliteZ - 9);
      if (e.charge > 0 && Math.abs(e.z - (DUNGEON.eliteZ - 9)) < 5) sim.handle('Ana', { t: 'roll' });
      if (e.charge === 0 && e.windup === 0 && i > 15) break;
      sim.step(0.1);
    }
    expect(sim.getPlayer('Ana')!.vitals.health).toBe(100);
  });
});

describe('la Ciénaga and the deep sea', () => {
  const MUD_Z = HALF + 5;
  const texts = (sim: WorldSim) => msgs(sim).flatMap((m) => (m.t === 'toast' ? [m.text] : []));

  it('the mud bites walkers (~8 PV/s) but not riders', () => {
    const sim = setup('Ana', 'Leo', 'Eva');
    put(sim, 'Ana', 0, MUD_Z);
    put(sim, 'Leo', 5, 5);
    put(sim, 'Eva', 10, MUD_Z);
    sim.getPlayer('Eva')!.steed = { x: 10, z: MUD_Z };
    sim.handle('Eva', { t: 'mount', act: 2 });
    for (let i = 0; i < 50; i++) sim.step(0.1);
    const hp = (n: string) => sim.getPlayer(n)!.vitals.health;
    // ~40 lost; health regen claws a little back while hurt.
    expect(hp('Leo') - hp('Ana')).toBeGreaterThan(CIENAGA.dps * 5 - 4);
    expect(hp('Leo') - hp('Ana')).toBeLessThanOrEqual(CIENAGA.dps * 5);
    expect(hp('Eva')).toBe(hp('Leo'));
    expect(texts(sim).some((t) => t.includes('barro'))).toBe(true);
  });

  it('walkers wade through the mud slowly; the deer gallops', () => {
    const tryMove = (riding: boolean, dist: number) => {
      const sim = setup('Ana');
      put(sim, 'Ana', 0, MUD_Z);
      if (riding) {
        sim.getPlayer('Ana')!.steed = { x: 0, z: MUD_Z };
        sim.handle('Ana', { t: 'mount', act: 2 });
      }
      for (let i = 0; i < 11; i++) sim.step(0.1);
      sim.handle('Ana', { t: 'move', x: dist, y: sim.terrain.heightAt(dist, MUD_Z), z: MUD_Z, yaw: 0, anim: 'walk' });
      return sim.getPlayer('Ana')!.x === dist;
    };
    expect(tryMove(false, 2.5)).toBe(true);
    expect(tryMove(false, 8)).toBe(false);
    expect(tryMove(true, 8)).toBe(true);
  });

  it('the current turns deep-sea swimmers back, but lets them head for shore', () => {
    const sim = setup('Ana');
    const x = -HALF + 45;
    const z = HALF + 100;
    const p = sim.getPlayer('Ana')!;
    Object.assign(p, { x, z, y: WATER_LEVEL - 0.9 });
    for (let i = 0; i < 11; i++) sim.step(0.1);
    sim.handle('Ana', { t: 'move', x, y: WATER_LEVEL - 0.9, z: z + 1, yaw: 0, anim: 'walk' });
    expect(p.z).toBe(z);
    expect(texts(sim)).toContain('La corriente te devuelve');
    sim.handle('Ana', { t: 'move', x, y: WATER_LEVEL - 0.9, z: z - 1, yaw: 0, anim: 'walk' });
    expect(p.z).toBe(z - 1);
    // Gliding over the sea is not swimming: heading out is fine in the air.
    Object.assign(p, { y: WATER_LEVEL + 3 });
    sim.handle('Ana', { t: 'move', x, y: WATER_LEVEL + 2.9, z: z, yaw: 0, anim: 'jump' });
    expect(p.z).toBe(z);
  });
});

describe('the deer carries two', () => {
  /** Leo rides his deer at (x, z); Ana (and Eva) stand beside him. */
  const pair = (x = 5, z = 5) => {
    const sim = setup('Leo', 'Ana', 'Eva');
    put(sim, 'Leo', x, z);
    sim.getPlayer('Leo')!.steed = { x, z };
    sim.handle('Leo', { t: 'mount', act: 2 });
    put(sim, 'Ana', x + 1.5, z);
    put(sim, 'Eva', x - 1.5, z);
    return sim;
  };
  const self = (sim: WorldSim, n: string) => snap(sim, n).self;

  it('a walker sits behind a nearby rider; one passenger per deer', () => {
    const sim = pair();
    sim.handle('Ana', { t: 'mount', act: 4 });
    expect(self(sim, 'Ana').seat).toBe('Leo');
    sim.handle('Eva', { t: 'mount', act: 4 });
    expect(self(sim, 'Eva').seat).toBeNull();
    expect(snap(sim, 'Eva').players.find((p) => p.name === 'Ana')!.seat).toBe('Leo');
    const far = pair();
    put(far, 'Ana', 5 + MOUNT.reach + 2, 5);
    far.handle('Ana', { t: 'mount', act: 4 });
    expect(self(far, 'Ana').seat).toBeNull();
  });

  it('the passenger goes where the rider goes, ignoring its own moves, and takes no mud', () => {
    const z = HALF + 5;
    const sim = pair(0, z);
    sim.handle('Ana', { t: 'mount', act: 4 });
    for (let i = 0; i < 11; i++) sim.step(0.1);
    const leo = sim.getPlayer('Leo')!;
    sim.handle('Leo', { t: 'move', x: 10, y: sim.terrain.heightAt(10, z), z, yaw: Math.PI / 2, anim: 'run' });
    expect(leo.x).toBe(10);
    sim.handle('Ana', { t: 'move', x: -3, y: 0, z, yaw: 1, anim: 'walk' });
    sim.step(0.1);
    const ana = sim.getPlayer('Ana')!;
    expect(ana.x).toBeCloseTo(10 - MOUNT.seatBack, 5);
    expect(ana.z).toBeCloseTo(z, 5);
    expect(self(sim, 'Ana').fix).toBe(false);
    for (let i = 0; i < 30; i++) sim.step(0.1);
    expect(ana.vitals.health).toBe(leo.vitals.health);
  });

  it('getting off, the rider dismounting or dying drops the passenger', () => {
    const a = pair();
    a.handle('Ana', { t: 'mount', act: 4 });
    a.handle('Ana', { t: 'mount', act: 5 });
    expect(self(a, 'Ana').seat).toBeNull();
    expect(self(a, 'Leo').riding).toBe(true);
    const b = pair();
    b.handle('Ana', { t: 'mount', act: 4 });
    b.handle('Leo', { t: 'mount', act: 3 });
    expect(self(b, 'Ana').seat).toBeNull();
    const c = pair();
    c.handle('Ana', { t: 'mount', act: 4 });
    down(c, 'Leo');
    c.step(0.1);
    expect(self(c, 'Ana').seat).toBeNull();
  });

  it('riders cannot board, and a seated passenger cannot mount or tame', () => {
    const sim = pair();
    sim.getPlayer('Ana')!.steed = { x: 6.5, z: 5 };
    sim.handle('Ana', { t: 'mount', act: 2 });
    sim.handle('Ana', { t: 'mount', act: 4 });
    expect(self(sim, 'Ana').seat).toBeNull();
    sim.handle('Ana', { t: 'mount', act: 3 });
    sim.handle('Ana', { t: 'mount', act: 4 });
    expect(self(sim, 'Ana').seat).toBe('Leo');
    sim.handle('Ana', { t: 'mount', act: 2 });
    expect(self(sim, 'Ana').riding).toBe(false);
  });
});

describe('taming the giant fish', () => {
  const atFish = (sim: WorldSim, name: string, dx = 1) => put(sim, name, sim.fishHome.x + dx, sim.fishHome.z);
  const texts = (sim: WorldSim) => msgs(sim).flatMap((m) => (m.t === 'toast' ? [m.text] : []));
  const race = (sim: WorldSim, name: string, upTo: number = FISH.rings) => {
    for (let i = 0; i < upTo; i++) {
      const r = sim.fishRings[i]!;
      put(sim, name, r.x + 1, r.z);
      sim.step(0.1);
    }
  };
  const tapPerfect = (sim: WorldSim, name: string) => {
    const t = snap(sim, name).self.tame!;
    const at = t.start + t.zone / t.speed;
    while (sim.time < at) sim.step(0.1);
    sim.handle(name, { t: 'mount', act: 1, at });
  };

  it('A near the fish starts the ring race; far away does nothing', () => {
    const sim = setup('Ana');
    atFish(sim, 'Ana', FISH.reach + 3);
    sim.handle('Ana', { t: 'mount', act: 6 });
    expect(snap(sim, 'Ana').self.race).toBeNull();
    atFish(sim, 'Ana');
    sim.handle('Ana', { t: 'mount', act: 6 });
    expect(snap(sim, 'Ana').self.race).toMatchObject({ i: 0 });
    expect(snap(sim, 'Ana').fish.some((f) => f.owner === null)).toBe(true);
  });

  it('rings count in order; the last one starts the 2-round ring', () => {
    const sim = setup('Ana');
    atFish(sim, 'Ana');
    sim.handle('Ana', { t: 'mount', act: 6 });
    const r2nd = sim.fishRings[1]!;
    put(sim, 'Ana', r2nd.x, r2nd.z); // skipping ring 1 does not count
    sim.step(0.1);
    expect(snap(sim, 'Ana').self.race!.i).toBe(0);
    race(sim, 'Ana', 3);
    expect(snap(sim, 'Ana').self.race!.i).toBe(3);
    race(sim, 'Ana');
    const self = snap(sim, 'Ana').self;
    expect(self.race).toBeNull();
    expect(self.tame).toMatchObject({ round: 0, rounds: 2, speed: FISH.rounds[0].speed, width: FISH.rounds[0].width });
  });

  it('too slow: it gets away, and needs 3 s before another try', () => {
    const sim = setup('Ana');
    atFish(sim, 'Ana');
    sim.handle('Ana', { t: 'mount', act: 6 });
    for (let i = 0; i < FISH.ringTime * 10 + 2; i++) sim.step(0.1);
    expect(snap(sim, 'Ana').self.race).toBeNull();
    expect(texts(sim)).toContain('Se escapa');
    sim.handle('Ana', { t: 'mount', act: 6 });
    expect(snap(sim, 'Ana').self.race).toBeNull();
    for (let i = 0; i < FISH.retry * 10 + 2; i++) sim.step(0.1);
    sim.handle('Ana', { t: 'mount', act: 6 });
    expect(snap(sim, 'Ana').self.race).not.toBeNull();
  });

  it('two good taps: the fish is yours and you ride it', () => {
    const sim = setup('Ana', 'Leo');
    put(sim, 'Leo', 0, 0);
    atFish(sim, 'Ana');
    sim.handle('Ana', { t: 'mount', act: 6 });
    race(sim, 'Ana');
    tapPerfect(sim, 'Ana');
    expect(snap(sim, 'Ana').self.tame!.round).toBe(1);
    tapPerfect(sim, 'Ana');
    const self = snap(sim, 'Ana').self;
    expect(self.tame).toBeNull();
    expect(self.fish).toBe(true);
    expect(self.onFish).toBe(true);
    expect(self.riding).toBe(false);
    expect(sim.getPlayer('Ana')!.fish).toBeDefined();
    const last = sim.fishRings[FISH.rings - 1]!;
    put(sim, 'Leo', last.x + 3, last.z);
    expect(snap(sim, 'Leo').players.find((p) => p.name === 'Ana')!.ride).toBe('fish');
  });

  it('a bad tap sends it off; a friend nearby widens the zone', () => {
    const sim = setup('Ana', 'Leo');
    atFish(sim, 'Ana');
    sim.handle('Ana', { t: 'mount', act: 6 });
    race(sim, 'Ana');
    const last = sim.fishRings[FISH.rings - 1]!;
    expect(snap(sim, 'Ana').self.tame!.width).toBe(FISH.rounds[0].width);
    put(sim, 'Leo', last.x - 2, last.z);
    expect(snap(sim, 'Ana').self.tame!.width).toBeCloseTo(FISH.rounds[0].width * MOUNT.calmWidth, 2);
    const t = snap(sim, 'Ana').self.tame!;
    const at = t.start + (t.zone + Math.PI) / t.speed;
    while (sim.time < at) sim.step(0.1);
    sim.handle('Ana', { t: 'mount', act: 1, at });
    expect(snap(sim, 'Ana').self.tame).toBeNull();
    expect(sim.getPlayer('Ana')!.fish).toBeUndefined();
    expect(texts(sim)).toContain('Se sacude y se va. Otra vez');
  });

  it('you only tame one fish', () => {
    const sim = setup('Ana');
    sim.getPlayer('Ana')!.fish = { x: 0, z: HALF + 70 };
    atFish(sim, 'Ana');
    sim.handle('Ana', { t: 'mount', act: 6 });
    expect(snap(sim, 'Ana').self.race).toBeNull();
    expect(texts(sim)).toContain('Ya tienes pez');
  });
});

describe('riding the giant fish', () => {
  const texts = (sim: WorldSim) => msgs(sim).flatMap((m) => (m.t === 'toast' ? [m.text] : []));
  const SURF = WATER_LEVEL - 0.9;
  /** Ana on her fish at (x, z). */
  const rider = (x?: number, z?: number) => {
    const sim = setup('Ana');
    const at = { x: x ?? sim.fishHome.x, z: z ?? sim.fishHome.z };
    put(sim, 'Ana', at.x, at.z);
    sim.getPlayer('Ana')!.y = SURF;
    sim.getPlayer('Ana')!.fish = { ...at };
    sim.handle('Ana', { t: 'mount', act: 7 });
    return sim;
  };
  const deepSpot = (sim: WorldSim) => {
    for (let x = -200; x <= 200; x += 5) {
      const z = HALF + 130;
      if (fishStepOk(sim.terrain, sim.island, x, z) && depthAt(sim.terrain, x, z) > 8 && fishStepOk(sim.terrain, sim.island, x + 14, z)) return { x, z };
    }
    throw new Error('no deep sea');
  };
  const go = (sim: WorldSim, x: number, y: number, z: number) => {
    const p = sim.getPlayer('Ana')!;
    for (let i = 0; i < 11; i++) sim.step(0.1); // past 1 s: the move window re-anchors here
    const before = { x: p.x, y: p.y, z: p.z };
    sim.handle('Ana', { t: 'move', x, y, z, yaw: 0, anim: 'swim' });
    return p.x !== before.x || p.y !== before.y || p.z !== before.z;
  };

  it('gets on only beside your own fish', () => {
    const sim = setup('Ana');
    const h = sim.fishHome;
    sim.getPlayer('Ana')!.fish = { x: h.x, z: h.z };
    put(sim, 'Ana', h.x + FISH.reach + 3, h.z);
    sim.handle('Ana', { t: 'mount', act: 7 });
    expect(snap(sim, 'Ana').self.onFish).toBe(false);
    put(sim, 'Ana', h.x + 1, h.z);
    sim.handle('Ana', { t: 'mount', act: 7 });
    expect(snap(sim, 'Ana').self.onFish).toBe(true);
    sim.handle('Ana', { t: 'mount', act: 2 }); // no deer while on the fish
    expect(snap(sim, 'Ana').self.riding).toBe(false);
  });

  it('fast in water (cap 15), the deep-sea current does not apply', () => {
    const probe = setup('X');
    const d = deepSpot(probe);
    let sim = rider(d.x, d.z);
    expect(go(sim, d.x + 14, SURF, d.z)).toBe(true);
    sim = rider(d.x, d.z);
    expect(go(sim, d.x + 20, SURF, d.z)).toBe(false);
    expect(snap(sim, 'Ana').self.fix).toBe(true);
  });

  it('dives down to the seabed, not through it', () => {
    const probe = setup('X');
    const d = deepSpot(probe);
    const floor = fishFloor(probe.terrain, d.x + 1, d.z);
    let sim = rider(d.x, d.z);
    expect(go(sim, d.x + 1, floor + 0.1, d.z)).toBe(true);
    sim = rider(d.x, d.z);
    expect(go(sim, d.x + 1, floor - 1, d.z)).toBe(false);
  });

  it('no beach and no aguas bravas on the fish', () => {
    const probe = setup('X');
    const h = probe.fishHome;
    let z = h.z;
    while (fishStepOk(probe.terrain, probe.island, h.x, z - 0.5)) z -= 0.5;
    let sim = rider(h.x, z);
    expect(go(sim, h.x, SURF, z - 2)).toBe(false);
    const isl = probe.island;
    const out = isl.r + FISH.bravas + 4;
    sim = rider(isl.x, isl.z - out);
    expect(go(sim, isl.x, SURF, isl.z - out + 6)).toBe(false);
  });

  it('A gets off only near the shore; the fish waits there', () => {
    const probe = setup('X');
    const d = deepSpot(probe);
    let sim = rider(d.x, d.z);
    sim.handle('Ana', { t: 'mount', act: 8 });
    expect(snap(sim, 'Ana').self.onFish).toBe(true);
    expect(texts(sim)).toContain('Aquí es hondo. Acércate a la orilla');
    const h = probe.fishHome;
    let z = h.z;
    while (depthAt(probe.terrain, h.x, z) >= FISH.shore) z -= 0.5;
    sim = rider(h.x, z);
    sim.handle('Ana', { t: 'mount', act: 8 });
    expect(snap(sim, 'Ana').self.onFish).toBe(false);
    expect(sim.getPlayer('Ana')!.fish).toEqual({ x: Math.round(h.x * 100) / 100, z: Math.round(z * 100) / 100 });
  });

  it('dying drops you off the fish', () => {
    const sim = rider();
    down(sim, 'Ana');
    expect(snap(sim, 'Ana').self.onFish).toBe(false);
    expect(sim.getPlayer('Ana')!.fish).toBeDefined();
  });
});

describe('sunken chests and the weapon upgrade', () => {
  const chestSim = () => {
    const sim = setup('Ana', 'Leo');
    const c = sim.chests[0]!;
    return { sim, c };
  };

  it('a diver opens their own chest once: materials and a pearl', () => {
    const { sim, c } = chestSim();
    put(sim, 'Ana', c.x, c.z);
    sim.getPlayer('Ana')!.y = c.y + 0.6;
    sim.handle('Ana', { t: 'chest', id: c.id });
    const inv = snap(sim, 'Ana').self.inv;
    expect(inv.pearl).toBe(1);
    for (const [k, n] of Object.entries(c.loot)) expect(inv[k as keyof typeof inv]).toBe(n);
    expect(snap(sim, 'Ana').self.chests).toEqual([c.id]);
    expect(msgs(sim)).toContainEqual({ t: 'toast', text: expect.stringContaining('perla') });
    sim.handle('Ana', { t: 'chest', id: c.id });
    expect(snap(sim, 'Ana').self.inv.pearl).toBe(1);
    expect(sim.save().players.find((p) => p.name === 'Ana')!.chests).toEqual([c.id]);
    put(sim, 'Leo', c.x, c.z);
    sim.getPlayer('Leo')!.y = c.y + 0.6;
    sim.handle('Leo', { t: 'chest', id: c.id });
    expect(snap(sim, 'Leo').self.inv.pearl).toBe(1);
  });

  it('a swimmer at the surface or far away cannot open it', () => {
    const { sim, c } = chestSim();
    put(sim, 'Ana', c.x, c.z);
    sim.getPlayer('Ana')!.y = WATER_LEVEL - 0.5;
    sim.handle('Ana', { t: 'chest', id: c.id });
    put(sim, 'Ana', c.x + 5, c.z);
    sim.handle('Ana', { t: 'chest', id: c.id });
    sim.handle('Ana', { t: 'chest', id: 99 });
    expect(snap(sim, 'Ana').self.chests).toEqual([]);
    expect(snap(sim, 'Ana').self.inv.pearl).toBeUndefined();
  });

  it('upgrades the weapon at the Heart with 3 pearls, up to +3, and hits harder', () => {
    const sim = setup('Ana');
    plantHeart(sim);
    const p = sim.getPlayer('Ana')!;
    p.inv = { pearl: 2, stone: 50, wood: 50 };
    sim.handle('Ana', { t: 'upgrade' });
    expect(snap(sim, 'Ana').self.weapon).toBe(0);
    expect(msgs(sim)).toContainEqual({ t: 'toast', text: 'Faltan materiales' });
    p.inv = { pearl: 20, stone: 50, wood: 50 };
    sim.handle('Ana', { t: 'upgrade' });
    expect(snap(sim, 'Ana').self.weapon).toBe(1);
    expect(p.inv).toEqual({ pearl: 17, stone: 40, wood: 45 });
    sim.handle('Ana', { t: 'upgrade' });
    sim.handle('Ana', { t: 'upgrade' });
    sim.handle('Ana', { t: 'upgrade' });
    expect(snap(sim, 'Ana').self.weapon).toBe(3);
    expect(p.inv.pearl).toBe(11);
    expect(msgs(sim)).toContainEqual({ t: 'toast', text: 'El arma ya no da más de sí' });
    expect(sim.save().players[0]!.weaponLvl).toBe(3);
    const w = wolfAt(sim, 0, 10);
    sim.handle('Ana', { t: 'shoot', id: w.id });
    expect(w.hp).toBeCloseTo(ENEMY.wolf.hp - BOW.damage * 1.45, 5);
  });

  it('far from the Heart nothing happens', () => {
    const sim = setup('Ana');
    plantHeart(sim);
    const p = sim.getPlayer('Ana')!;
    p.inv = { pearl: 3, stone: 10, wood: 5 };
    put(sim, 'Ana', p.x + 30, p.z);
    sim.handle('Ana', { t: 'upgrade' });
    expect(snap(sim, 'Ana').self.weapon).toBe(0);
  });

  it('old saves without chests or weapon level load', () => {
    const sim = setup('Ana');
    const saved = sim.save();
    delete saved.players[0]!.chests;
    delete saved.players[0]!.weaponLvl;
    const again = new WorldSim(saved);
    again.connect('Ana');
    expect(snap(again, 'Ana').self.chests).toEqual([]);
    expect(snap(again, 'Ana').self.weapon).toBe(0);
  });
});

describe('coast corruption (S2-D)', () => {
  const kind = (sim: WorldSim, k: string) => sim.shrines.find((s) => s.kind === k)!;
  const takeTide = (sim: WorldSim) => {
    const s = kind(sim, 'tide');
    put(sim, 'Leo', s.parts[0]!.x, s.parts[0]!.z);
    sim.step(0.1);
    put(sim, 'Ana', s.orb.x, s.orb.z);
    sim.handle('Ana', { t: 'shrine', id: s.id, part: 0 });
    return s;
  };
  const coastIds = [6, 7, 8, 9];

  it('a new world has the coast zones corrupt; old saves load with them corrupt', () => {
    const sim = setup('Ana');
    expect(snap(sim, 'Ana').corrupt).toEqual(expect.arrayContaining(coastIds));
    const old = sim.save();
    old.cleansed = [0, 1];
    expect(new WorldSim(old).corrupt()).toEqual(expect.arrayContaining(coastIds));
  });

  it('a coast orb cleanses the nearest corrupt coast zone (never 6, never the forest)', () => {
    const sim = setup('Ana', 'Leo');
    msgs(sim);
    const s = takeTide(sim);
    const gone = sim.save().cleansed ?? [];
    expect(gone.length).toBe(1);
    const near = sim.zones.filter((z) => z.id === 7 || z.id === 8 || z.id === 9).sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[0]!;
    expect(gone).toEqual([near.id]);
    expect(msgs(sim)).toContainEqual({ t: 'toast', text: expect.stringContaining('un trozo de costa') });
  });

  it('with only 6 left on the coast, a coast orb cleanses nothing', () => {
    const w = newWorld(42, 'salt');
    w.cleansed = [7, 8, 9];
    const sim = new WorldSim(w);
    for (const n of ['Ana', 'Leo']) {
      sim.createPlayer(n, 'h');
      sim.connect(n);
    }
    const before = sim.corrupt();
    takeTide(sim);
    expect(sim.corrupt()).toEqual(before);
  });

  it('a forest orb never cleanses a coast zone', () => {
    const probe = setup('Ana');
    const w = newWorld(42, 'salt');
    w.cleansed = probe.zones.filter((z) => z.id > 0 && z.id < 6).map((z) => z.id);
    const sim = new WorldSim(w);
    sim.createPlayer('Ana', 'h');
    sim.connect('Ana');
    const i = sim.shrines.findIndex((s) => s.kind === 'ledge');
    const s = sim.shrines[i]!;
    const p = sim.getPlayer('Ana')!;
    Object.assign(p, { x: s.orb.x, y: s.orb.y, z: s.orb.z });
    const before = sim.corrupt();
    sim.handle('Ana', { t: 'shrine', id: i, part: 0 });
    expect(p.shrines).toContain(i);
    expect(sim.corrupt()).toEqual(before);
  });

  it('Enredadera at a coast root cleanses nothing (Viento will, S2-F)', () => {
    const sim = setup('Ana');
    sim.getPlayer('Ana')!.enredadera = true;
    const z = sim.zones.find((x) => x.id === 7)!;
    put(sim, 'Ana', z.x - 3, z.z);
    sim.handle('Ana', { t: 'power', x: z.x, z: z.z });
    expect(sim.corrupt()).toContain(7);
  });

  it('raids get +1 brute per 2 corrupt coast zones while the coast root is corrupt', () => {
    const run = (cleansed: number[]) => {
      const w = newWorld(42, 'salt');
      w.cleansed = cleansed;
      const sim = new WorldSim(w);
      sim.createPlayer('Ana', 'h');
      sim.connect('Ana');
      plantHeart(sim);
      stepTo(sim, RAID.warnAt + 0.01);
      const warn = msgs(sim).some((m) => m.t === 'toast' && m.text.includes('Algo sube de la costa'));
      stepTo(sim, 0.81);
      const raiders = sim.wolfList.filter((x) => x.raid);
      return { warn, n: raiders.length, brutes: raiders.filter((x) => x.kind === 'brute').length };
    };
    const dirty = run([]);
    const clean = run([6]);
    expect(dirty.warn).toBe(true);
    expect(clean.warn).toBe(false);
    expect(dirty.n).toBe(clean.n + 2);
    expect(dirty.brutes).toBe(clean.brutes + 2);
  });

  it('a night in a corrupt coast zone brings extra beasts', () => {
    const count = (clean: boolean) => {
      const w = newWorld(42, 'salt');
      if (clean) w.cleansed = [7];
      const sim = new WorldSim(w);
      sim.createPlayer('Ana', 'h');
      sim.connect('Ana');
      const z = sim.zones.find((x) => x.id === 7)!;
      put(sim, 'Ana', z.x, z.z);
      stepTo(sim, 0.81);
      return sim.wolfList.filter((x) => !x.raid).length;
    };
    expect(count(false)).toBeGreaterThan(count(true));
  });
});
