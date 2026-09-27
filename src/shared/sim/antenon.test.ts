import { describe, expect, it } from 'vitest';
import { COAST_DUNGEON as C } from '../coast-dungeon';
import { ANTENON, ANTENON_ALLY, createAntenon, createGustAlly, pushAntenon, stepAntenon, stepGustAlly } from './antenon';
import type { WolfTarget } from './wolves';

const at = (name: string, x: number, z: number): WolfTarget => ({ name, x, z, dead: false, fires: false });
const run = (a: ReturnType<typeof createAntenon>, ts: WolfTarget[], secs: number) => {
  const out: { name: string; dmg: number }[] = [];
  for (let t = 0; t < secs; t += 0.05) out.push(...stepAntenon(a, ts, 0.05));
  return out;
};

describe('El Antenón', () => {
  it('slams into a pillar when a gust pushes it there', () => {
    const a = createAntenon();
    const p = C.pillars[0]!;
    a.x = C.x + p.x;
    a.z = p.z - 3;
    expect(pushAntenon(a, { x: 0, z: 1 }, 2)).toBe(true);
    expect(Math.hypot(a.x - (C.x + p.x), a.z - p.z)).toBeGreaterThanOrEqual(C.pillarR + ANTENON.body - 1e-6);
  });

  it('just moves over open floor', () => {
    const a = createAntenon();
    a.x = C.x;
    a.z = 166;
    expect(pushAntenon(a, { x: 0, z: 1 }, 2)).toBe(false);
    expect(a.z).toBeCloseTo(168);
  });

  it('sweeps everyone within 4 m after a 0.8 s wind-up', () => {
    const a = createAntenon();
    a.x = C.x;
    a.z = 166;
    a.sweepReady = 0;
    const near = at('Ana', C.x + 2, 166);
    const far = at('Leo', C.x - 6, 166);
    expect(run(a, [near, far], 0.7)).toEqual([]);
    expect(a.move).toBe('sweep');
    expect(run(a, [near, far], 0.2)).toEqual([{ name: 'Ana', dmg: ANTENON.sweepDamage }]);
  });

  it('charges from mid range and hits once', () => {
    const a = createAntenon();
    a.x = C.x;
    a.z = 157;
    a.chargeReady = 0;
    const t = at('Ana', C.x, 166);
    run(a, [t], 0.1);
    expect(a.move).toBe('charge');
    const hits = run(a, [t], 1.8);
    expect(hits).toEqual([{ name: 'Ana', dmg: ANTENON.chargeDamage }]);
  });

  it('does nothing while stunned and stays in its room', () => {
    const a = createAntenon();
    a.stun = 1;
    expect(run(a, [at('Ana', a.x + 1, a.z)], 0.9)).toEqual([]);
    const b = createAntenon();
    run(b, [at('Ana', C.x, C.bossRoomZ - 20)], 10);
    expect(b.z).toBeGreaterThanOrEqual(C.bossRoomZ + ANTENON.body - 1e-6);
  });

  it('a player standing next to it lasts 30 s (Cierre balance)', () => {
    const a = createAntenon();
    a.x = C.x;
    a.z = 166;
    const dmg = run(a, [at('Ana', C.x + 2, 166)], 30).reduce((s, h) => s + h.dmg, 0);
    expect(dmg).toBeLessThan(100);
  });
});

describe('the white Antenón', () => {
  const flat = () => 10;
  const raider = (id: number, x: number, z: number) => ({ id, x, y: 10, z, yaw: 0, hp: 60, target: null, cooldown: 0, deadFor: 0, wander: 0, anim: 'idle' as const, raid: true, kind: 'wolf' as const, stun: 0 });
  const heart = { x: 0, z: 0 };

  it('gusts raiders within 12 m of the Heart 6 m away, every 8 s', () => {
    const a = createGustAlly(heart, flat);
    const near = raider(1, 5, 0);
    const far = raider(2, 0, 15);
    expect(stepGustAlly(a, heart, [near, far], flat, 0.1)).toBe(1);
    expect(near.x).toBeCloseTo(11);
    expect(near.stun).toBe(ANTENON_ALLY.stun);
    expect(far.z).toBe(15);
    const again = raider(3, 3, 0);
    expect(stepGustAlly(a, heart, [again], flat, 7)).toBe(0);
    expect(stepGustAlly(a, heart, [again], flat, 1.1)).toBe(1);
  });
});
