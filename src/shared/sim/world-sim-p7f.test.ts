import { describe, expect, it } from 'vitest';
import { decodeClient, PROTOCOL_VERSION } from '../protocol';
import type { Terrain } from '../terrain';
import { TUT } from '../tutorial';
import type { Wolf } from './wolves';
import { DAY_LENGTH, newWorld, WorldSim, type SavedPlayer } from './world-sim';

type Priv = { time: number; terrain: Terrain; tutWolves: Map<string, Wolf>; wolves: Wolf[]; raid: unknown; resources: { kind: string; x: number; z: number }[] };
const priv = (sim: WorldSim) => sim as unknown as Priv;

function setup(...names: string[]) {
  const sim = new WorldSim(newWorld(42, 'salt'));
  for (const n of names) {
    sim.createPlayer(n, 'hash');
    sim.connect(n, 1_000);
  }
  sim.drain();
  return sim;
}
const snap = (sim: WorldSim, who: string) => {
  const m = sim.snapshotFor(who);
  if (!m || m.t !== 'snap') throw new Error('snap');
  return m;
};
const step = (sim: WorldSim, who: string) => sim.getPlayer(who)!.tut;
const toasts = (sim: WorldSim, who: string) => sim.drain().flatMap((o) => (o.to === who && o.msg.t === 'toast' ? [o.msg.text] : []));

/** Walk `m` metres in small legal moves, turning `turn` radians along the way. */
function walk(sim: WorldSim, who: string, m: number, turn = 0) {
  const p = sim.getPlayer(who)!;
  const n = Math.ceil(m / 0.4);
  for (let i = 0; i < n; i++) {
    const yaw = p.yaw + turn / n;
    const x = p.x + Math.sin(yaw) * 0.4;
    const z = p.z + Math.cos(yaw) * 0.4;
    sim.handle(who, { t: 'move', x, y: priv(sim).terrain.heightAt(x, z), z, yaw, anim: 'walk' });
    sim.step(0.1);
  }
}
/** Put the learner at step `s` (the server path for earlier steps is tested on its own). */
function at(sim: WorldSim, who: string, s: number) {
  sim.getPlayer(who)!.tut = s;
  sim.handle(who, { t: 'tut', act: 'repeat' });
  sim.getPlayer(who)!.tut = s;
  sim.connect(who, 2_000); // resyncs the step's counters
  sim.drain();
}
const give = (p: SavedPlayer, inv: SavedPlayer['inv']) => {
  p.inv = { ...p.inv, ...inv };
};

