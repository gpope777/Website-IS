import { describe, expect, it } from 'vitest';
import { DUNGEON } from '../dungeon';
import { FISH } from '../fish';
import type { ServerMsg } from '../protocol';
import { PROTOCOL_VERSION } from '../protocol';
import { STRUCTURE_HP } from '../items';
import { SWAMP_SHRINE } from '../swamp-shrines';
import { HALF, WATER_LEVEL } from '../terrain';
import { DAY_LENGTH, newWorld, WorldSim, type SavedWorld } from './world-sim';
import type { Wolf } from './wolves';

type Priv = {
  structures: { id: number; kind: string; x: number; y: number; z: number; rot: number; owner: string; hp: number }[];
  wolves: Wolf[];
  strike(name: string, w: Wolf, dmg: number): void;
  hurt(p: unknown, dmg: number): void;
  winFinal(): void;
  boss: { hp: number } | null;
  raid: unknown;
  raidLow: number;
  wasNight: boolean;
};
const priv = (s: WorldSim) => s as unknown as Priv;

function setup(names: string[] = ['Ana', 'Bea'], mod?: (w: SavedWorld) => void) {
  const w = newWorld(42, 'salt');
  mod?.(w);
  const sim = new WorldSim(w);
  for (const n of names) {
    if (!sim.getPlayer(n)) sim.createPlayer(n, 'hash');
    sim.connect(n);
  }
  sim.time = DAY_LENGTH * 0.4;
  sim.drain();
  return sim;
}
const self = (sim: WorldSim, n = 'Ana') => (sim.snapshotFor(n) as Extract<ServerMsg, { t: 'snap' }>).self;
const feats = (sim: WorldSim, n = 'Ana') => self(sim, n).book.feats;
function put(sim: WorldSim, n: string, x: number, z: number, y?: number) {
  const p = sim.getPlayer(n)!;
  Object.assign(p, { x, z, y: y ?? sim.terrain.heightAt(x, z) });
}
const foe = (id: number, kind: Wolf['kind'], x = 4, z = 0) => ({ id, x, y: 0, z, yaw: 0, hp: 5, target: null, cooldown: 0, deadFor: 0, wander: 0, anim: 'idle', raid: false, kind, stun: 0 }) as Wolf;
function kill(sim: WorldSim, w: Wolf) {
  priv(sim).wolves.push(w);
  priv(sim).strike('Ana', w, 999);
}

