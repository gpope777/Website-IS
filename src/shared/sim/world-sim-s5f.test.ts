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

/** Straight to phase 2 (he sinks). */
function phase2(sim: WorldSim) {
  const b = boss(sim)!;
  calm(b);
  b.bare = 5;
  sim.handle('Ana', { t: 'attack', id: FINAL.id });
  b.hp = b.max * 0.6 + 1;
  put(sim, 'Ana', C.x, C.z - 2.5);
  (sim as unknown as { live: Map<string, { punchReadyAt: number }> }).live.get('Ana')!.punchReadyAt = 0;
  sim.handle('Ana', { t: 'attack', id: FINAL.id });
  sim.step(0.1);
  return b;
}
const cooldowns = (sim: WorldSim, n = 'Ana') => Object.assign((sim as unknown as { live: Map<string, object> }).live.get(n)!, { powerReadyAt: 0, windReadyAt: 0, fireReadyAt: 0, stoneReadyAt: 0 });
const priv = (sim: WorldSim) => sim as unknown as { wolves: { kind: string; hp: number; x: number; z: number }[]; structures: { kind: string; x: number; z: number }[] };

describe('phase 2 — los cuatro brotes (S5-F)', () => {
  it('at 60 % he sinks and four brotes rise; he takes no damage', () => {
    const sim = inCopa('Ana');
    const b = phase2(sim);
    expect(b.phase).toBe(2);
    expect(fv(sim)!.brotes.map((x) => x.power)).toEqual(['vine', 'wind', 'fire', 'stone']);
    expect(snap(sim).wolves.filter((w) => w.kind === 'brote')).toHaveLength(4);
    const hp = b.hp;
    sim.handle('Ana', { t: 'attack', id: FINAL.id });
    sim.step(0.1);
    expect(b.hp).toBe(hp);
  });

  it('three Llamaradas open the Fuego brote; A pulls it in 1.5 s: −8.75 %', () => {
    const sim = inCopa('Ana');
    const b = phase2(sim);
    const br = b.brotes[2]!;
    put(sim, 'Ana', br.x - 2, br.z - 2);
    act28(sim);
    expect(toasts(sim).some((t) => t.startsWith('Está en un capullo'))).toBe(true);
    for (let i = 0; i < 3; i++) {
      cooldowns(sim);
      sim.handle('Ana', { t: 'power', kind: 'fuego', x: br.x, z: br.z });
    }
    expect(fv(sim)!.brotes[2]!.open).toBe(true);
    const hp = b.hp;
    act28(sim);
    run(sim, 1.7);
    expect(b.brotes[2]!.broken).toBe(true);
    expect(b.hp).toBeCloseTo(hp - 1200 * 0.0875);
  });

  it('two vines, three gusts and a pillar on the plate open the others', () => {
    const sim = inCopa('Ana');
    const b = phase2(sim);
    const [vine, wind] = b.brotes;
    put(sim, 'Ana', vine!.x + 3, vine!.z + 3);
    for (let i = 0; i < 2; i++) {
      cooldowns(sim);
      sim.handle('Ana', { t: 'power', kind: 'enredadera', x: vine!.x + 1, z: vine!.z + 1 });
    }
    expect(fv(sim)!.brotes[0]!.open).toBe(true);
    put(sim, 'Ana', wind!.x + 3, wind!.z - 3);
    for (let i = 0; i < 3; i++) {
      cooldowns(sim);
      sim.handle('Ana', { t: 'power', kind: 'viento', x: wind!.x, z: wind!.z });
    }
    expect(fv(sim)!.brotes[1]!.open).toBe(true);
    expect(fv(sim)!.brotes[3]!.open).toBe(false);
    priv(sim).structures.push({ id: 7777, kind: 'pillar', x: FINAL.x + FINAL.plates.x, z: FINAL.z + FINAL.plates.z, y: T.floor, hp: 80 } as never);
    expect(fv(sim)!.brotes[3]!.open).toBe(true);
  });

  it('a hit during a pull ruins it; a rayo harasses (one alone) and comes back 10 s after it falls', () => {
    const sim = inCopa('Ana');
    const b = phase2(sim);
    const br = b.brotes[3]!;
    priv(sim).structures.push({ id: 7777, kind: 'pillar', x: FINAL.x + FINAL.plates.x, z: FINAL.z + FINAL.plates.z, y: T.floor, hp: 80 } as never);
    put(sim, 'Ana', br.x - 1, br.z);
    act28(sim);
    const p = sim.getPlayer('Ana')!;
    p.vitals = { ...p.vitals, health: p.vitals.health - 10 };
    sim.step(0.1);
    expect(b.pull).toBeNull();
    const rayos = () => priv(sim).wolves.filter((w) => w.kind === 'rayo' && w.hp > 0);
    expect(rayos()).toHaveLength(1);
    rayos()[0]!.hp = 0;
    run(sim, 5);
    expect(rayos()).toHaveLength(0);
    run(sim, 6);
    expect(rayos()).toHaveLength(1);
    const r = rayos()[0]!;
    expect(Math.hypot(r.x - C.x, r.z - C.z)).toBeLessThanOrEqual(T.copa.r);
  });
});

