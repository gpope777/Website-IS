import { describe, expect, it } from 'vitest';
import { BOW } from './combat';
import { weaponMult } from '../items';
import { FUEGO } from '../fuego';
import { breakBrote, broteOpen, castOnBrote, burnRoots, createFinal, FINAL, finalFactor, finalMult, hitCore, hitFinal, plateSpot, staggerFinal, startPull, stepFinal, type FinalBoss } from './marchito-final';
import { createRng } from '../rng';

const tgt = (name: string, x: number, z: number) => ({ name, x, z, dead: false, fires: false });
const run = (b: FinalBoss, secs: number, ts = [] as ReturnType<typeof tgt>[], pillars = [] as { id: number; x: number; z: number }[]) => {
  const hits = [];
  const events = [];
  for (let t = 0; t < secs - 1e-9; t += 0.1) {
    const o = stepFinal(b, ts, pillars, 0.1, () => 0.5);
    hits.push(...o.hits);
    events.push(...o.events);
  }
  return { hits, events };
};
const toPhase2 = (b: FinalBoss) => {
  b.bare = 5;
  hitFinal(b, b.max);
};
const toPhase3 = (b: FinalBoss) => {
  toPhase2(b);
  for (let i = 0; i < 4; i++) breakBrote(b, i);
};

describe('El Marchito final — setup', () => {
  it('has 1200 PV alone and ×(1 + 0.35 per extra player)', () => {
    expect(createFinal(1).max).toBe(1200);
    expect(createFinal(2).max).toBe(1620);
    expect(createFinal(4).max).toBe(2460);
    expect(finalFactor(0)).toBe(1);
    const b = createFinal(1);
    expect(b.kind).toBe('boss5');
    expect(b.id).toBe(900_009);
    expect(b.phase).toBe(1);
  });
});

describe('phase 1 — roots', () => {
  it('rooted he takes ×0.1; a close Llamarada burns them off after 2 s for 8 s; then green 24 s', () => {
    const b = createFinal(1);
    expect(finalMult(b)).toBeCloseTo(FINAL.rootMult);
    expect(burnRoots(b, b.x + 20, b.z)).toBe('far');
    expect(burnRoots(b, b.x + FINAL.body + 4, b.z)).toBe('catch');
    run(b, 2.05);
    expect(finalMult(b)).toBe(1);
    run(b, 8);
    expect(finalMult(b)).toBeCloseTo(FINAL.rootMult);
    expect(burnRoots(b, b.x + 3, b.z)).toBe('green');
    run(b, FINAL.greenFor + 0.1);
    expect(burnRoots(b, b.x + 3, b.z)).toBe('catch');
  });
  it('a parried swipe staggers him: full damage 3 s', () => {
    const b = createFinal(1);
    staggerFinal(b);
    expect(finalMult(b)).toBe(1);
    run(b, 3.1);
    expect(finalMult(b)).toBeCloseTo(FINAL.rootMult);
  });
  it('swipes (18) after a 1 s tell at whoever is within 5 m', () => {
    const b = createFinal(1);
    const { hits, events } = run(b, FINAL.swipeFirst + FINAL.swipeTell + 0.2, [tgt('Ana', b.x, b.z - 3)]);
    expect(events).toContain('swipe');
    expect(hits.filter((h) => h.kind === 'swipe')).toEqual([{ name: 'Ana', dmg: 18, kind: 'swipe' }]);
    const far = createFinal(1);
    expect(run(far, 6, [tgt('Leo', far.x, far.z - 8)]).hits.filter((h) => h.kind === 'swipe')).toEqual([]);
  });
  it('root lines: one on each fighter, 1.2 s later 15 to whoever is still on one', () => {
    const b = createFinal(1);
    const ts = [tgt('Ana', b.x, b.z - 10)];
    run(b, FINAL.linesFirst + 0.05, ts);
    expect(b.lines).toHaveLength(3);
    const { hits } = run(b, FINAL.linesTell + 0.1, ts);
    expect(hits.filter((h) => h.kind === 'line')).toEqual([{ name: 'Ana', dmg: 15, kind: 'line' }]);
  });
  it('at 60 % he sinks: phase 2, four brotes, no damage taken', () => {
    const b = createFinal(1);
    b.bare = 5;
    expect(hitFinal(b, 300)).toBeNull();
    expect(hitFinal(b, 300)).toBe('phase2');
    expect(b.hp).toBe(720);
    expect(b.brotes.map((x) => x.power)).toEqual(['vine', 'wind', 'fire', 'stone']);
    expect(b.brotes.map((x) => x.id)).toEqual([900_011, 900_012, 900_013, 900_014]);
    expect(finalMult(b)).toBe(0);
  });
  it('balance: standing next to him loses 100 PV in 30–45 s', () => {
    const b = createFinal(1);
    const ts = [tgt('Ana', b.x, b.z - 3)];
    const { hits } = run(b, 30, ts);
    const at30 = hits.reduce((s, h) => s + h.dmg, 0);
    expect(at30).toBeLessThan(100);
    const more = run(b, 15, ts).hits.reduce((s, h) => s + h.dmg, 0);
    expect(at30 + more).toBeGreaterThanOrEqual(100 - 1e-6);
  });
});

