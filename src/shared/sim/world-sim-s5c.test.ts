import { describe, expect, it } from 'vitest';
import { CORRUPT_LANDS, corruptFeatures, waterLevel } from '../terrain';
import { ASH_RUN, LAKE_PILLAR, PILLAR, pillarSites, THICKET } from '../pillars';
import { decodeClient, PROTOCOL_VERSION, type ServerMsg } from '../protocol';
import { DAY_LENGTH, newWorld, WorldSim, type SavedWorld } from './world-sim';

const S = pillarSites(42);
const LAKE = corruptFeatures(42).lake;
type Live = { fish: boolean; riding: boolean; fix: boolean; anchorX: number; anchorZ: number; anchorAt: number; lastAcceptedAt: number; powerReadyAt: number; windReadyAt: number; fireReadyAt?: number; stoneReadyAt?: number };
const live = (sim: WorldSim, n = 'Ana') => (sim as unknown as { live: Map<string, Live> }).live.get(n)!;

function setup(w: SavedWorld = newWorld(42, 'salt'), names = ['Ana']) {
  w.fogOpen = true;
  w.time = DAY_LENGTH * 0.33;
  const sim = new WorldSim(w);
  for (const n of names) {
    if (!sim.getPlayer(n)) sim.createPlayer(n, 'hash');
    sim.connect(n);
    Object.assign(sim.getPlayer(n)!, { enredadera: true, viento: true, fuego: true, piedra: true });
    put(sim, 0, CORRUPT_LANDS.z1 - 40, n);
  }
  sim.step(0.05);
  sim.drain();
  return sim;
}
function put(sim: WorldSim, x: number, z: number, n = 'Ana', y?: number) {
  const p = sim.getPlayer(n)!;
  Object.assign(p, { x, z, y: y ?? sim.terrain.heightAt(x, z) });
  Object.assign(live(sim, n), { anchorX: x, anchorZ: z, anchorAt: (sim as unknown as { time: number }).time, lastAcceptedAt: (sim as unknown as { time: number }).time });
}
const msgs = (sim: WorldSim) => sim.drain().map((o) => o.msg);
const texts = (m: ServerMsg[]) => m.flatMap((x) => (x.t === 'toast' ? [x.text] : []));
const visions = (m: ServerMsg[]) => m.flatMap((x) => (x.t === 'vision' ? [x.lines.join(' ')] : []));
const snap = (sim: WorldSim) => sim.snapshotFor('Ana') as Extract<ServerMsg, { t: 'snap' }>;
const ready = (sim: WorldSim) => Object.assign(live(sim), { powerReadyAt: 0, windReadyAt: 0, fireReadyAt: 0, stoneReadyAt: 0 });
function pull(sim: WorldSim, id: number) {
  sim.handle('Ana', { t: 'pillar', id });
  const m = msgs(sim);
  for (let i = 0; i < 32; i++) sim.step(0.1);
  return [...m, ...msgs(sim)];
}
function bridgeAll(sim: WorldSim) {
  for (const r of S.roots) {
    put(sim, r.x + (r.x > S.cores[0]!.x ? 2 : -2), r.z);
    ready(sim);
    sim.handle('Ana', { t: 'power', kind: 'enredadera', x: r.x, z: r.z });
  }
}

describe('protocol (S5-C)', () => {
  it('decodes pillar 0–3 only; version 47', () => {
    expect(decodeClient('{"t":"pillar","id":3}')).toEqual({ t: 'pillar', id: 3 });
    for (const bad of ['{"t":"pillar","id":4}', '{"t":"pillar","id":-1}', '{"t":"pillar","id":"a"}', '{"t":"pillar"}']) expect(decodeClient(bad)).toBeNull();
    expect(PROTOCOL_VERSION).toBeGreaterThanOrEqual(47);
  });
});

describe('las Tierras seen (S5 §6)', () => {
  it('the first walker sets corruptSeen with a vision, once; saved', () => {
    const sim = setup();
    const m = msgs(sim);
    expect(sim.save().corruptSeen).toBe(true);
    sim.step(0.05);
    expect(visions(msgs(sim))).toHaveLength(0);
    const fresh = new WorldSim(newWorld(42, 'salt'));
    expect(fresh.save().corruptSeen).toBeUndefined();
    void m;
  });
  it('zones 18–21 start corrupt', () => {
    const sim = setup();
    expect(snap(sim).corrupt.slice(-4)).toEqual([18, 19, 20, 21]);
  });
});

