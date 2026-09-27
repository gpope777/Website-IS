import { describe, expect, it } from 'vitest';
import { HARVEST } from '../resources';
import { STRUCTURE_HP } from '../items';
import { BLOCK, BOW } from './combat';
import { ENEMY } from './wolves';
import type { ServerMsg } from '../protocol';
import { ENREDADERA } from '../enredadera';
import { DUNGEON, inDungeon, leverPos } from '../dungeon';
import { BOSS } from './boss';
import { ALLY } from './ally';
import { PUNCH, AWAY_TIMEOUT, DAY_LENGTH, GRAVE, newWorld, REVIVE, WorldSim } from './world-sim';

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
    for (let i = 0; i < 5; i++) {
      Object.assign(w, { x: sp.x, z: sp.z }); // raiders run faster than the spikes' radius; hold it there
      sim.step(0.1);
    }
    expect(sim.save().structures.some((s) => s.id === 600)).toBe(false);
    expect(SPIKES.dps).toBeGreaterThan(0);
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
    expect(snap(again, 'Ana').shrines).toHaveLength(3);
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
        for (let k = 0; k < 5; k++) sim.step(0.1);
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
