import { count, ITEM_LABELS, ITEMS, type Inventory, type ItemId } from '../shared/items';
import { NAMES } from '../shared/names';
import { STALL, type Stall } from '../shared/shop';

const low = (k: ItemId) => ITEM_LABELS[k].toLowerCase();

/** The next of the 7 materials (the panel's material buttons cycle). */
export function nextItem(k: ItemId): ItemId {
  return ITEMS[(ITEMS.indexOf(k) + 1) % ITEMS.length]!;
}

/** T6-A: which Puesto A would open: your own, someone else's, or none within reach. */
export function stallAction(pos: { x: number; z: number }, stalls: readonly Stall[], me: string): { own: boolean; s: Stall } | null {
  let best: { s: Stall; d: number } | null = null;
  for (const s of stalls) {
    const d = Math.hypot(s.x - pos.x, s.z - pos.z);
    if (d <= STALL.reach && (!best || d < best.d)) best = { s, d };
  }
  return best ? { own: best.s.owner === me, s: best.s } : null;
}

/** T6-A: the owner's panel. Every tap is one message; the panel redraws on the next `stall` event. */
export function stallHtml(s: Stall, inv: Inventory): string {
  const rows = s.shelves
    .map((sh, i) => {
      const canStock = count(inv, sh.give) >= sh.n;
      return `<div class="shelf">
        <p>Vendo ${sh.n} ${low(sh.give)} por ${sh.m} ${low(sh.want)} · quedan ${sh.stock}</p>
        <button class="secondary" data-a="n-${i}-dec">−</button><button class="secondary" data-a="give-${i}">${ITEM_LABELS[sh.give]}</button><button class="secondary" data-a="n-${i}-inc">+</button>
        por
        <button class="secondary" data-a="m-${i}-dec">−</button><button class="secondary" data-a="want-${i}">${ITEM_LABELS[sh.want]}</button><button class="secondary" data-a="m-${i}-inc">+</button>
        <button data-a="stock-${i}"${canStock ? '' : ' disabled'}>Reponer +${sh.n}</button>
        <button class="secondary" data-a="take-${i}"${sh.stock > 0 ? '' : ' disabled'}>Quitar</button>
      </div>`;
    })
    .join('');
  return `<h2>${NAMES.stall} de ${s.owner}</h2>
    <p>Lo que pongas sale de tu mochila y se queda aquí. Cambiar el precio es gratis.</p>
    ${rows}
    <button class="secondary" data-a="pick">Recoger ${NAMES.stall.toLowerCase()}</button>
    <button data-a="back">Volver</button>`;
}
