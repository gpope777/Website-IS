import { count, ITEM_LABELS, type Inventory } from '../shared/items';
import { NAMES } from '../shared/names';
import { MERCHANT } from '../shared/shop';

const low = (k: keyof typeof ITEM_LABELS) => ITEM_LABELS[k].toLowerCase();

/** T6-D: A opens the Buhonero within reach. */
export function merchantAction(pos: { x: number; z: number }, at: { x: number; z: number } | null): boolean {
  return !!at && Math.hypot(at.x - pos.x, at.z - pos.z) <= MERCHANT.reach;
}

/** T6-D: the Buhonero's fixed table; one tap = one trato. */
export function merchantHtml(inv: Inventory, left: number): string {
  const rows = MERCHANT.deals
    .map((d, i) => {
      const can = left > 0 && count(inv, d.give) >= d.n;
      return `<div class="shelf"><p>${d.n} ${low(d.give)} → ${d.m} ${low(d.get)}</p><button data-a="deal-${i}"${can ? '' : ' disabled'}>Cambiar</button></div>`;
    })
    .join('');
  return `<h2>${NAMES.merchant}</h2>
    <p>Compra de todo. Vende poco y caro. Paga en bayas.</p>
    <p>${left > 0 ? `Te quedan ${left} tratos hoy.` : 'Por hoy ya está.'}</p>
    ${rows}
    <button data-a="back">Volver</button>`;
}
