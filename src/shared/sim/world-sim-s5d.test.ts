import { describe, expect, it } from 'vitest';
import { STRUCTURE_HP } from '../items';
import { decodeClient, PROTOCOL_VERSION, type ServerMsg } from '../protocol';
import { heartWill, MARCHITO, VISION } from './marchito';
import { RAID, type Wolf } from './wolves';
import { DAY_LENGTH, INVASION3, newWorld, WorldSim, type SavedWorld } from './world-sim';

type Struct = { id: number; kind: string; x: number; y: number; z: number; rot: number; owner: string; hp: number };
type Priv = {
  marchito: { x: number; z: number; hp: number; max: number; channel: number | null } | null;
  structures: Struct[];
  wolves: Wolf[];
  raid: { phase: string; dir: number; big?: boolean } | null;
  breakPillar(id: number): void;
  cleansed: Set<number>;
};
const priv = (sim: WorldSim) => sim as unknown as Priv;
const msgs = (sim: WorldSim) => sim.drain().map((o) => o.msg);
const texts = (m: ServerMsg[]) => m.flatMap((x) => (x.t === 'toast' ? [x.text] : []));
const visions = (m: ServerMsg[]) => m.flatMap((x) => (x.t === 'vision' ? [x.lines.join(' ')] : []));
const snap = (sim: WorldSim) => sim.snapshotFor('Ana') as Extract<ServerMsg, { t: 'snap' }>;
const HX = 0;
const HZ = 0;

function put(sim: WorldSim, name: string, x: number, z: number) {
  Object.assign(sim.getPlayer(name)!, { x, z, y: sim.terrain.heightAt(x, z) });
}
function stepTo(sim: WorldSim, f: number, out: ServerMsg[] = []) {
  const target = f * DAY_LENGTH;
  let guard = 0;
  while (Math.abs((sim.time % DAY_LENGTH) - target) > 0.06 && guard++ < DAY_LENGTH * 10 + 10) {
    sim.step(0.1);
    out.push(...msgs(sim));
  }
  return out;
}

/** A Heart at the origin, 2 walls, and Ana + Leo standing 60 m away. */
function world(opts: { pillars?: number[]; invasion3?: 'pending' | 'done' } = {}) {
  const w: SavedWorld = newWorld(42, 'salt');
  const sim0 = new WorldSim(w);
  const y = sim0.terrain.heightAt(HX, HZ);
  w.structures.push({ id: 900, kind: 'heart', x: HX, y, z: HZ, rot: 0, owner: 'Ana', hp: STRUCTURE_HP.heart } as SavedWorld['structures'][number]);
  w.structures.push({ id: 901, kind: 'wall', x: HX + 40, y, z: HZ + 40, rot: 0, owner: 'Ana', hp: STRUCTURE_HP.wall } as SavedWorld['structures'][number]);
  w.nextStructureId = 1000;
  if (opts.pillars) w.pillars = opts.pillars;
  if (opts.invasion3) w.invasion3 = opts.invasion3;
  const sim = new WorldSim(w);
  for (const n of ['Ana', 'Leo']) {
    sim.createPlayer(n, 'hash');
    sim.connect(n);
  }
  put(sim, 'Ana', HX + 60, HZ + 60);
  put(sim, 'Leo', HX + 62, HZ + 60);
  priv(sim).cleansed.add(6); // no coast brutes
  msgs(sim);
  return sim;
}
const heart = (sim: WorldSim) => priv(sim).structures.find((s) => s.kind === 'heart')!;
function dusk(sim: WorldSim) {
  const out = stepTo(sim, RAID.warnAt + 0.005);
  for (let i = 0; i < 5 && !priv(sim).marchito; i++) {
    sim.step(0.1);
    out.push(...msgs(sim));
  }
  return out;
}
/** Keep both players fed and alive through a long wait. */
function heal(sim: WorldSim) {
  for (const n of ['Ana', 'Leo']) {
    const p = sim.getPlayer(n)!;
    p.dead = false;
    p.vitals = { ...p.vitals, health: 100, hunger: 100, thirst: 100 } as typeof p.vitals;
  }
}

describe('protocol (S5-D)', () => {
  it('version 49+', () => {
    expect(PROTOCOL_VERSION).toBeGreaterThanOrEqual(49);
    expect(decodeClient('{"t":"attack","id":5}')).toEqual({ t: 'attack', id: 5 });
  });
});

describe('Invasión 3 is armed by the 4th Pilar-raíz (S5 §8.1)', () => {
  it('the 4th pillar arms it with a vision; the 3rd does not', () => {
    const sim = world({ pillars: [0, 1] });
    priv(sim).breakPillar(2);
    expect(sim.invasion3).toBe('none');
    msgs(sim);
    priv(sim).breakPillar(3);
    expect(sim.invasion3).toBe('pending');
    expect(visions(msgs(sim)).some((v) => v.includes('Ah. Ahora voy yo.'))).toBe(true);
    expect(sim.save().invasion3).toBe('pending');
  });
  it('an old save with the 4 pillars owes it; a fresh world saves nothing', () => {
    expect(world({ pillars: [0, 1, 2, 3] }).invasion3).toBe('pending');
    const fresh = world();
    expect(fresh.invasion3).toBe('none');
    expect(fresh.save().invasion3).toBeUndefined();
    expect(fresh.save().towerOpen).toBeUndefined();
  });
});

