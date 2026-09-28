import { describe, expect, it } from 'vitest';
import { helpHtml } from './menu-ui';
import { TAUGHT_TIPS, tutHud, type TutHudView } from './tutorial-ui';
import { TIP_IDS } from './guide-model';

const base: TutHudView = { tut: { step: 1 }, touch: true, heart: false, inv: {}, me: { x: 0, z: 0 }, players: [] };

describe('tutHud', () => {
  it('a line, a glowing control and the pills per step', () => {
    const s1 = tutHud(base);
    expect(s1.line).toMatch(/^1\/8 · /);
    expect(s1.hint).toEqual(['stick']);
    expect(s1.pills!.filter(Boolean).length).toBe(0);
    expect(tutHud({ ...base, tut: { step: 2 } }).hint).toEqual(['act']);
    expect(tutHud({ ...base, tut: { step: 2 }, inv: { berries: 2 } }).hint).toEqual(['eat']);
    expect(tutHud({ ...base, tut: { step: 4 } }).hint).toEqual(['campfire']);
    expect(tutHud({ ...base, tut: { step: 5 } }).hint).toEqual(['heart']);
    expect(tutHud({ ...base, tut: { step: 5 }, heart: true }).hint).toEqual([]);
    expect(tutHud({ ...base, tut: { step: 6 } }).hint).toEqual(['roll', 'block']);
    expect(tutHud({ ...base, tut: { step: 7 } }).hint).toEqual(['lock', 'bow']);
    expect(tutHud({ ...base, tut: { step: 8 } }).line).toContain('santuario');
    expect(tutHud({ ...base, tut: { step: 8 } }).arrow).toBe(true);
    expect(s1.arrow).toBe(false);
    expect(tutHud({ ...base, tut: null }).arrow).toBe(true);
  });
  it('PC: no glow, keys in the line', () => {
    const pc = tutHud({ ...base, touch: false, tut: { step: 6 } });
    expect(pc.hint).toEqual([]);
    expect(pc.line).toContain('Q esquiva');
  });
  it('waiting: the line says so and nothing glows', () => {
    const w = tutHud({ ...base, tut: { step: 3, wait: true } });
    expect(w.line).toBe('3/8 · Primero, aguanta.');
    expect(w.hint).toEqual([]);
  });
  it('not learning: the normal pills, no line', () => {
    const n = tutHud({ ...base, tut: null });
    expect(n.line).toBeNull();
    expect(n.pills).toBeNull();
  });
  it('co-op notes within 30 m only', () => {
    const players = [{ name: 'Bea', x: 10, z: 0 }, { name: 'Leo', x: 5, z: 0, tut: 4 }, { name: 'Far', x: 100, z: 0 }];
    expect(tutHud({ ...base, players }).note).toBe('(Bea puede ayudarte)');
    expect(tutHud({ ...base, tut: null, players }).note).toBe('Leo está aprendiendo (4/8)');
    expect(tutHud({ ...base, players: [{ name: 'Far', x: 100, z: 0 }] }).note).toBeNull();
    expect(tutHud({ ...base, players: [{ name: 'Bea', x: 1, z: 0, away: true }] }).note).toBeNull();
  });
  it('taught tips are real tip ids', () => {
    for (const t of TAUGHT_TIPS) expect(TIP_IDS).toContain(t);
  });
});

describe('Ayuda › Repetir tutorial', () => {
  it('the button is there when asked for', () => {
    expect(helpHtml([], true)).toContain('data-a="tut-repeat"');
    expect(helpHtml([], true)).toContain('Repetir tutorial');
    expect(helpHtml([])).not.toContain('tut-repeat');
  });
});
