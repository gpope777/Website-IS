import { describe, expect, it } from 'vitest';
import { ackAll, dots, lineAlpha, parseAck, parseTips, TIP_IDS, TIP_MS, TipQueue, TIPS, tipsDue, tipText, type TipView } from './guide-model';
import type { Seen } from './hud-model';
import { parseSettings } from './settings';

const view = (o: Partial<TipView> = {}): TipView => ({ seen: new Set<Seen>(), air: false, night: false, cold: false, raid: false, bog: false, zarzal: false, lowHp: false, powers: [], ...o });

describe('tips', () => {
  it('has ~25 short dry lines for both devices', () => {
    expect(TIP_IDS.length).toBeGreaterThanOrEqual(24);
    for (const id of TIP_IDS)
      for (const t of TIPS[id]) {
        expect(t).not.toContain('!');
        expect(t.length).toBeLessThanOrEqual(70);
      }
  });

  it('a new player only gets "look"; flags bring their tips once', () => {
    expect(tipsDue(view(), new Set())).toEqual(['look']);
    expect(tipsDue(view(), new Set(['look']))).toEqual([]);
    const due = tipsDue(view({ seen: new Set<Seen>(['wolf', 'berries']), night: true }), new Set(['look']));
    expect(due).toEqual(['berries', 'night', 'wolf', 'roll', 'bow']);
    expect(tipsDue(view({ powers: ['vine'] }), new Set(['look']))).toEqual(['vine']);
    expect(tipsDue(view({ powers: ['vine', 'wind'] }), new Set(['look', 'vine']))).toEqual(['power', 'wind']);
  });

  it('device text', () => {
    expect(tipText('wolf', true)).toContain('🛡️');
    expect(tipText('wolf', false)).toContain('Z');
    expect(tipText('power', false)).not.toContain('🌿');
  });

  it('parses the shown set', () => {
    expect([...parseTips('["look","nope"]')]).toEqual(['look']);
    expect(parseTips('{bad').size).toBe(0);
  });

  it('queue: one at a time, 6 s each, no repeats', () => {
    const q = new TipQueue();
    q.push(['look', 'wolf', 'look']);
    expect(q.current(0)).toBe('look');
    expect(q.current(TIP_MS - 1)).toBe('look');
    q.push(['look']);
    expect(q.current(TIP_MS)).toBe('wolf');
    expect(q.current(2 * TIP_MS)).toBeNull();
  });
});

describe('dots', () => {
  const cur = { skillPts: 1, cards: ['Moverse', 'Pelear'], pills: [true, false, true] };
  it('first load: nothing is new', () => {
    expect(dots(cur, ackAll(cur))).toEqual({ menu: false, libro: false, ayuda: false, pills: [false, false, false] });
  });
  it('new points, a new card and a new pill are dotted until acked', () => {
    const ack = ackAll({ skillPts: 0, cards: ['Moverse'], pills: [true, false, false] });
    const d = dots(cur, ack);
    expect(d).toEqual({ menu: true, libro: true, ayuda: true, pills: [false, false, true] });
    const after = dots(cur, { ...ack, pts: 1, cards: [...cur.cards], pills: [true, false, true] });
    expect(after.menu).toBe(false);
    expect(dots({ ...cur, skillPts: 0 }, ack).libro).toBe(false);
  });
  it('parses the ack', () => {
    expect(parseAck(null)).toBeNull();
    expect(parseAck('{bad')).toBeNull();
    expect(parseAck('{"pts":2,"cards":["A",3],"pills":[1,0]}')).toEqual({ pts: 2, cards: ['A'], pills: [true, false] });
  });
});

describe('line and settings', () => {
  it('dims after 8 s', () => {
    expect(lineAlpha(0)).toBe(1);
    expect(lineAlpha(7999)).toBe(1);
    expect(lineAlpha(8000)).toBe(0.4);
  });
  it('guide and tips default on and parse', () => {
    const d = parseSettings(null, true);
    expect(d.guide).toBe(true);
    expect(d.tips).toBe(true);
    const s = parseSettings('{"guide":false,"tips":"x"}', true);
    expect(s.guide).toBe(false);
    expect(s.tips).toBe(true);
  });
});
