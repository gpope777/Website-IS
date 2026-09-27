import { describe, expect, it } from 'vitest';
import type { ServerMsg } from '../protocol';
import { decodeClient } from '../protocol';
import { RIM_LINE } from '../corrupt-lands';
import { STEEP_TEXT } from '../mountains';
import { TOWER_DUNGEON as T } from '../tower-dungeon';
import { FINAL } from './marchito-final';
import { DAY_LENGTH, newWorld, WorldSim, type SavedWorld } from './world-sim';

type Priv = { structures: { id: number; kind: string; x: number; z: number }[]; winFinal(): void; invasion2: string; marchito: unknown; wolves: { kind: string; raid?: boolean }[] };
const priv = (sim: WorldSim) => sim as unknown as Priv;
const HEART = { x: 20, z: 20 };

function setup(w: SavedWorld = newWorld(42, 'salt'), ...names: string[]) {
  w.towerOpen = true;
  const sim = new WorldSim(w);
  if (!sim.heart()) priv(sim).structures.push({ id: 900, kind: 'heart', x: HEART.x, y: 0, z: HEART.z, rot: 0, owner: 'Ana', hp: 500 } as never);
  for (const n of names) {
    if (!sim.getPlayer(n)) sim.createPlayer(n, 'hash');
    sim.connect(n);
  }
  sim.time = DAY_LENGTH * 0.4;
  return sim;
}
function put(sim: WorldSim, name: string, x: number, z: number, y = sim.terrain.heightAt(x, z)) {
  Object.assign(sim.getPlayer(name)!, { x, y, z });
}
const msgs = (sim: WorldSim) => sim.drain();
const snap = (sim: WorldSim, name = 'Ana') => sim.snapshotFor(name) as Extract<ServerMsg, { t: 'snap' }>;
const endings = (out: ReturnType<WorldSim['drain']>, to: string) => out.filter((o) => (o.to === to || o.to === null) && o.msg.t === 'ending').map((o) => o.msg as Extract<ServerMsg, { t: 'ending' }>);

/** Ana and Leo in the Copa, Bea online by the lake; he falls. */
function win() {
  const sim = setup(undefined, 'Ana', 'Leo', 'Bea');
  put(sim, 'Ana', FINAL.x, FINAL.z - 4, T.floor);
  put(sim, 'Leo', FINAL.x + 2, FINAL.z - 4, T.floor);
  put(sim, 'Bea', 0, 0);
  msgs(sim);
  priv(sim).winFinal();
  return sim;
}

describe('the ending (S5-G)', () => {
  it('everyone online gets the cards and the credits; the killers are named; the Torre goes home', () => {
    const sim = win();
    const out = msgs(sim);
    for (const n of ['Ana', 'Leo', 'Bea']) {
      const e = endings(out, n);
      expect(e).toHaveLength(1);
      expect(e[0]!.cards).toHaveLength(4);
      expect(e[0]!.cards[2]).toBe('«Yo también era un bosque… Ana y Leo.»');
      expect(e[0]!.credits).toContain('Ana y Leo');
      expect(sim.getPlayer(n)!.credits).toBe(true);
    }
    expect(sim.save().endingNames).toEqual(['Ana', 'Leo']);
    for (const n of ['Ana', 'Leo']) {
      const p = sim.getPlayer(n)!;
      expect(Math.hypot(p.x - HEART.x, p.z - HEART.z)).toBeLessThanOrEqual(6);
    }
    expect(sim.getPlayer('Bea')!.x).toBe(0);
  });

  it('every zone is clean, the snapshot says ending', () => {
    const sim = win();
    const s = snap(sim);
    expect(s.corrupt).toEqual([]);
    expect(s.ending).toBe(true);
    expect(s.raidsOff).toBe(false);
    expect(sim.save().cleansed!.length).toBeGreaterThanOrEqual(22);
  });

  it('whoever was offline gets the credits on their next login, once', () => {
    const w = newWorld(42, 'salt');
    const pre = setup(w, 'Ana', 'Zoe');
    pre.markAway('Zoe');
    const saved = pre.save();
    const sim = setup(saved, 'Ana');
    put(sim, 'Ana', FINAL.x, FINAL.z - 4, T.floor);
    priv(sim).winFinal();
    msgs(sim);
    expect(sim.getPlayer('Zoe')!.credits).toBeUndefined();
    const again = new WorldSim(sim.save());
    again.connect('Zoe');
    const e = endings(again.drain(), 'Zoe');
    expect(e).toHaveLength(1);
    expect(e[0]!.cards[0]).toBe('Mientras dormías, Ana venció a El Marchito.');
    expect(e[0]!.credits).toContain('Ana');
    again.connect('Zoe');
    expect(endings(again.drain(), 'Zoe')).toHaveLength(0);
  });

  it('an old ending save (no names) loads and credits "vosotros"', () => {
    const w = newWorld(42, 'salt');
    const sim = setup(w, 'Ana');
    const s = sim.save();
    s.ending = true;
    const again = new WorldSim(s);
    again.connect('Ana');
    const e = endings(again.drain(), 'Ana');
    expect(e[0]!.cards[0]).toContain('vosotros');
  });

  it('la Grieta: before the ending the rim is dragon-only; after, it opens at x 0 only', () => {
    const tryCross = (sim: WorldSim, x: number) => {
      put(sim, 'Ana', x, RIM_LINE + 0.5);
      for (let i = 0; i < 11; i++) sim.step(0.1);
      msgs(sim);
      sim.handle('Ana', { t: 'move', x, y: sim.terrain.heightAt(x, RIM_LINE - 0.5), z: RIM_LINE - 0.5, yaw: 0, anim: 'walk' });
      const ok = sim.getPlayer('Ana')!.z === RIM_LINE - 0.5;
      return { ok, rim: msgs(sim).some((o) => o.msg.t === 'toast' && o.msg.text === STEEP_TEXT.rim) };
    };
    const before = setup(undefined, 'Ana');
    expect(tryCross(before, 0)).toEqual({ ok: false, rim: true });
    const sim = win();
    expect(tryCross(sim, 0).ok).toBe(true);
    expect(tryCross(sim, 20)).toEqual({ ok: false, rim: true });
  });

  it('no invasion after the ending, even if one was owed', () => {
    const sim = win();
    priv(sim).invasion2 = 'pending';
    sim.time = DAY_LENGTH * 0.7;
    for (let i = 0; i < 30; i++) sim.step(0.1);
    expect(priv(sim).marchito).toBeNull();
  });

  it('decodeClient takes the raids toggle (boolean only)', () => {
    expect(decodeClient(JSON.stringify({ t: 'raids', on: true }))).toEqual({ t: 'raids', on: true });
    expect(decodeClient(JSON.stringify({ t: 'raids', on: 'x' }))).toBeNull();
  });
});
