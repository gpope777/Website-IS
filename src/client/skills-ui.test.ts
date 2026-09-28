import { describe, expect, it } from 'vitest';
import { skillsHtml, skillState } from './skills-ui';

describe('Oficios screen (P4-B)', () => {
  it('owned, open or locked', () => {
    expect(skillState(['pies'], 'pies', 3)).toBe('owned');
    expect(skillState(['pies'], 'planeo', 3)).toBe('open');
    expect(skillState([], 'planeo', 3)).toBe('locked');
    expect(skillState(['pies', 'mano'], 'planeo', 3)).toBe('locked'); // no points left
  });

  it('points, 12 buttons in 3 columns, forget only at the Heart', () => {
    const h = skillsHtml(3, ['pies'], false, null);
    expect(h).toContain('Puntos: 1');
    expect(h.match(/data-a="skill-/g)).toHaveLength(12);
    expect(h.match(/class="skill-col"/g)).toHaveLength(3);
    expect(h).toContain('class="skill owned"');
    expect(h).not.toContain('Olvidar oficios');
    expect(skillsHtml(3, ['pies'], true, null)).toContain('Olvidar oficios · 5 bayas');
  });

  it('tapping one shows its line and, if open, the learn button', () => {
    const h = skillsHtml(3, ['pies'], false, 'planeo');
    expect(h).toContain('Planeando caes un 20 % más despacio.');
    expect(h).toContain('Aprender (1 punto)');
    expect(skillsHtml(3, [], false, 'planeo')).not.toContain('Aprender');
  });
});