describe('phase 2 — brotes', () => {
  it('each brote opens with its power; pulling 1.5 s costs him 8.75 %; the fourth is phase 3', () => {
    const b = createFinal(1);
    toPhase2(b);
    const [vine, wind, fire, stone] = b.brotes;
    expect(broteOpen(vine!, false)).toBe(false);
    expect(castOnBrote(vine!, 'wind')).toBeNull();
    expect(castOnBrote(vine!, 'vine')).toBe(1);
    expect(broteOpen(vine!, false)).toBe(false);
    expect(castOnBrote(vine!, 'vine')).toBe(2);
    expect(broteOpen(vine!, false)).toBe(true);
    castOnBrote(wind!, 'wind');
    castOnBrote(wind!, 'wind');
    expect(broteOpen(wind!, false)).toBe(false);
    castOnBrote(wind!, 'wind');
    expect(broteOpen(wind!, false)).toBe(true);
    castOnBrote(fire!, 'fire');
    castOnBrote(fire!, 'fire');
    expect(broteOpen(fire!, false)).toBe(false);
    castOnBrote(fire!, 'fire');
    expect(broteOpen(fire!, false)).toBe(true);
    expect(broteOpen(stone!, false)).toBe(false);
    expect(broteOpen(stone!, true)).toBe(true);
    startPull(b, 0, 'Ana');
    const ana = [tgt('Ana', vine!.x + 1, vine!.z)];
    run(b, 1, ana);
    expect(vine!.broken).toBe(false);
    const { events } = run(b, 0.6, ana);
    expect(events).toContain('pulled');
    expect(b.hp).toBeCloseTo(1200 * (0.25 + 0.0875 * 3));
    startPull(b, 1, 'Ana');
    run(b, 1, [tgt('Ana', wind!.x + 10, wind!.z)]);
    expect(b.pull).toBeNull();
    breakBrote(b, 1);
    breakBrote(b, 2);
    expect(breakBrote(b, 3)).toBe('phase3');
    expect(b.hp).toBeCloseTo(300);
    expect(b.core?.max).toBe(300);
    expect(plateSpot().x).toBeCloseTo(b.x + 9.2);
  });
  it('work on a brote comes undone if left too long (the cocoon stays burnt)', () => {
    const b = createFinal(1);
    toPhase2(b);
    const [vine, wind, fire] = b.brotes;
    castOnBrote(vine!, 'vine');
    castOnBrote(wind!, 'wind');
    for (let i = 0; i < 3; i++) castOnBrote(fire!, 'fire');
    run(b, FINAL.hold.wind + 0.2);
    expect(broteOpen(wind!, false)).toBe(false);
    expect(vine!.steps).toBe(1);
    run(b, FINAL.hold.vine - FINAL.hold.wind);
    expect(vine!.steps).toBe(0);
    expect(broteOpen(fire!, false)).toBe(true);
  });
});