describe('Invasión 3 at the Heart (S5 §8.2)', () => {
  it('nothing before dusk; at the warning he comes from the north with 1.3× voluntad and the raid turns north', () => {
    const sim = world({ invasion3: 'pending' });
    stepTo(sim, RAID.warnAt - 0.05);
    expect(priv(sim).marchito).toBeNull();
    const out = dusk(sim);
    const m = priv(sim).marchito!;
    expect(m).not.toBeNull();
    expect(m.z).toBeLessThan(HZ - 20);
    expect(m.max).toBe(heartWill(2));
    expect(visions(out).some((v) => v.includes('viene a por el'))).toBe(true);
    expect(priv(sim).raid?.big).toBe(true);
    expect(Math.cos(priv(sim).raid!.dir)).toBeLessThan(-0.9);
    expect(sim.save().invasion3).toBe('pending');
  });

  it('left alone he channels 90 s, the Heart drops to 1 PV, he leaves; the dawn opens the tower', () => {
    const sim = world({ invasion3: 'pending' });
    dusk(sim);
    heart(sim).hp = 1e6; // the raid's beasts must not matter here
    const out: ServerMsg[] = [];
    let seen = 0;
    for (let i = 0; i < 1500 && priv(sim).marchito; i++) {
      heal(sim);
      sim.step(0.1);
      out.push(...msgs(sim));
      seen = Math.max(seen, snap(sim).marchito?.channel ?? 0);
    }
    expect(seen).toBe(1);
    expect(priv(sim).marchito).toBeNull();
    expect(out.some((x) => x.t === 'hit' && x.id === 900 && x.hp === 1)).toBe(true);
    expect(visions(out).some((v) => v.includes('Mañana, en mi casa'))).toBe(true);
    expect(sim.invasion3).toBe('pending');
    const dawn = stepTo(sim, 0.3);
    expect(sim.invasion3).toBe('done');
    expect(sim.towerOpen).toBe(true);
    expect(snap(sim).towerOpen).toBe(true);
    expect(sim.save()).toMatchObject({ invasion3: 'done', towerOpen: true });
    expect(texts(dawn).some((t) => t.includes('La puerta de la Torre se abre'))).toBe(true);
    // never again
    dusk(sim);
    expect(priv(sim).marchito).toBeNull();
  });

  it('driven off: the Heart is untouched, and the tower still opens at dawn', () => {
    const sim = world({ invasion3: 'pending' });
    dusk(sim);
    const m = priv(sim).marchito!;
    put(sim, 'Ana', m.x + 1, m.z);
    heal(sim);
    m.hp = 1;
    const hp = heart(sim).hp;
    sim.handle('Ana', { t: 'attack', id: MARCHITO.id });
    const out = msgs(sim);
    expect(priv(sim).marchito).toBeNull();
    expect(visions(out)[0]).toContain('Traigan a sus bichos blancos');
    expect(heart(sim).hp).toBe(hp);
    stepTo(sim, 0.3);
    expect(sim.towerOpen).toBe(true);
  });

  it('the night raid is half again as big, with 6 rayos', () => {
    const count = (inv: boolean) => {
      const sim = world(inv ? { invasion3: 'pending' } : {});
      dusk(sim);
      stepTo(sim, 0.81);
      const raid = priv(sim).wolves.filter((w) => w.raid);
      return { beasts: raid.filter((w) => w.kind !== 'rayo').length, rayos: raid.filter((w) => w.kind === 'rayo').length };
    };
    const plain = count(false);
    const big = count(true);
    expect(plain.rayos).toBe(0);
    expect(big.rayos).toBe(INVASION3.rayos);
    expect(big.beasts).toBeGreaterThanOrEqual(Math.ceil(plain.beasts * INVASION3.raidMult));
  });

  it('a raid rayo dives on a wall (10 a dive), never on the Heart', () => {
    const sim = world({ invasion3: 'pending' });
    dusk(sim);
    stepTo(sim, 0.81);
    const r = priv(sim).wolves.find((w) => w.raid && w.kind === 'rayo')!;
    priv(sim).wolves = [r];
    const wall = priv(sim).structures.find((s) => s.id === 901)!;
    Object.assign(r, { x: wall.x + 3, z: wall.z, y: sim.terrain.heightAt(wall.x + 3, wall.z) + 6, cooldown: 0, target: null, dive: undefined });
    put(sim, 'Ana', HX - 150, HZ + 150);
    put(sim, 'Leo', HX - 152, HZ + 150);
    const hhp = heart(sim).hp;
    for (let i = 0; i < 100; i++) sim.step(0.1);
    expect(wall.hp).toBeLessThan(STRUCTURE_HP.wall);
    expect((STRUCTURE_HP.wall - wall.hp) % INVASION3.rayoStruct).toBe(0);
    expect(heart(sim).hp).toBe(hhp);
  });

  it('a save mid-invasion still owes it', () => {
    const sim = world({ invasion3: 'pending' });
    dusk(sim);
    expect(priv(sim).marchito).not.toBeNull();
    expect(sim.save().invasion3).toBe('pending');
    expect(sim.save().towerOpen).toBeUndefined();
  });
});
