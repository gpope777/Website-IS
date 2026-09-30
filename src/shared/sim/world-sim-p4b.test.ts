import { describe, expect, it } from 'vitest';
import type { ServerMsg } from '../protocol';
import { decodeClient, PROTOCOL_VERSION } from '../protocol';
import { PROGRESS, SKILL_FX } from '../progression';
import { HARVEST } from '../resources';
import { STRUCTURE_HP } from '../items';
import { FOGATA, generateFogatas } from '../fogatas';
import { AMBER } from '../swamp-shrines';
import { MOUNT } from '../mount';
import { weatherAt } from '../weather';
import { mountainFeatures, WATER_LEVEL } from '../terrain';
import { DAY_LENGTH, GRAVE, newWorld, REVIVE, WorldSim } from './world-sim';

type Live = { anchorX: number; anchorZ: number; anchorAt: number; lastAcceptedAt: number; riding: boolean };
type Priv = { structures: { id: number; kind: string; x: number; y: number; z: number; rot: number; owner: string; hp: number }[]; fogatas: boolean[]; live: Map<string, Live>; graves: { id: number; owner: string; x: number; y: number; z: number; inv: Record<string, number> }[] };
const priv = (s: WorldSim) => s as unknown as Priv;

function setup(...names: string[]) {
  const sim = new WorldSim(newWorld(42, 'salt'));
  for (const n of names.length ? names : ['Ana']) {
    sim.createPlayer(n, 'hash');
    sim.connect(n);
  }
  sim.time = DAY_LENGTH * 0.4;
  sim.drain();
  return sim;
}
const self = (sim: WorldSim, n = 'Ana') => (sim.snapshotFor(n) as Extract<ServerMsg, { t: 'snap' }>).self;
const texts = (sim: WorldSim) => sim.drain().flatMap((o) => (o.msg.t === 'toast' ? [o.msg.text] : []));
function put(sim: WorldSim, name: string, x: number, z: number) {
  const p = sim.getPlayer(name)!;
  Object.assign(p, { x, z, y: sim.terrain.heightAt(x, z) });
}
/** Ana at Rango r (Savia in the live xp) with these oficios. */
function ranked(sim: WorldSim, r: number, skills: string[] = []) {
  const p = sim.getPlayer('Ana')!;
  p.xp = PROGRESS.ranks[r - 1]!;
  p.skills = skills;
  return p;
}
function heartAt(sim: WorldSim, x: number, z: number) {
  priv(sim).structures.push({ id: 900, kind: 'heart', x, y: sim.terrain.heightAt(x, z), z, rot: 0, owner: 'Ana', hp: 500 });
}

describe('Oficios (P4-B): learn and forget', () => {
  it('is protocol 56 and decodes learn / forget', () => {
    expect(PROTOCOL_VERSION).toBe(66);
    expect(decodeClient(JSON.stringify({ t: 'learn', id: 'pies' }))).toEqual({ t: 'learn', id: 'pies' });
    expect(decodeClient(JSON.stringify({ t: 'learn', id: 'volar' }))).toBeNull();
    expect(decodeClient(JSON.stringify({ t: 'forget' }))).toEqual({ t: 'forget' });
  });

  it('learns in order, with the points of the Rango; saved and in the snapshot', () => {
    const sim = setup();
    ranked(sim, 3);
    expect(self(sim).skills).toEqual([]);
    sim.handle('Ana', { t: 'learn', id: 'planeo' });
    expect(texts(sim)).toContain('Antes, el de arriba');
    sim.handle('Ana', { t: 'learn', id: 'pies' });
    sim.handle('Ana', { t: 'learn', id: 'planeo' });
    sim.handle('Ana', { t: 'learn', id: 'mano' });
    expect(texts(sim)).toContain('Sin puntos. Sube de Rango');
    expect(self(sim).skills).toEqual(['pies', 'planeo']);
    expect(sim.save().players[0]!.skills).toEqual(['pies', 'planeo']);
  });

  it('forget: only at the Heart, for 5 bayas', () => {
    const sim = setup();
    const p = ranked(sim, 3, ['pies']);
    heartAt(sim, p.x + 20, p.z);
    p.inv = { berries: 4 };
    sim.handle('Ana', { t: 'forget' });
    expect(p.skills).toEqual(['pies']);
    put(sim, 'Ana', p.x + 18, p.z);
    sim.handle('Ana', { t: 'forget' });
    expect(texts(sim)).toContain('Hacen falta 5 bayas');
    p.inv = { berries: 6 };
    sim.handle('Ana', { t: 'forget' });
    expect(p.skills).toEqual([]);
    expect(p.inv.berries).toBe(1);
  });

  it('an old save has no oficios and every point free', () => {
    const w = newWorld(42, 'salt');
    w.players.push({ name: 'Ana', pinHash: 'hash', x: 0, y: 0, z: 0, yaw: 0, vitals: { health: 100, hunger: 100, warmth: 100 }, inv: {}, dead: false, shrines: [0, 1, 2] });
    const sim = new WorldSim(w);
    sim.connect('Ana');
    expect(self(sim).skills).toEqual([]);
    sim.handle('Ana', { t: 'learn', id: 'amiga' });
    expect(self(sim).skills).toEqual(['amiga']);
  });
});