describe('Pilar de Enredadera', () => {
  it('the thicket bites; roots make bridges; with 3/3 the core pulls in 3 s and zone 19 cleans', () => {
    const sim = setup();
    const c = S.cores[0]!;
    const r0 = S.roots[0]!;
    const mid = { x: (c.x + r0.x) / 2, z: (c.z + r0.z) / 2 };
    put(sim, mid.x, mid.z);
    const hp = sim.getPlayer('Ana')!.vitals.health;
    sim.step(1);
    expect(hp - sim.getPlayer('Ana')!.vitals.health).toBeGreaterThan(THICKET.dps * 0.8);
    put(sim, r0.x + 2, r0.z);
    ready(sim);
    sim.handle('Ana', { t: 'power', kind: 'enredadera', x: r0.x, z: r0.z });
    expect(texts(msgs(sim))).toContain('Una raíz cruza las espinas (1/3)');
    put(sim, mid.x, mid.z);
    const hp2 = sim.getPlayer('Ana')!.vitals.health;
    sim.step(1);
    expect(sim.getPlayer('Ana')!.vitals.health).toBeGreaterThanOrEqual(hp2 - 1);
    put(sim, c.x + 1, c.z);
    sim.handle('Ana', { t: 'pillar', id: 0 });
    expect(texts(msgs(sim))).toContain('Las espinas lo abrazan. Faltan raíces (1/3)');
    for (const r of S.roots.slice(1)) {
      put(sim, r.x, r.z + 2);
      ready(sim);
      sim.handle('Ana', { t: 'power', kind: 'enredadera', x: r.x, z: r.z });
    }
    expect(snap(sim).pillars.roots).toEqual([true, true, true]);
    put(sim, c.x + 1, c.z);
    const m = pull(sim, 0);
    expect(texts(m)).toContain('Tiras del núcleo… (3 s)');
    expect(m.some((x) => x.t === 'toast' && x.text === 'El Pilar-raíz de Enredadera se parte (1/4)')).toBe(true);
    expect(visions(m).some((v) => v.includes('Eso me dolió, Ana'))).toBe(true);
    expect(snap(sim).pillars.broken).toEqual([true, false, false, false]);
    expect(snap(sim).corrupt).not.toContain(19);
    expect(sim.save().pillars).toEqual([0]);
  });

  it('walking away mid-pull lets go', () => {
    const sim = setup();
    bridgeAll(sim);
    const c = S.cores[0]!;
    put(sim, c.x + 1, c.z);
    sim.handle('Ana', { t: 'pillar', id: 0 });
    sim.step(1);
    put(sim, c.x + 6, c.z);
    sim.step(0.1);
    expect(texts(msgs(sim))).toContain('Sueltas el núcleo');
    for (let i = 0; i < 30; i++) sim.step(0.1);
    expect(snap(sim).pillars.broken[0]).toBe(false);
  });
});

describe('Pilar de Viento and el Lago Negro', () => {
  it('swimmers and the fish are at home in the lake', () => {
    const sim = setup();
    const surf = waterLevel(sim.terrain, LAKE.x, LAKE.z);
    const p = sim.getPlayer('Ana')!;
    put(sim, LAKE.x + 5, LAKE.z, 'Ana', surf - 0.9);
    sim.step(0.2);
    sim.handle('Ana', { t: 'move', x: LAKE.x + 5.4, y: surf - 0.9, z: LAKE.z, yaw: 0, anim: 'swim' });
    expect(live(sim).fix).toBe(false);
    expect(p.x).toBeCloseTo(LAKE.x + 5.4);
    p.fish = { x: LAKE.x + 5.4, z: LAKE.z };
    live(sim).fish = true;
    sim.step(0.2);
    sim.handle('Ana', { t: 'move', x: LAKE.x + 6, y: sim.terrain.heightAt(LAKE.x + 6, LAKE.z) + 0.6, z: LAKE.z, yaw: 0, anim: 'swim' });
    expect(live(sim).fix).toBe(false);
    expect(p.fish!.x).toBeCloseTo(LAKE.x + 6, 1);
  });

  it('the anchor only takes hits diving; broken, the miasma needs 3 gusts; then the core pulls and zone 20 cleans', () => {
    const sim = setup();
    const surf = waterLevel(sim.terrain, LAKE.x, LAKE.z);
    const bed = sim.terrain.heightAt(LAKE.x, LAKE.z);
    put(sim, LAKE.x + 1, LAKE.z, 'Ana', surf - 0.9);
    const a = snap(sim).wolves.find((w) => w.id === PILLAR.idBase + 1);
    expect(a?.kind).toBe('anchor');
    sim.handle('Ana', { t: 'attack', id: PILLAR.idBase + 1 });
    expect(texts(msgs(sim))).toContain('Está en el fondo. Bucea con el pez');
    const w = (sim as unknown as { lakeAnchor: { hp: number } }).lakeAnchor;
    expect(w.hp).toBe(LAKE_PILLAR.anchorHp);
    put(sim, LAKE.x + 1, LAKE.z, 'Ana', bed + 0.6);
    for (let i = 0; i < 80 && snap(sim).pillars.anchor; i++) {
      sim.step(1);
      sim.handle('Ana', { t: 'attack', id: PILLAR.idBase + 1 });
    }
    expect(snap(sim).pillars.anchor).toBe(false);
    expect(texts(msgs(sim)).some((t) => t.startsWith('Se parte la cadena del fondo'))).toBe(true);
    const c = S.cores[1]!;
    put(sim, c.x + 4, c.z);
    sim.handle('Ana', { t: 'pillar', id: 1 });
    for (let i = 0; i < 3; i++) {
      ready(sim);
      sim.handle('Ana', { t: 'power', kind: 'viento', x: c.x, z: c.z });
    }
    expect(snap(sim).pillars.miasma).toBe(LAKE_PILLAR.miasma);
    put(sim, c.x + 1, c.z);
    const m = pull(sim, 1);
    expect(texts(m)).toContain('El Pilar-raíz de Viento se parte (1/4)');
    expect(snap(sim).corrupt).not.toContain(20);
  });
});

