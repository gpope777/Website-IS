import { NAMES } from '../shared/names';
import { COLORS, HAT_HINTS, HAT_IDS, type Look } from '../shared/progression';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** The Aspecto panel (Menú): 8 colour circles, "Sin sombrero" + 6 hats (locked ones grey, with their hint), back. */
export function lookHtml(look: Look, unlocked: readonly number[]): string {
  const colors = COLORS.map((c, i) => `<button class="swatch${look.color === i ? ' on' : ''}" data-a="color-${i}" style="background:${hex(c)}" aria-label="${NAMES.colorNames[i]}"></button>`).join('');
  const hats = [`<button class="hat${look.hat === 0 ? ' on' : ''}" data-a="hat-0">Sin sombrero</button>`]
    .concat(
      HAT_IDS.map((id, i) => {
        const n = i + 1;
        const open = unlocked.includes(n);
        return `<button class="hat${open ? '' : ' locked'}${look.hat === n ? ' on' : ''}" data-a="hat-${n}">${NAMES.hatNames[id]}${open ? '' : `<small>${HAT_HINTS[id]}</small>`}</button>`;
      }),
    )
    .join('');
  return `<h2>${NAMES.look}</h2>
    <p>Color: ${NAMES.colorNames[look.color] ?? ''}</p>
    <div class="swatches">${colors}</div>
    <div class="hats">${hats}</div>
    <button class="secondary" data-a="back">Volver</button>`;
}