describe('Oficios (P4-B): effects on the server', () => {
  it('Mano buena: one more wood', () => {
    const sim = setup();
    const p = ranked(sim, 2, ['mano']);
    const t = sim.resources.find((r) => r.kind === 'tree')!;
    put(sim, 'Ana', t.x + 1, t.z);
    sim.handle('Ana', { t: 'harvest', id: t.id });
    expect(p.inv.wood).toBe(HARVEST.tree.amount + SKILL_FX.harvest);
  });

  it('Fogatero: the channel takes 2 s', () => {
    const sim = setup();
    ranked(sim, 3, ['mano', 'fogatero']);
    const f = generateFogatas(sim.terrain, 42)[0]!;
    priv(sim).fogatas[0] = true;
    heartAt(sim, 0, 0);
    put(sim, 'Ana', f.x + 1, f.z);
    sim.handle('Ana', { t: 'travel', to: 'heart' });
    expect(self(sim).travel).toBe(SKILL_FX.channel);
  });

  it('Buen ojo: amber is back after 1 day', () => {
    const sim = setup();
    const p = ranked(sim, 5, ['mano', 'fogatero', 'trampero', 'ojo']);
    const t = sim.amberTrees.find((a) => a.y < sim.terrain.heightAt(a.x, a.z) + 1)!;
    Object.assign(p, { x: t.x + 0.5, z: t.z, y: t.y });
    sim.handle('Ana', { t: 'amber', id: t.id });
    expect(p.inv.amber).toBe(AMBER.yield);
    sim.time += DAY_LENGTH * 1.01;
    sim.handle('Ana', { t: 'amber', id: t.id });
    expect(p.inv.amber).toBe(AMBER.yield * 2);
  });

  it('Mano amiga: a revive from twice as far', () => {
    const sim = setup('Ana', 'Leo');
    ranked(sim, 2, ['amiga']);
    put(sim, 'Ana', 10, 10);
    put(sim, 'Leo', 10 + REVIVE.reach * 1.6, 10);
    const leo = sim.getPlayer('Leo')!;
    leo.vitals = { health: 0.01, hunger: 0, warmth: 0 };
    for (let i = 0; i < 20 && !leo.dead; i++) sim.step(0.1);
    expect(leo.dead).toBe(true);
    sim.handle('Ana', { t: 'revive', name: 'Leo' });
    expect(leo.dead).toBe(false);
  });

  it('Silbido: call the deer from a lit fogata that is not la Ceniza', () => {
    const sim = setup();
    const p = ranked(sim, 3, ['amiga', 'silbido']);
    const f = generateFogatas(sim.terrain, 42)[0]!;
    expect(f.id).not.toBe(FOGATA.ceniza);
    priv(sim).fogatas[0] = true;
    put(sim, 'Ana', f.x + 1, f.z);
    p.steed = { x: 10, z: 10 };
    sim.handle('Ana', { t: 'call', beast: 'deer' });
    expect(Math.hypot(p.steed.x - f.x, p.steed.z - f.z)).toBeLessThan(6);
    p.skills = [];
    p.steed = { x: 10, z: 10 };
    sim.handle('Ana', { t: 'call', beast: 'deer' });
    expect(p.steed).toEqual({ x: 10, z: 10 });
  });

  it('Mochila honda: the grave comes back from 8 m', () => {
    const sim = setup();
    const p = ranked(sim, 4, ['amiga', 'silbido', 'mochila']);
    priv(sim).graves.push({ id: 1, owner: 'Ana', x: p.x + 8, y: p.y, z: p.z, inv: { stone: 3 } });
    sim.step(0.1);
    expect(p.inv.stone).toBe(3);
    expect(8).toBeGreaterThan(GRAVE.pickup);
  });

  it('Trampero: your spikes have 30 % more hp', () => {
    const sim = setup();
    const p = ranked(sim, 4, ['mano', 'fogatero', 'trampero']);
    p.inv = { wood: 10, stone: 10 };
    let at = { x: 0, z: 0 };
    for (let x = -40; x <= 40; x += 2) if (sim.terrain.heightAt(x, 20) > WATER_LEVEL + 1) { at = { x, z: 20 }; break; }
    put(sim, 'Ana', at.x, at.z);
    sim.handle('Ana', { t: 'place', kind: 'spikes', x: at.x + 1, z: at.z, rot: 0 });
    const s = priv(sim).structures.find((x) => x.kind === 'spikes')!;
    expect(s.hp).toBeCloseTo(STRUCTURE_HP.spikes * SKILL_FX.trap);
  });
});

