import { NAMES } from '../shared/names';
import { BODY_COUNT, COLORS, HAT_HINTS, HAT_IDS, SKIN_COUNT, type Look } from '../shared/progression';
import { SKINS } from './actors/hero-look';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** The Aspecto panel (Menú): 8 colour circles, "Sin sombrero" + 6 hats (locked ones grey, with their hint), back. */
export function lookHtml(look: Look, unlocked: readonly number[]): string {
  const body = look.body ?? 0;
  const skin = look.skin ?? 0;
  const bodies = Array.from({ length: BODY_COUNT }, (_, i) => `<button class="hat${body === i ? ' on' : ''}" data-a="body-${i}">${NAMES.bodyNames[i]}</button>`).join('');
  const colors = COLORS.map((c, i) => `<button class="swatch${look.color === i ? ' on' : ''}" data-a="color-${i}" style="background:${hex(c)}" aria-label="${NAMES.colorNames[i]}"></button>`).join('');
  const skins = Array.from({ length: SKIN_COUNT }, (_, i) => `<button class="swatch${skin === i ? ' on' : ''}" data-a="skin-${i}" style="background:${i === 0 ? '#d8b08c' : hex(SKINS[i]!)}" aria-label="${NAMES.skinNames[i]}"></button>`).join('');
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
    <div class="look-preview" aria-hidden="true"></div>
    <p>Personaje: ${NAMES.bodyNames[body] ?? ''}</p>
    <div class="hats bodies">${bodies}</div>
    <p>Color: ${NAMES.colorNames[look.color] ?? ''}</p>
    <div class="swatches">${colors}</div>
    <p>Piel: ${NAMES.skinNames[skin] ?? ''}</p>
    <div class="swatches skins">${skins}</div>
    <div class="hats">${hats}</div>
    <button class="secondary" data-a="back">Volver</button>`;
}
