import { NAMES, qty } from '../shared/names';
import { BRANCHES, canLearn, SKILL_FX, SKILL_LINES, skillPoints, type SkillId } from '../shared/progression';

/** How a oficio button looks: learned, learnable now, or not yet. */
export function skillState(skills: readonly string[], id: SkillId, rank: number): 'owned' | 'open' | 'locked' {
  const ok = canLearn(skills, id, rank);
  return ok === 'owned' ? 'owned' : ok === 'ok' ? 'open' : 'locked';
}

/** The Oficios panel (Menú): 3 columns × 4, the chosen one's line, learn / forget / back. */
export function skillsHtml(rank: number, skills: readonly string[], atHeart: boolean, chosen: SkillId | null): string {
  const cols = BRANCHES.map(
    (b) => `<div class="skill-col"><h3>${b.name}</h3>${b.skills.map((id) => `<button class="skill ${skillState(skills, id, rank)}" data-a="skill-${id}">${NAMES.skillNames[id]}</button>`).join('')}</div>`,
  ).join('');
  const pick = chosen ? `<p><b>${NAMES.skillNames[chosen]}.</b> ${SKILL_LINES[chosen]}</p>${skillState(skills, chosen, rank) === 'open' ? '<button data-a="learn">Aprender (1 punto)</button>' : ''}` : '<p>Toca uno para ver qué hace.</p>';
  return `<h2>${NAMES.skills}</h2>
    <p>Puntos: ${skillPoints(rank, skills)}</p>
    <div class="skills">${cols}</div>
    ${pick}
    ${atHeart ? `<button class="secondary" data-a="forget">Olvidar oficios · ${qty(SKILL_FX.forgetCost, 'berries')}</button>` : ''}
    <button class="secondary" data-a="back">Volver</button>`;
}
