import { describe, expect, it } from 'vitest';
import { clipDistance, CLIP } from './camera-clip';
import { HpBars, hurtReaction, IMPACT, lowHealth, reactTo, Shake, SHAKE_SCALE } from './impact';
import { defaultSettings, parseSettings } from './settings';

describe('reactTo', () => {
  it('my hit: flash, short freeze, small push, buzz, bar', () => {
    expect(reactTo({ id: 1, dmg: 20, kind: 'hit', by: 'Ana', hp: 0.5 }, 'Ana', 'wolf')).toEqual({ flash: true, freeze: 0.06, shake: 0.05, vibrate: 15, knock: true, bar: true });
  });
  it('my kill and my parry: the long freeze', () => {
    const k = reactTo({ id: 1, dmg: 20, kind: 'kill', by: 'Ana', hp: 0 }, 'Ana', 'wolf');
    expect(k).toMatchObject({ freeze: IMPACT.freezeBig, knock: true, shake: 0.12, vibrate: 30 });
    const p = reactTo({ id: 1, dmg: 0, kind: 'parry', by: 'Ana' }, 'Ana', 'wolf');
    expect(p).toMatchObject({ flash: false, freeze: IMPACT.freezeBig, shake: 0.15, vibrate: 40, bar: false });
  });
  it("a friend's hit only flashes", () => {
    expect(reactTo({ id: 1, dmg: 20, kind: 'hit', by: 'Bea', hp: 0.5 }, 'Ana', 'wolf')).toEqual({ flash: true, freeze: 0, shake: 0, vibrate: 0, knock: false, bar: true });
  });
  it('bosses keep their top bar', () => {
    expect(reactTo({ id: 1, dmg: 20, kind: 'hit', by: 'Ana', hp: 0.5 }, 'Ana', 'boss').bar).toBe(false);
    expect(reactTo({ id: 1, dmg: 20, kind: 'hit', by: 'Ana', hp: 0.5 }, 'Ana', undefined).bar).toBe(false);
  });
});

describe('hurt, low health', () => {
  it('grows with damage; shake capped', () => {
    expect(hurtReaction(0)).toEqual({ edge: 0, shake: 0, vibrate: 0 });
    expect(hurtReaction(5).edge).toBeLessThan(hurtReaction(20).edge);
    expect(hurtReaction(500)).toEqual({ edge: 0.8, shake: 0.2, vibrate: 25 });
  });
  it('under 25 %, alive', () => {
    expect(lowHealth(20)).toBe(true);
    expect(lowHealth(30)).toBe(false);
    expect(lowHealth(0)).toBe(false);
  });
});

describe('Shake', () => {
  it('decays under 5 % in 0.6 s; zero stays zero', () => {
    const s = new Shake();
    expect(s.step(0.016)).toEqual({ x: 0, y: 0 });
    s.add(0.1);
    for (let i = 0; i < 36; i++) s.step(1 / 60);
    expect(s.level).toBeLessThan(0.005);
    expect(SHAKE_SCALE).toEqual({ normal: 1, suave: 0.4, nada: 0 });
  });
});

describe('HpBars', () => {
  it('3 s each, at most 4, dead ones hide', () => {
    const b = new HpBars();
    for (let i = 1; i <= 5; i++) b.hit(i, 0.5, 0);
    expect(b.visible(1).map((v) => v.id)).toEqual([2, 3, 4, 5]);
    b.hit(3, 0, 1);
    expect(b.visible(1).map((v) => v.id)).toEqual([2, 4, 5]);
    b.hit(2, 0.2, 2);
    expect(b.visible(3.5)).toEqual([{ id: 2, hp: 0.2 }]);
    expect(b.visible(5.1)).toEqual([]);
  });
});

describe('settings', () => {
  it('defaults by device, bad values fall back', () => {
    expect(defaultSettings(true).shake).toBe('suave');
    expect(defaultSettings(false).shake).toBe('normal');
    expect(parseSettings('{nope', true)).toEqual(defaultSettings(true));
    expect(parseSettings('{"shake":"mucho","vibrate":"x"}', false)).toEqual(defaultSettings(false));
    expect(parseSettings('{"shake":"nada","vibrate":false}', true)).toMatchObject({ shake: 'nada', vibrate: false });
    expect(parseSettings(null, false)).toEqual(defaultSettings(false));
  });
});

describe('clipDistance', () => {
  const flat = () => 0;
  const eye = { x: 0, y: 1.6, z: 0 };
  const back = { x: 0, y: 0, z: 1 };
  it('open field: the wanted distance', () => {
    expect(clipDistance(eye, back, 4.5, [], flat)).toBe(4.5);
  });
  it('a rock halfway: stops in front of it', () => {
    const d = clipDistance(eye, back, 4.5, [{ x: 0, z: 3, r: 1 }], flat);
    expect(d).toBeCloseTo(3 - 1 - CLIP.pad * 2, 5);
  });
  it('never closer than the minimum; ignores a circle the player is in', () => {
    expect(clipDistance(eye, back, 4.5, [{ x: 0, z: 1, r: 0.5 }], flat)).toBe(CLIP.min);
    expect(clipDistance(eye, back, 4.5, [{ x: 0, z: 0, r: 2 }], flat)).toBe(4.5);
  });
  it('a hill between shortens it', () => {
    const hill = (_x: number, z: number) => (z > 2 && z < 3.5 ? 3 : 0);
    expect(clipDistance(eye, back, 4.5, [], hill)).toBeLessThan(2.5);
  });
});
