import { describe, expect, it } from 'vitest';
import { rankLine, rankUpText } from './rank-ui';

describe('rank ui (P4-A)', () => {
  it('shows Rango and Savia', () => {
    expect(rankLine(300, 3)).toBe('Rango 3 · 300/420 Savia');
    expect(rankLine(0, 1)).toBe('Rango 1 · 0/80 Savia');
    expect(rankLine(1700, 8)).toBe('Rango 8 · 1700 Savia');
  });
  it('the card', () => {
    expect(rankUpText(4)).toBe('Rango 4. Un punto de oficio.');
  });
});