function act28(sim: WorldSim) {
  sim.handle('Ana', { t: 'dungeon', act: 28 });
}

/** Straight to phase 3 (all four brotes out). */
function phase3(sim: WorldSim) {
  const b = phase2(sim);
  for (const br of b.brotes) {
    br.steps = 3;
    br.openFor = 999;
  }
  priv(sim).structures.push({ id: 7777, kind: 'pillar', x: FINAL.x + FINAL.plates.x, z: FINAL.z + FINAL.plates.z, y: T.floor, hp: 80 } as never);
  (sim as unknown as { finalLive: { rayoAt: number } }).finalLive.rayoAt = Infinity;
  priv(sim).wolves = priv(sim).wolves.filter((w) => w.kind !== 'rayo');
  for (const br of b.brotes) {
    put(sim, 'Ana', br.x - 1, br.z);
    act28(sim);
    run(sim, 1.7);
  }
  priv(sim).structures = priv(sim).structures.filter((s) => (s as { id?: number }).id !== 7777);
  return b;
}

describe('phase 3 — el Corazón Negro and the victory (S5-F)', () => {
  it('the 4th brote frees the core: it runs, a pillar stops it, an arrow on it does ×1.5; its trail burns', () => {
    const sim = inCopa('Ana');
    const b = phase3(sim);
    expect(b.phase).toBe(3);
    expect(priv(sim).wolves.filter((w) => w.kind === 'rayo')).toHaveLength(0);
    const c = b.core!;
    expect(snap(sim).wolves.some((w) => w.kind === 'core' && w.id === FINAL.coreId)).toBe(true);
    put(sim, 'Ana', c.x, c.z - 8);
    run(sim, 1);
    priv(sim).structures.push({ id: 7778, kind: 'pillar', x: c.x, z: c.z, y: T.floor, hp: 80 } as never);
    sim.step(0.1);
    expect(fv(sim)!.core!.stopped).toBe(true);
    const hp = c.hp;
    const p = sim.getPlayer('Ana')!;
    put(sim, 'Ana', c.x, c.z - 6);
    p.yaw = 0;
    sim.handle('Ana', { t: 'shoot', id: FINAL.coreId });
    expect(c.hp).toBeCloseTo(hp - 15 * 1.5);
    const t = b.trail[b.trail.length - 1]!;
    put(sim, 'Ana', t.x, t.z);
    const h0 = p.vitals.health;
    run(sim, 0.5);
    expect(p.vitals.health).toBeLessThan(h0 - 1);
  });

  it('a Llamarada on the core counts as a blow: it scratches it and stops a heal', () => {
    const sim = inCopa('Ana');
    const b = phase3(sim);
    const c = b.core!;
    cooldowns(sim);
    c.stun = 3;
    put(sim, 'Ana', c.x, c.z - 3);
    const hp = c.hp;
    sim.handle('Ana', { t: 'power', kind: 'fuego', x: c.x, z: c.z });
    expect(c.hp).toBeCloseTo(hp - 6);
    c.stun = 0;
    c.mode = 'heal';
    cooldowns(sim);
    put(sim, 'Ana', c.x, c.z - 3);
    sim.handle('Ana', { t: 'power', kind: 'fuego', x: c.x, z: c.z });
    expect(c.mode).toBe('run');
  });

  it('the core at 0: ending saved, a vision with the names, and the Copa is calm after', () => {
    const sim = inCopa('Ana');
    const b = phase3(sim);
    const c = b.core!;
    c.hp = 1;
    c.stun = 3;
    put(sim, 'Ana', c.x, c.z - 2);
    (sim as unknown as { live: Map<string, { punchReadyAt: number }> }).live.get('Ana')!.punchReadyAt = 0;
    msgs(sim);
    sim.handle('Ana', { t: 'attack', id: FINAL.coreId });
    const out = msgs(sim);
    expect(sim.ending).toBe(true);
    expect(out.some((m) => m.t === 'vision' && m.lines.some((l) => l.includes('Ana')))).toBe(true);
    expect(sim.save().ending).toBe(true);
    run(sim, 8);
    expect(boss(sim)).toBeNull();
    expect(fv(sim)).toBeNull();
    const again = new WorldSim(sim.save());
    expect(again.ending).toBe(true);
  });

  it('an old save loads without ending', () => {
    const w = newWorld(42, 'salt');
    delete (w as { ending?: boolean }).ending;
    expect(new WorldSim(w).ending).toBe(false);
  });

  it('a standing player in phase 2 lasts over 30 s against the rayo', () => {
    const sim = inCopa('Ana');
    phase2(sim);
    const p = sim.getPlayer('Ana')!;
    put(sim, 'Ana', C.x + 6, C.z);
    run(sim, 30);
    expect(p.dead).toBe(false);
  });
});
