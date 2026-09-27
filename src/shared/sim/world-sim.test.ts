import { describe, expect, it } from 'vitest';
import { HARVEST } from '../resources';
import { STRUCTURE_HP } from '../items';
import { BLOCK, BOW } from './combat';
import { ENEMY } from './wolves';
import type { ServerMsg } from '../protocol';
import { AWAY_TIMEOUT, DAY_LENGTH, GRAVE, newWorld, WorldSim } from './world-sim';

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