describe('Pilar de Fuego', () => {
  it('ash hurts walkers not riders; 3 rayos come out; 3 Llamaradas burn the cocoon; zone 21 cleans', () => {
    const sim = setup();
    const c = S.cores[2]!;
    const before = sim.wolfList.filter((w) => w.kind === 'rayo').length;
    put(sim, c.x + 10, c.z);
    const hp = sim.getPlayer('Ana')!.vitals.health;
    sim.step(1);
    expect(hp - sim.getPlayer('Ana')!.vitals.health).toBeGreaterThan(ASH_RUN.dps * 0.8);
    expect(sim.wolfList.filter((w) => w.kind === 'rayo').length - before).toBe(ASH_RUN.guards);
    sim.getPlayer('Ana')!.steed = { x: c.x + 10, z: c.z };
    live(sim).riding = true;
    const hp2 = sim.getPlayer('Ana')!.vitals.health;
    sim.step(0.5);
    expect(sim.getPlayer('Ana')!.vitals.health).toBeGreaterThanOrEqual(hp2 - 3); // rayos may bite; no ash
    live(sim).riding = false;
    put(sim, c.x + 2, c.z);
    sim.handle('Ana', { t: 'pillar', id: 2 });
    expect(texts(msgs(sim))).toContain('El capullo de espinas aguanta. Fuego (0/3)');
    for (let i = 0; i < 3; i++) {
      ready(sim);
      sim.handle('Ana', { t: 'power', kind: 'fuego', x: c.x, z: c.z });
    }
    expect(snap(sim).pillars.burns).toBe(3);
    (sim as unknown as { wolves: unknown[] }).wolves.length = 0;
    sim.getPlayer('Ana')!.vitals.health = 100;
    const m = pull(sim, 2);
    expect(texts(m)).toContain('El Pilar-raíz de Fuego se parte (1/4)');
    expect(snap(sim).corrupt).not.toContain(21);
  });
});

describe('Pilar de Piedra', () => {
  it('the lid holds until a Piedra pillar or a friend weighs the plate; no zone of its own', () => {
    const sim = setup(newWorld(42, 'salt'), ['Ana', 'Bea']);
    const c = S.cores[3]!;
    put(sim, c.x + 1, c.z);
    put(sim, c.x + 20, c.z, 'Bea');
    sim.handle('Ana', { t: 'pillar', id: 3 });
    expect(texts(msgs(sim))).toContain('La tapa no se mueve. Algo tiene que pisar la losa');
    put(sim, S.plate.x, S.plate.z, 'Bea');
    expect(snap(sim).pillars.lid).toBe(true);
    const before = snap(sim).corrupt;
    const m = pull(sim, 3);
    expect(texts(m)).toContain('El Pilar-raíz de Piedra se parte (1/4)');
    expect(snap(sim).corrupt).toEqual(before);
  });

  it('a Piedra pillar on the plate works alone', () => {
    const sim = setup();
    put(sim, S.plate.x + 3, S.plate.z);
    ready(sim);
    sim.handle('Ana', { t: 'power', kind: 'piedra', x: S.plate.x, z: S.plate.z });
    expect(snap(sim).pillars.lid).toBe(true);
    put(sim, S.cores[3]!.x + 1, S.cores[3]!.z);
    expect(texts(pull(sim, 3))).toContain('El Pilar-raíz de Piedra se parte (1/4)');
  });
});

describe('all four, saves', () => {
  it('the 4th says (4/4); broken pillars survive a reload; old saves have none', () => {
    const w = newWorld(42, 'salt');
    w.pillars = [0, 1, 2];
    const sim = setup(w);
    expect(snap(sim).pillars.broken).toEqual([true, true, true, false]);
    expect(snap(sim).pillars.anchor).toBe(false);
    put(sim, S.plate.x + 3, S.plate.z);
    ready(sim);
    sim.handle('Ana', { t: 'power', kind: 'piedra', x: S.plate.x, z: S.plate.z });
    put(sim, S.cores[3]!.x + 1, S.cores[3]!.z);
    expect(texts(pull(sim, 3))).toContain('El Pilar-raíz de Piedra se parte (4/4)');
    const again = new WorldSim(sim.save());
    again.connect('Ana');
    expect((again.snapshotFor('Ana') as Extract<ServerMsg, { t: 'snap' }>).pillars.broken).toEqual([true, true, true, true]);
  });
});