describe('Tutorial (P7-F, server)', () => {
  it('protocol 65 and the tut message', () => {
    expect(PROTOCOL_VERSION).toBe(65);
    expect(decodeClient('{"t":"tut","act":"skip"}')).toEqual({ t: 'tut', act: 'skip' });
    expect(decodeClient('{"t":"tut","act":"repeat"}')).toEqual({ t: 'tut', act: 'repeat' });
    expect(decodeClient('{"t":"tut","act":"done"}')).toBeNull();
  });

  it('a new player starts at step 1', () => {
    const sim = setup('Ana');
    expect(step(sim, 'Ana')).toBe(1);
    expect(snap(sim, 'Ana').self.tut).toEqual({ step: 1 });
  });

  it('a returning player with progress never sees it; an empty old save does', () => {
    const w = newWorld(42, 'salt');
    const base = { pinHash: 'h', x: 0, y: 0, z: 0, yaw: 0, vitals: { health: 100, hunger: 100, warmth: 100, stamina: 100 }, dead: false } as unknown as SavedPlayer;
    w.players = [
      { ...base, name: 'Vet', inv: {}, shrines: [3] },
      { ...base, name: 'Wood', inv: { wood: 2 } },
      { ...base, name: 'Xp', inv: {}, xp: 10 },
      { ...base, name: 'New', inv: {} },
    ];
    w.structures = [];
    const sim = new WorldSim(w);
    expect(sim.getPlayer('Vet')!.tut).toBe('skip');
    expect(sim.getPlayer('Wood')!.tut).toBe('skip');
    expect(sim.getPlayer('Xp')!.tut).toBe('skip');
    sim.connect('Vet', 1);
    sim.connect('New', 1);
    expect(snap(sim, 'Vet').self.tut).toBeUndefined();
    expect(sim.getPlayer('New')!.tut).toBe(1);
    expect(sim.save().players.find((p) => p.name === 'Vet')!.tut).toBe('skip');
  });

  it('steps 1–5 advance by doing', () => {
    const sim = setup('Ana');
    const p = sim.getPlayer('Ana')!;
    walk(sim, 'Ana', 12);
    expect(step(sim, 'Ana')).toBe(1); // walked, never turned
    walk(sim, 'Ana', 4, Math.PI / 2 + 0.2);
    expect(step(sim, 'Ana')).toBe(2);
    give(p, { berries: 1 });
    sim.handle('Ana', { t: 'eat' });
    expect(step(sim, 'Ana')).toBe(3);
    give(p, { wood: 5, stone: 3 });
    sim.step(0.1);
    expect(step(sim, 'Ana')).toBe(4);
    sim.handle('Ana', { t: 'place', kind: 'campfire', x: p.x + 2, z: p.z, rot: 0 });
    expect(step(sim, 'Ana')).toBe(5);
    give(p, { wood: 20, stone: 10 });
    sim.handle('Ana', { t: 'place', kind: 'heart', x: p.x - 3, z: p.z, rot: 0 });
    expect(sim.heart()?.owner).toBe('Ana');
    expect(step(sim, 'Ana')).toBe(6);
  });

  it('a harvested berry counts through the real harvest', () => {
    const sim = setup('Ana');
    at(sim, 'Ana', 2);
    const p = sim.getPlayer('Ana')!;
    const bushes = priv(sim).resources.map((r, id) => ({ ...r, id })).filter((r) => r.kind === 'bush');
    const b = bushes[0]!;
    p.x = b.x + 0.5;
    p.z = b.z;
    sim.handle('Ana', { t: 'harvest', id: b.id });
    expect(p.inv.berries).toBeGreaterThan(0);
    sim.handle('Ana', { t: 'eat' });
    expect(step(sim, 'Ana')).toBe(3);
  });

  it('step 5 passes by walking to a Heart someone else planted', () => {
    const sim = setup('Bea', 'Ana');
    sim.getPlayer('Bea')!.tut = 'skip';
    const bea = sim.getPlayer('Bea')!;
    give(bea, { wood: 20, stone: 10 });
    sim.handle('Bea', { t: 'place', kind: 'heart', x: bea.x + 40, z: bea.z, rot: 0 });
    const h = sim.heart();
    if (!h) {
      // Not buildable that far: plant it close and move Ana away instead.
      sim.handle('Bea', { t: 'place', kind: 'heart', x: bea.x + 3, z: bea.z, rot: 0 });
    }
    const heart = sim.heart()!;
    expect(heart.owner).toBe('Bea');
    at(sim, 'Ana', 5);
    const ana = sim.getPlayer('Ana')!;
    ana.x = heart.x + 40;
    ana.z = heart.z;
    sim.step(0.1);
    expect(step(sim, 'Ana')).toBe(5);
    ana.x = heart.x + TUT.heartNear - 1;
    sim.step(0.1);
    expect(step(sim, 'Ana')).toBe(6);
  });

  it('the practice wolf: only the owner sees it, it only bites the owner, never kills, gives nothing', () => {
    const sim = setup('Ana', 'Bea');
    sim.getPlayer('Bea')!.tut = 'skip';
    sim.connect('Bea', 3_000);
    at(sim, 'Ana', 6);
    sim.step(0.1);
    const w = priv(sim).tutWolves.get('Ana')!;
    expect(w).toBeDefined();
    expect(priv(sim).wolves.includes(w)).toBe(false);
    const ana = sim.getPlayer('Ana')!;
    expect(Math.hypot(w.x - ana.x, w.z - ana.z)).toBeLessThan(20);
    expect(snap(sim, 'Ana').wolves.some((x) => x.id === w.id)).toBe(true);
    expect(snap(sim, 'Bea').wolves.some((x) => x.id === w.id)).toBe(false);
    // Bea stands beside it and hits it: nothing.
    const bea = sim.getPlayer('Bea')!;
    bea.x = w.x + 1;
    bea.z = w.z;
    sim.handle('Bea', { t: 'attack', id: w.id });
    expect(w.hp).toBe(TUT.wolfHp);
    // It bites Ana (only her), and never below the floor.
    ana.vitals = { ...ana.vitals, health: 12 };
    const bh = bea.vitals.health;
    for (let i = 0; i < 300; i++) sim.step(0.1);
    expect(ana.vitals.health).toBeGreaterThanOrEqual(TUT.floor - 0.01);
    expect(ana.dead).toBe(false);
    expect(bea.vitals.health).toBeGreaterThanOrEqual(bh - 1); // hunger/warmth drift only, no bites
    expect(step(sim, 'Ana')).toBe(7); // three bites taken → on to the bow
  });

  it('killing it gives no Savia, no Libro kill, no thorns, no broadcast', () => {
    const sim = setup('Ana', 'Bea');
    at(sim, 'Ana', 6);
    sim.step(0.1);
    const w = priv(sim).tutWolves.get('Ana')!;
    const ana = sim.getPlayer('Ana')!;
    w.hp = 1;
    ana.x = w.x + 1;
    ana.z = w.z;
    const xp = ana.xp ?? 0;
    sim.drain();
    sim.handle('Ana', { t: 'attack', id: w.id });
    expect(w.hp).toBeLessThanOrEqual(0);
    expect(ana.xp ?? 0).toBe(xp);
    expect(ana.kills?.wolf ?? 0).toBe(0);
    expect(ana.inv.thorn ?? 0).toBe(0);
    expect(sim.drain().some((o) => o.msg.t === 'toast' && o.msg.text.includes('derrotó'))).toBe(false);
    expect(step(sim, 'Ana')).toBe(7);
    // Step 7: the dead one goes and a still target appears.
    for (let i = 0; i < 20; i++) sim.step(0.1);
    const still = priv(sim).tutWolves.get('Ana')!;
    expect(still.still).toBe(true);
    expect(still.hp).toBe(TUT.wolfHp);
    const x0 = still.x;
    for (let i = 0; i < 20; i++) sim.step(0.1);
    expect(still.x).toBe(x0);
  });

  it('a parry ends step 6; an arrow ends step 7; 30 m ends it all', () => {
    const sim = setup('Ana');
    at(sim, 'Ana', 6);
    sim.step(0.1);
    const w = priv(sim).tutWolves.get('Ana')!;
    const ana = sim.getPlayer('Ana')!;
    ana.x = w.x;
    ana.z = w.z + 1.2;
    sim.handle('Ana', { t: 'block', on: true });
    for (let i = 0; i < 30 && step(sim, 'Ana') === 6; i++) {
      sim.step(0.1);
      if (i % 3 === 2) {
        sim.handle('Ana', { t: 'block', on: false });
        sim.step(0.7);
        sim.handle('Ana', { t: 'block', on: true });
      }
    }
    expect(step(sim, 'Ana')).toBe(7);
    // Face the wolf and shoot.
    const w2 = priv(sim).tutWolves.get('Ana')!;
    const yaw = Math.atan2(w2.x - ana.x, w2.z - ana.z);
    sim.handle('Ana', { t: 'move', x: ana.x, y: ana.y, z: ana.z, yaw, anim: 'idle' });
    ana.yaw = yaw;
    sim.step(1);
    sim.handle('Ana', { t: 'shoot', id: w2.id });
    expect(step(sim, 'Ana')).toBe(8);
    sim.drain();
    walk(sim, 'Ana', 32);
    expect(step(sim, 'Ana')).toBe('done');
    expect(toasts(sim, 'Ana')).toContain('Tutorial hecho.');
    expect(priv(sim).tutWolves.has('Ana')).toBe(false);
    expect(snap(sim, 'Ana').self.tut).toBeUndefined();
  });

  it('a raid holds any step; night holds the wolf', () => {
    const sim = setup('Ana');
    at(sim, 'Ana', 2);
    priv(sim).raid = { phase: 'active', dir: 0 };
    give(sim.getPlayer('Ana')!, { berries: 1 });
    sim.handle('Ana', { t: 'eat' });
    expect(step(sim, 'Ana')).toBe(2);
    expect(snap(sim, 'Ana').self.tut).toEqual({ step: 2, wait: true });
    priv(sim).raid = null;
    at(sim, 'Ana', 6);
    priv(sim).time = DAY_LENGTH * 10 + DAY_LENGTH * 0.9;
    sim.step(0.1);
    expect(priv(sim).tutWolves.has('Ana')).toBe(false);
    expect(snap(sim, 'Ana').self.tut).toEqual({ step: 6, wait: true });
  });

  it('skip and repeat', () => {
    const sim = setup('Ana');
    at(sim, 'Ana', 6);
    sim.step(0.1);
    expect(priv(sim).tutWolves.has('Ana')).toBe(true);
    sim.handle('Ana', { t: 'tut', act: 'skip' });
    expect(step(sim, 'Ana')).toBe('skip');
    expect(priv(sim).tutWolves.has('Ana')).toBe(false);
    sim.step(0.1);
    expect(priv(sim).tutWolves.has('Ana')).toBe(false);
    expect(snap(sim, 'Ana').self.tut).toBeUndefined();
    sim.handle('Ana', { t: 'tut', act: 'repeat' });
    expect(step(sim, 'Ana')).toBe(1);
    expect(snap(sim, 'Ana').self.tut).toEqual({ step: 1 });
  });

  it('two learners: two wolves, each their own; friends see the step', () => {
    const sim = setup('Ana', 'Leo', 'Bea');
    sim.getPlayer('Bea')!.tut = 'skip';
    at(sim, 'Ana', 6);
    at(sim, 'Leo', 6);
    sim.step(0.1);
    const a = priv(sim).tutWolves.get('Ana')!;
    const l = priv(sim).tutWolves.get('Leo')!;
    expect(a.id).not.toBe(l.id);
    expect(a.tut).toBe('Ana');
    expect(l.tut).toBe('Leo');
    const s = snap(sim, 'Bea');
    expect(s.players.find((x) => x.name === 'Ana')!.tut).toBe(6);
    expect(snap(sim, 'Ana').players.find((x) => x.name === 'Bea')!.tut).toBeUndefined();
    // Leaving drops your wolf.
    sim.markAway('Leo', 5_000);
    expect(priv(sim).tutWolves.has('Leo')).toBe(false);
  });

  it('a friend acting does not advance the learner', () => {
    const sim = setup('Ana', 'Bea');
    sim.getPlayer('Bea')!.tut = 'skip';
    at(sim, 'Ana', 2);
    give(sim.getPlayer('Bea')!, { berries: 2 });
    sim.handle('Bea', { t: 'eat' });
    expect(step(sim, 'Ana')).toBe(2);
  });
});