describe('Oficios (P4-B): the server accepts the moves they allow', () => {
  function arm(sim: WorldSim) {
    const p = sim.getPlayer('Ana')!;
    const l = priv(sim).live.get('Ana')!;
    Object.assign(l, { anchorX: p.x, anchorZ: p.z, anchorAt: sim.time - 1, lastAcceptedAt: sim.time - 1 });
  }
  function dryRun(sim: WorldSim, len: number) {
    for (let x = -60; x <= 60; x += 1) {
      let ok = true;
      for (let d = 0; d <= len; d += 1) if (sim.terrain.heightAt(x + d, 30) < WATER_LEVEL + 0.5) ok = false;
      if (ok) return x;
    }
    throw new Error('no dry run');
  }

  it('Pastor: a rider may go 10 % faster', () => {
    for (const skills of [[], ['amiga', 'silbido', 'mochila', 'pastor']]) {
      const sim = setup();
      ranked(sim, 5, skills);
      const len = MOUNT.maxSpeed * 1.08 + 1;
      const x0 = dryRun(sim, len);
      put(sim, 'Ana', x0, 30);
      priv(sim).live.get('Ana')!.riding = true;
      arm(sim);
      sim.handle('Ana', { t: 'move', x: x0 + len, y: sim.terrain.heightAt(x0 + len, 30), z: 30, yaw: 0, anim: 'walk' });
      expect(sim.getPlayer('Ana')!.x === x0 + len).toBe(skills.length > 0);
    }
  });

  it('Trepador: up wet rock', () => {
    const day = (w: string) => { let d = 0; while (weatherAt(42, d) !== w) d++; return d; };
    const pw = mountainFeatures(42).paredes[0]!;
    const out = pw.x + pw.rt + pw.w + 1;
    for (const skills of [[], ['pies', 'planeo', 'pulmon', 'trepador']]) {
      const sim = setup();
      ranked(sim, 5, skills);
      sim.time = (day('rain') + 0.5) * DAY_LENGTH;
      put(sim, 'Ana', out, pw.z);
      for (let i = 0; i < 11; i++) sim.step(0.1);
      sim.handle('Ana', { t: 'move', x: out - 4, y: sim.terrain.heightAt(out - 4, pw.z), z: pw.z, yaw: 0, anim: 'walk' });
      expect(sim.getPlayer('Ana')!.x === out - 4).toBe(skills.length > 0);
    }
  });

  it('Planeo largo: a slow glide down is accepted', () => {
    const sim = setup();
    const p = ranked(sim, 3, ['pies', 'planeo']);
    p.y += 20;
    arm(sim);
    const y = p.y - GLIDE_SINK_SLOW;
    sim.handle('Ana', { t: 'move', x: p.x + 5, y, z: p.z, yaw: 0, anim: 'glide' });
    expect(sim.getPlayer('Ana')!.y).toBe(y);
  });
});
const GLIDE_SINK_SLOW = 1.6 * SKILL_FX.sink;
