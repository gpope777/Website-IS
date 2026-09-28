import { describe, expect, it } from 'vitest';
import { bagRows, deathCause, discover, heartShown, parseSeen, pillsShown, PILLS, reviveFrac, Toasts, toastText, topLine, vitalLabel, type DiscoverView, type Seen } from './hud-model';

const view = (o: Partial<DiscoverView> = {}): DiscoverView => ({ inv: {}, rank: 1, orbs: 0, power: false, mount: false, heart: false, wolfNear: Infinity, dungeon: false, fogata: false, shop: false, marchito: false, ...o });

describe('discover (P7-C)', () => {
  it('a new player has seen nothing', () => expect(discover(new Set(), view())).toEqual([]));
  it('berries, a wolf close, a Heart', () => {
    expect(discover(new Set(), view({ inv: { berries: 2 } }))).toEqual(['berries']);
    expect(discover(new Set(), view({ wolfNear: 30 }))).toEqual(['wolf']);
    expect(discover(new Set(), view({ wolfNear: 60 }))).toEqual([]);
    expect(discover(new Set<Seen>(['heart']), view({ heart: true }))).toEqual([]);
  });
  it('a veteran sees the basics at once', () => expect(discover(new Set(), view({ rank: 3 }))).toEqual(['berries', 'wood', 'wolf']));
  it('parseSeen drops junk', () => {
    expect([...parseSeen('["wolf","nope"]')]).toEqual(['wolf']);
    expect(parseSeen('{bad').size).toBe(0);
    expect(parseSeen(null).size).toBe(0);
  });
});

describe('pillsShown (P7-C)', () => {
  it('always 10 slots in the fixed order', () => {
    expect(PILLS).toHaveLength(10);
    expect(pillsShown(new Set(), { heart: false, power: false })).toHaveLength(10);
  });
  it('a new player without a Heart: only 🌳', () => {
    expect(pillsShown(new Set(), { heart: false, power: false })).toEqual([false, false, false, true, false, false, false, false, false, false]);
  });
  it('berries → 🫐 in slot 0; a Heart → 🧱 🗡️ and no 🌳', () => {
    const s = pillsShown(new Set<Seen>(['berries']), { heart: true, power: false });
    expect(s[0]).toBe(true);
    expect([s[2], s[3], s[4]]).toEqual([true, false, true]);
  });
  it('a wolf → the four fight pills; a power → 🌿', () => {
    const s = pillsShown(new Set<Seen>(['wolf']), { heart: false, power: true });
    expect(s.slice(5)).toEqual([true, true, true, true, true]);
  });
});

describe('Toasts (P7-C)', () => {
  it('keeps 3, newest first', () => {
    const t = new Toasts();
    for (const [i, s] of ['a', 'b', 'c', 'd'].entries()) t.push(s, i);
    expect(t.tick(5).map((x) => x.text)).toEqual(['d', 'c', 'b']);
  });
  it('groups repeats and shows ×N', () => {
    const t = new Toasts();
    t.push('Madera +1', 0);
    t.push('Otra', 10);
    t.push('Madera +1', 20);
    const l = t.tick(30);
    expect(l[0]).toEqual({ text: 'Madera +1', n: 2 });
    expect(l).toHaveLength(2);
    expect(toastText(l[0]!)).toBe('Madera +1 ×2');
    expect(toastText(l[1]!)).toBe('Otra');
  });
  it('expires at 4 s', () => {
    const t = new Toasts();
    t.push('a', 0);
    expect(t.tick(3999)).toHaveLength(1);
    expect(t.tick(4000)).toHaveLength(0);
  });
});

describe('HUD bits (P7-C)', () => {
  it('topLine: jefe > asedio > carrera', () => {
    expect(topLine('J', 'A', 'C')).toEqual({ text: 'J', kind: 'boss' });
    expect(topLine(null, 'A', 'C')?.kind).toBe('raid');
    expect(topLine(null, null, 'C')?.kind).toBe('race');
    expect(topLine(null, null, null)).toBeNull();
  });
  it('vitalLabel only under 50', () => {
    expect(vitalLabel(80)).toBe('');
    expect(vitalLabel(50)).toBe('');
    expect(vitalLabel(49)).toBe('49');
  });
  it('heartShown: raid or hurt', () => {
    expect(heartShown(null, true)).toBe(false);
    expect(heartShown({ hp: 500, max: 500 }, false)).toBe(false);
    expect(heartShown({ hp: 500, max: 500 }, true)).toBe(true);
    expect(heartShown({ hp: 400, max: 500 }, false)).toBe(true);
  });
  it('bagRows: amber row has no leading "de"', () => {
    expect(bagRows({ amber: 2 }, 0, 0, '').find((r) => r.icon && r.n === '2')!.label.startsWith('de ')).toBe(false);
  });

  it('bagRows: 7 materials with the right word, then Arma, Capa, Rango', () => {
    const r = bagRows({ pearl: 1, berries: 3 }, 2, 1, 'Rango 3');
    expect(r).toHaveLength(10);
    expect(r.find((x) => x.icon === '⚪')).toEqual({ icon: '⚪', label: 'perla', n: '1' });
    expect(r.find((x) => x.icon === '🫐')?.label).toBe('bayas');
    expect(r[7]).toEqual({ icon: '🗡️', label: 'Arma', n: '+2' });
    expect(r[9]?.label).toBe('Rango 3');
  });
  it('deathCause guesses', () => {
    expect(deathCause({ lastHurtAgo: 1, warmth: 0, hunger: 0 })).toBe('Te atacaron.');
    expect(deathCause({ lastHurtAgo: 9, warmth: 0, hunger: 50 })).toBe('El frío.');
    expect(deathCause({ lastHurtAgo: 9, warmth: 20, hunger: 0 })).toBe('El hambre.');
    expect(deathCause({ lastHurtAgo: 9, warmth: 20, hunger: 20 })).toBe('El terreno.');
  });
  it('reviveFrac clamps', () => {
    expect(reviveFrac(15)).toBe(0.5);
    expect(reviveFrac(-1)).toBe(0);
    expect(reviveFrac(40)).toBe(1);
  });
});
