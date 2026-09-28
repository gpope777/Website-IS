import { describe, expect, it } from 'vitest';
import { bookHtml, type BookData } from './book-ui';

const data = (o: Partial<BookData> = {}): BookData => ({
  xp: 712,
  rank: 5,
  weapon: 4,
  capa: 2,
  shrines: 8,
  chests: 3,
  powers: { enredadera: true, viento: true, fuego: false, piedra: false },
  mounts: { steed: true, star: false, fish: true, frog: false, dragon: false },
  book: { feats: [2, 5], bosses: 4, kills: { wolf: 30, brute: 5, rayo: 1 }, raids: 3, zones: 9, zonesMax: 22, shrinesMax: 12, chestsMax: 6, day: 14 },
  ...o,
});

describe('el Libro (P4-D)', () => {
  it('rank, Savia and a bar', () => {
    const h = bookHtml(data());
    expect(h).toContain('<h2>Libro</h2>');
    expect(h).toContain('Rango 5 · 712 / 980 Savia');
    expect(h).toMatch(/class="bar"><i style="width:\d+%/);
    expect(bookHtml(data({ rank: 8, xp: 1800 }))).toContain('Rango 8 · 1800 Savia');
  });

  it('equipment, powers, mounts', () => {
    const h = bookHtml(data());
    expect(h).toContain('Arma +4 (×1,6) · Capa 2 (−20 %) · Aliento 260');
    expect(h).toContain('<span class="on">🌿 Enredadera</span>');
    expect(h).toContain('<span class="off">🔥 Fuego</span>');
    expect(h).toContain('<span class="on">🦌 el Ciervo</span>');
    expect(h).toContain('<span class="off">🐸 la Rana</span>');
  });

  it('counters', () => {
    const h = bookHtml(data());
    expect(h).toContain('Santuarios 8/12 · Cofres 3/6 · Jefes 4/11 · Zonas limpias 9/22 · Día 14');
    expect(h).toContain('Lobos 30 · Brutos 5 · Rayos 1 · Asedios aguantados 3');
  });

  it('6 Proezas, the done ones sealed; buttons', () => {
    const h = bookHtml(data());
    expect(h.match(/<li class="feat/g)).toHaveLength(6);
    expect(h).toContain('<li class="feat done">Pez veloz</li>');
    expect(h).toContain('<li class="feat">Sin un rasguño</li>');
    for (const a of ['skills', 'look', 'back']) expect(h).toContain(`data-a="${a}"`);
  });
});