describe('phase 3 — el Corazón Negro', () => {
  it('runs from you at 7 m/s and stays in the Copa; leaves a trail that burns 4 PV/s', () => {
    const b = createFinal(1);
    toPhase3(b);
    const c = b.core!;
    const x0 = c.x;
    const z0 = c.z;
    run(b, 1, [tgt('Ana', c.x, c.z - 2)]);
    expect(Math.hypot(c.x - x0, c.z - z0)).toBeGreaterThan(5);
    expect(Math.hypot(c.x - x0, c.z - z0)).toBeLessThanOrEqual(7.1);
    run(b, 5, [tgt('Ana', b.x, b.z - 2)]);
    expect(Math.hypot(c.x - b.x, c.z - b.z)).toBeLessThanOrEqual(FINAL.coreRoom + 1e-6);
    const onTrail = b.trail[b.trail.length - 1]!;
    const { hits } = run(b, 1, [tgt('Leo', onTrail.x, onTrail.z)]);
    expect(hits.filter((h) => h.kind === 'trail').reduce((s, h) => s + h.dmg, 0)).toBeCloseTo(4, 0);
  });
  it('a pillar in its path stops it 3 s (each pillar once); running it takes ×0.1, stopped full and arrows ×1.5', () => {
    const b = createFinal(1);
    toPhase3(b);
    const c = b.core!;
    hitCore(b, 100, false);
    expect(c.hp).toBeCloseTo(300 - 10);
    run(b, 0.1, [tgt('Ana', c.x, c.z - 30)], [{ id: 1, x: c.x, z: c.z + 1 }]);
    expect(c.stun).toBeGreaterThan(2.5);
    hitCore(b, 100, true);
    expect(c.hp).toBeCloseTo(300 - 10 - 150);
    expect(b.hp).toBeCloseTo(300 * (c.hp / 300));
    run(b, 3.2, [tgt('Ana', c.x, c.z - 30)], [{ id: 1, x: c.x, z: c.z + 1 }]);
    expect(c.stun).toBe(0);
  });
  it('every 10 s it runs back to him and heals 5 %/s until hit', () => {
    const b = createFinal(1);
    toPhase3(b);
    const c = b.core!;
    c.hp = 150;
    const { events } = run(b, 14, [tgt('Ana', b.x + 18, b.z)]);
    expect(events).toContain('healing');
    expect(c.hp).toBeGreaterThan(150);
    const was = c.hp;
    hitCore(b, 10, false);
    expect(c.mode).toBe('run');
    expect(c.hp).toBeCloseTo(was - 1);
  });
  it('at 0 the fight is won', () => {
    const b = createFinal(1);
    toPhase3(b);
    b.core!.stun = 3;
    expect(hitCore(b, 299, false)).toBe(false);
    expect(hitCore(b, 5, false)).toBe(true);
    expect(b.hp).toBe(0);
  });
});

/**
 * Solo kill time with a scripted player (weapon 5, never dies, a kid's pace):
 * - melee (35) lands once every 3 s while in reach and free; an arrow (26) every 2 s in range, 40 % on the running core;
 * - rolls out of every swipe and root line (1.5 s without attacking);
 * - walks 4.5 m/s, needs 3 s at each brote to see what it wants; a rayo costs 6 s every 14 s in phase 2 (and ruins a pull);
 * - powers on their real cooldowns: Llamarada 5 s, Enredadera 12 s, Viento 6 s, Piedra 3 s;
 * - phase 3: a Llamarada whenever the core is within 6 m (a blow: scratches, stops a heal); waits by the body, drops a pillar on the core's way home (right one time in three), reacts to a heal in 2 s.
 * Budget (Decidido por Claude): phase 1 ~2.3 min, phase 2 ~1.5 min, phase 3 ~2.8 min → ~6.7 min (6–10 accepted).
 */
