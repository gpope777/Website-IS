import { describe, expect, it } from 'vitest';
import { helpCards, helpHtml, isMenuTab, MENU_TABS, tabsHtml } from './menu-ui';
import type { Seen } from './hud-model';
import { parseSettings, textScale } from './settings';

const all = new Set<Seen>(['berries', 'wood', 'wolf', 'power', 'mount', 'heart', 'orb', 'dungeon', 'fogata', 'shop', 'marchito']);

describe('Menú tabs (P7-C)', () => {
  it('Jugar, Libro, Ajustes, Ayuda, Salir', () => {
    expect(MENU_TABS.map((t) => t.label)).toEqual(['Jugar', 'Libro', 'Ajustes', 'Ayuda', 'Salir']);
    expect(tabsHtml('ayuda')).toContain('class="tab on" aria-selected="true" data-tab="ayuda"');
    expect(isMenuTab('libro')).toBe(true);
    expect(isMenuTab('viajes')).toBe(false);
  });
});

describe('Ayuda by topic (P7-C)', () => {
  it('a new player only gets Moverse', () => expect(helpCards(new Set(), true).map((c) => c.title)).toEqual(['Moverse']));
  it('a card appears when its thing was met', () => {
    expect(helpCards(new Set<Seen>(['wolf']), true).map((c) => c.title)).toContain('Pelear');
    expect(helpCards(new Set<Seen>(['wolf']), true).map((c) => c.title)).not.toContain('Poderes');
  });
  it('touch shows pills, PC shows keys', () => {
    const t = helpHtml(helpCards(all, true));
    const pc = helpHtml(helpCards(all, false));
    expect(t).toContain('🌀 rueda');
    expect(t).not.toMatch(/\bQ rueda/);
    expect(pc).toContain('Q rueda');
    expect(pc).not.toContain('🌀');
  });
  it('never names a place (no spoilers)', () => {
    const txt = helpHtml(helpCards(all, true)) + helpHtml(helpCards(all, false));
    for (const place of ['Pantano', 'Montaña', 'Costa', 'Tierras', 'Torre', 'Laguna']) expect(txt).not.toContain(place);
  });
  it('quantities read right', () => expect(helpHtml(helpCards(all, true))).toContain('5 madera, 3 piedra'));
});

describe('settings (P7-C)', () => {
  it('defaults and clamps', () => {
    const d = parseSettings(null, true);
    expect([d.text, d.marks, d.sens, d.tab]).toEqual(['normal', true, 1, 'jugar']);
    const s = parseSettings(JSON.stringify({ text: 'huge', marks: false, sens: 9, tab: 'ayuda' }), false);
    expect([s.text, s.marks, s.sens, s.tab]).toEqual(['normal', false, 2, 'ayuda']);
    expect(parseSettings(JSON.stringify({ sens: 0.6 }), false).sens).toBe(0.5);
    expect(textScale('grande')).toBe(1.25);
  });
});
