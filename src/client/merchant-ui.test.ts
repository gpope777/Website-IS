import { describe, expect, it } from 'vitest';
import { MERCHANT, RARE } from '../shared/shop';
import { merchantAction, merchantHtml } from './merchant-ui';

describe('Buhonero panel (T6-D)', () => {
  it('merchantAction: within 4 m', () => {
    expect(merchantAction({ x: 3, z: 0 }, { x: 0, z: 0 })).toBe(true);
    expect(merchantAction({ x: 5, z: 0 }, { x: 0, z: 0 })).toBe(false);
    expect(merchantAction({ x: 0, z: 0 }, null)).toBe(false);
  });

  it('one row per trato, greyed when short or none left', () => {
    const h = merchantHtml({ wood: 5 }, 20);
    expect(h).toContain('Buhonero');
    expect(h).toContain('Te quedan 20 tratos hoy.');
    expect(h).toContain('5 madera → 1 bayas');
    expect(h).toContain('6 bayas → 5 piedra');
    expect(h).toContain('data-a="deal-0">');
    expect(h).toContain('data-a="deal-6" disabled');
    expect(merchantHtml({ wood: 5 }, 0)).toContain('data-a="deal-0" disabled');
    expect(merchantHtml({}, 0)).toContain('Por hoy ya está.');
    for (let i = 0; i < MERCHANT.deals.length; i++) expect(h).toContain(`data-a="deal-${i}"`);
    for (const k of RARE) expect(MERCHANT.deals.some((d) => d.get === k)).toBe(false);
    expect(h).toContain('data-a="back"');
  });
});
