import { describe, expect, it } from 'vitest';
import { lookHtml } from './look-ui';

describe('Aspecto screen (P4-C)', () => {
  it('8 swatches, the worn one on; hats with locks and hints', () => {
    const h = lookHtml({ color: 2, hat: 0 }, [4]);
    expect(h).toContain('<h2>Aspecto</h2>');
    expect(h.match(/data-a="color-/g)).toHaveLength(8);
    expect(h).toContain('class="swatch on" data-a="color-2"');
    expect(h.match(/data-a="hat-/g)).toHaveLength(7);
    expect(h).toContain('Sin sombrero');
    expect(h).toContain('class="hat" data-a="hat-4"');
    expect(h).toContain('class="hat locked" data-a="hat-1"');
    expect(h).toContain('Se gana con Rango 2');
    expect(h).toContain('data-a="back"');
  });
});