function soloKillTime(seed = 7): { total: number; phases: number[] } {
  const S = { melee: 20 * weaponMult(5), meleeEvery: 3, arrow: BOW.damage * weaponMult(5), arrowEvery: 2, runHit: 0.4, walk: 4.5, rayoEvery: 14, rayoCost: 6, dodge: 1.5, think: 3, react: 2, reach: 3, range: BOW.range };
  const rng = createRng(seed);
  const b = createFinal(1);
  const dt = 0.1;
  let t = 0;
  const me = { x: b.x, z: b.z - 2.8 };
  let busyUntil = 0;
  let meleeAt = 0;
  let arrowAt = 0;
  let flameAt = 0;
  let vineAt = -99;
  let gustAt = -99;
  let stoneAt = 0;
  let pillarId = 0;
  const pillars: { id: number; x: number; z: number }[] = [];
  const phases: number[] = [];
  let phaseStart = 0;
  let target = 0;
  let rayoAt = 0;
  let plate = false;
  let tries = 0;
  let healSeen = 0;
  while (b.hp > 0 && t < 1200) {
    const o = stepFinal(b, [tgt('Ana', me.x, me.z)], pillars, dt, rng);
    if (o.events.includes('swipe') || o.events.includes('lines')) busyUntil = t + S.dodge;
    if (o.events.includes('phase3')) {
      phases.push(t - phaseStart);
      phaseStart = t;
      me.x = b.x;
      me.z = b.z - 6;
    }
    if (b.phase === 1) {
      if (t >= flameAt && burnRoots(b, me.x, me.z) === 'catch') flameAt = t + 5;
      if (t >= busyUntil && t >= meleeAt) {
        meleeAt = t + S.meleeEvery;
        if (hitFinal(b, S.melee * finalMult(b)) === 'phase2') {
          phases.push(t - phaseStart);
          phaseStart = t;
          rayoAt = t + S.rayoEvery;
        }
      }
    } else if (b.phase === 2) {
      if (t >= rayoAt) {
        rayoAt = t + S.rayoEvery;
        busyUntil = t + S.rayoCost;
        b.pull = null;
      }
      const br = b.brotes[target]!;
      const d = Math.hypot(br.x - me.x, br.z - me.z);
      if (t < busyUntil) {
        // dealing with the rayo
      } else if (d > 2.05) {
        const s = Math.min(d - 2, S.walk * dt);
        me.x += ((br.x - me.x) / d) * s;
        me.z += ((br.z - me.z) / d) * s;
        if (Math.hypot(br.x - me.x, br.z - me.z) <= 2.05) busyUntil = t + S.think; // what does this one want?
      } else if (!b.pull) {
        if (br.power === 'vine' && !broteOpen(br, plate) && t >= vineAt) {
          vineAt = t + 12;
          castOnBrote(br, 'vine');
        }
        if (br.power === 'wind' && !broteOpen(br, plate) && t >= gustAt) {
          gustAt = t + 6;
          castOnBrote(br, 'wind');
        }
        if (br.power === 'fire' && !broteOpen(br, plate) && t >= flameAt) {
          flameAt = t + 5;
          castOnBrote(br, 'fire');
        }
        if (br.power === 'stone' && !plate && t >= stoneAt) {
          stoneAt = t + 3;
          plate = true;
        }
        if (broteOpen(br, plate)) startPull(b, target, 'Ana');
      }
      if (br.broken) target++;
    } else {
      const c = b.core!;
      const d = Math.hypot(c.x - me.x, c.z - me.z);
      const exposed = c.stun > 0;
      if (c.mode !== 'heal') healSeen = t;
      if (c.mode === 'back' && t >= stoneAt) {
        // A pillar on its way home, 3 m short of his body; a kid gets it right one return in three (the pillar snaps to a 2 m grid, 4 m ahead).
        stoneAt = t + 3;
        if (++tries % 3 === 0) {
          const dx = c.x - b.x;
          const dz = c.z - b.z;
          const r = Math.hypot(dx, dz) || 1;
          pillars.push({ id: ++pillarId, x: b.x + (dx / r) * (FINAL.body + 1.5), z: b.z + (dz / r) * (FINAL.body + 1.5) });
          if (pillars.length > 3) pillars.shift();
        }
      }
      if (exposed && d > S.reach) {
        const s = Math.min(d - S.reach + 0.5, S.walk * dt);
        me.x += ((c.x - me.x) / d) * s;
        me.z += ((c.z - me.z) / d) * s;
      }
      if (d <= FUEGO.range && t >= flameAt) {
        // The Llamarada on the core counts as a blow (scratch; stops a heal).
        flameAt = t + FUEGO.cooldown;
        hitCore(b, FUEGO.damage, false);
      }
      if (exposed && d <= S.reach && t >= meleeAt) {
        meleeAt = t + S.meleeEvery;
        hitCore(b, S.melee, false);
      } else if (d <= S.range && t >= arrowAt) {
        arrowAt = t + S.arrowEvery;
        if (exposed || (c.mode === 'heal' && t >= healSeen + S.react) || (c.mode === 'run' && rng() < S.runHit)) hitCore(b, S.arrow, true);
      }
    }
    t += dt;
  }
  phases.push(t - phaseStart);
  return { total: t, phases };
}

describe('balance — solo kill time', () => {
  it('a scripted solo player (weapon 5) takes between 6 and 10 min (~6.7)', () => {
    for (const seed of [1, 7, 42]) {
      const { total, phases } = soloKillTime(seed);
      expect(phases).toHaveLength(3);
      expect(total).toBeGreaterThan(6 * 60);
      expect(total).toBeLessThan(10 * 60);
    }
  });
});
