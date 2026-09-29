import { describe, expect, it } from 'vitest';
import type { ServerMsg } from '../protocol';
import { PROTOCOL_VERSION } from '../protocol';
import { PROGRESS } from '../progression';
import { DAY_LENGTH, newWorld, WorldSim, type SavedWorld } from './world-sim';
import type { Wolf } from './wolves';

type Priv = { structures: unknown[]; wolves: Wolf[]; strike(name: string, w: Wolf, dmg: number): void; breakPillar(id: number): void; pillarSpots: { cores: { x: number; z: number }[] } };
const priv = (s: WorldSim) => s as unknown as Priv;

function setup(mod?: (w: SavedWorld) => void) {
  const w = newWorld(42, 'salt');
  mod?.(w);
  const sim = new WorldSim(w);
  if (!sim.getPlayer('Ana')) sim.createPlayer('Ana', 'hash');
  sim.connect('Ana');
  sim.time = DAY_LENGTH * 0.4;
  sim.drain();
  return sim;
}
const self = (sim: WorldSim) => (sim.snapshotFor('Ana') as Extract<ServerMsg, { t: 'snap' }>).self;
const wolf = (id: number, kind: Wolf['kind'] = 'wolf') => ({ id, x: 4, y: 0, z: 0, yaw: 0, hp: 5, target: null, cooldown: 0, deadFor: 0, wander: 0, anim: 'idle', raid: false, kind, stun: 0 }) as Wolf;
function kill(sim: WorldSim, id: number, kind: Wolf['kind'] = 'wolf') {
  const w = wolf(id, kind);
  priv(sim).wolves.push(w);
  priv(sim).strike('Ana', w, 999);
}

describe('Savia y Rango (P4-A)', () => {
  it('is protocol 66', () => expect(PROTOCOL_VERSION).toBe(66));

  it('a fresh player is Rango 1 with no Savia', () => {
    const s = self(setup());
    expect(s.rank).toBe(1);
    expect(s.xp).toBe(0);
  });

  it('an old save gets its Rango from what it already did, with no rank-up on connect', () => {
    const sim = setup((w) => {
      w.players.push({ name: 'Ana', pinHash: 'hash', x: 0, y: 0, z: 0, yaw: 0, vitals: { health: 100, hunger: 100, warmth: 100 }, inv: {}, dead: false, shrines: [0, 1, 2], enredadera: true });
    });
    expect(self(sim).xp).toBe(200);
    expect(self(sim).rank).toBe(2);
    sim.step(0.1);
    expect(sim.drain().some((o) => o.msg.t === 'rankUp')).toBe(false);
  });

  it('kills give a little, saved, with a daily cap', () => {
    const sim = setup();
    kill(sim, 7001);
    kill(sim, 7002, 'brute');
    expect(sim.getPlayer('Ana')!.xp).toBe(4);
    for (let i = 0; i < 60; i++) kill(sim, 7100 + i);
    expect(sim.getPlayer('Ana')!.xp).toBe(PROGRESS.killCap);
    expect(self(sim).xp).toBe(PROGRESS.killCap);
  });

  it('a broken pillar gives 40 to those near', () => {
    const sim = setup();
    const c = priv(sim).pillarSpots.cores[1]!;
    Object.assign(sim.getPlayer('Ana')!, { x: c.x + 5, z: c.z });
    priv(sim).breakPillar(1);
    expect(sim.getPlayer('Ana')!.xp ?? 0).toBeGreaterThanOrEqual(PROGRESS.pillar);
  });

  it('crossing a threshold tells you and flashes for everyone, once', () => {
    const sim = setup();
    sim.getPlayer('Ana')!.xp = 79;
    sim.step(0.1);
    expect(sim.drain().some((o) => o.msg.t === 'rankUp')).toBe(false);
    kill(sim, 7201);
    sim.step(0.1);
    const out = sim.drain();
    const up = out.filter((o) => o.msg.t === 'rankUp');
    expect(up).toHaveLength(1);
    expect(up[0]!.to).toBeNull();
    expect(up[0]!.msg).toEqual({ t: 'rankUp', name: 'Ana', rank: 2 });
    sim.step(0.1);
    expect(sim.drain().some((o) => o.msg.t === 'rankUp')).toBe(false);
  });
});