describe('Libro y Proezas (P4-D, server)', () => {
  it('protocol 58; a new player has an empty book', () => {
    expect(PROTOCOL_VERSION).toBe(62);
    const b = self(setup()).book;
    expect(b).toMatchObject({ feats: [], bosses: 0, kills: { wolf: 0, brute: 0, rayo: 0 }, raids: 0, zones: 0, shrinesMax: 12, chestsMax: 6, day: 1 });
    expect(b.zonesMax).toBeGreaterThanOrEqual(21);
  });

  it('an old save loads; its powers count their bosses', () => {
    const sim = setup(['Ana'], (w) => {
      w.players.push({ name: 'Ana', pinHash: 'hash', x: 0, y: 0, z: 0, yaw: 0, vitals: { health: 100, hunger: 100, warmth: 100 }, inv: {}, dead: false, viento: true });
    });
    expect(self(sim).book).toMatchObject({ feats: [], bosses: 2, raids: 0 });
  });

  it('kills count for the striker; a lieutenant for everyone near', () => {
    const sim = setup();
    put(sim, 'Ana', 0, 0);
    put(sim, 'Bea', 4, 30);
    kill(sim, foe(9001, 'wolf'));
    kill(sim, foe(9002, 'brute'));
    kill(sim, foe(9003, 'lieut1'));
    expect(self(sim).book.kills).toEqual({ wolf: 1, brute: 1, rayo: 0 });
    expect(self(sim, 'Bea').book.kills.wolf).toBe(0);
    expect(self(sim).book.bosses).toBe(1);
    expect(self(sim, 'Bea').book.bosses).toBe(1);
    kill(sim, foe(9004, 'lieut1'));
    expect(sim.getPlayer('Ana')!.bosses).toEqual(['lieut1']);
  });

  function raidDawn(low: number) {
    const sim = setup();
    priv(sim).structures.push({ id: 900, kind: 'heart', x: 10, y: 0, z: 10, rot: 0, owner: 'Ana', hp: STRUCTURE_HP.heart });
    Object.assign(priv(sim), { raid: { phase: 'active', dir: 0 }, raidLow: low, wasNight: true });
    sim.step(0.1);
    return sim;
  }
  it('Noche entera: a raid held with the Heart never under half', () => {
    const sim = raidDawn(1);
    expect(self(sim).book.raids).toBe(1);
    expect(feats(sim)).toEqual([5]);
    expect(feats(sim, 'Bea')).toEqual([5]);
    expect(sim.drain().some((o) => o.to === 'Ana' && o.msg.t === 'toast' && o.msg.text === 'Proeza: Noche entera.')).toBe(true);
    const low = raidDawn(0.4);
    expect(self(low).book.raids).toBe(1);
    expect(feats(low)).toEqual([]);
  });

  it('Sin un rasguño: the Tragón beaten by who never got hurt; hat 7', () => {
    const sim = setup();
    put(sim, 'Ana', DUNGEON.x, DUNGEON.bossZ - 3);
    put(sim, 'Bea', DUNGEON.x + 1, DUNGEON.bossZ - 3);
    sim.step(0.1);
    expect(priv(sim).boss).not.toBeNull();
    priv(sim).hurt(sim.getPlayer('Bea'), 5);
    priv(sim).boss!.hp = 0;
    sim.step(0.1);
    expect(feats(sim)).toEqual([1]);
    expect(feats(sim, 'Bea')).toEqual([]);
    expect(self(sim).hats).toContain(7);
    expect(sim.drain().some((o) => o.msg.t === 'toast' && /Nuevo sombrero: Papel doblado/.test(o.msg.text))).toBe(true);
  });

  function fishRace(wait: number) {
    const sim = setup(['Ana']);
    put(sim, 'Ana', sim.fishHome.x + 1, sim.fishHome.z);
    sim.handle('Ana', { t: 'mount', act: 6 });
    for (let i = 0; i < FISH.rings; i++) {
      for (let t = 0; t < wait; t += 0.1) sim.step(0.1);
      const r = sim.fishRings[i]!;
      put(sim, 'Ana', r.x + 1, r.z);
      sim.step(0.1);
    }
    return sim;
  }
  it('Pez veloz: the ring race in ≤ 80 % of its time', () => {
    expect(feats(fishRace(0))).toEqual([2]);
    const slow = fishRace(FISH.ringTime * 0.9);
    expect(self(slow).race).toBeNull();
    expect(self(slow).tame).not.toBeNull();
    expect(feats(slow)).toEqual([]);
  });

  function lilies(splash: boolean) {
    const sim = setup(['Ana']);
    const pads = sim.shrines.find((s) => s.kind === 'lilies')!.parts;
    const top = WATER_LEVEL + SWAMP_SHRINE.padTop;
    put(sim, 'Ana', pads[0]!.x, pads[0]!.z, top);
    sim.step(0.1);
    if (splash) {
      put(sim, 'Ana', pads[1]!.x + 3, pads[1]!.z, WATER_LEVEL - 0.6);
      sim.step(0.1);
    }
    const last = pads[pads.length - 1]!;
    put(sim, 'Ana', last.x, last.z, top);
    sim.step(0.1);
    return sim;
  }
  it('Pies secos: the Nenúfares pad to pad, dry', () => {
    expect(feats(lilies(false))).toEqual([3]);
    expect(feats(lilies(true))).toEqual([]);
  });

  function coldNight(warm: boolean) {
    const sim = setup(['Ana']);
    put(sim, 'Ana', 0, -HALF - 10);
    sim.time = DAY_LENGTH * 0.95;
    priv(sim).wasNight = false;
    sim.step(0.1);
    if (warm) {
      priv(sim).structures.push({ id: 901, kind: 'campfire', x: 0, y: 0, z: -HALF - 10, rot: 0, owner: 'Ana', hp: STRUCTURE_HP.campfire });
      sim.step(0.1);
    }
    put(sim, 'Ana', 0, -HALF - 150);
    sim.step(0.1);
    return sim;
  }
  it('Solo contra el frío: the Cumbre at night, never warm; hat 8', () => {
    const sim = coldNight(false);
    expect(feats(sim)).toEqual([4]);
    expect(self(sim).hats).toContain(8);
    expect(feats(coldNight(true))).toEqual([]);
  });

  it('Corazón quieto: El Marchito falls with weapon ≤ +4; hat 9', () => {
    const sim = setup();
    sim.getPlayer('Ana')!.weaponLvl = 4;
    sim.getPlayer('Bea')!.weaponLvl = 5;
    priv(sim).winFinal();
    expect(feats(sim)).toEqual([6]);
    expect(self(sim).hats).toContain(9);
    expect(feats(sim, 'Bea')).toEqual([]);
  });

  it('a Proeza counts once', () => {
    const sim = raidDawn(1);
    sim.drain();
    Object.assign(priv(sim), { raid: { phase: 'active', dir: 0 }, raidLow: 1, wasNight: true });
    sim.step(0.1);
    expect(feats(sim)).toEqual([5]);
    expect(self(sim).book.raids).toBe(2);
    expect(sim.drain().some((o) => o.msg.t === 'toast' && /Proeza/.test(o.msg.text))).toBe(false);
  });
});
