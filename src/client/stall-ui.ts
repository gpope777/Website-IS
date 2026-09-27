import { count, ITEM_LABELS, ITEMS, type Inventory, type ItemId } from '../shared/items';
import { NAMES } from '../shared/names';
import { canBuy, canDeliver, STALL, tillTotal, type Stall } from '../shared/shop';

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
      const want = sh.mode === 'want';
      const line = want ? `Busco ${sh.m} ${low(sh.want)}, pago ${sh.n} ${low(sh.give)} · pagos para ${Math.floor(sh.stock / sh.n)}` : `Vendo ${sh.n} ${low(sh.give)} por ${sh.m} ${low(sh.want)} · quedan ${sh.stock}`;
      return `<div class="shelf">
        <p>${line}</p>
        <button class="secondary" data-a="mode-${i}"${sh.stock > 0 ? ' disabled' : ''}>${want ? 'Busco' : 'Vendo'}</button>
        <button class="secondary" data-a="n-${i}-dec">−</button><button class="secondary" data-a="give-${i}">${ITEM_LABELS[sh.give]}</button><button class="secondary" data-a="n-${i}-inc">+</button>
        por
        <button class="secondary" data-a="m-${i}-dec">−</button><button class="secondary" data-a="want-${i}">${ITEM_LABELS[sh.want]}</button><button class="secondary" data-a="m-${i}-inc">+</button>
        <button data-a="stock-${i}"${canStock ? '' : ' disabled'}>${want ? 'Apartar' : 'Reponer'} +${sh.n}</button>
        <button class="secondary" data-a="take-${i}"${sh.stock > 0 ? '' : ' disabled'}>Quitar</button>
      </div>`;
    })
    .join('');
  return `<h2>${NAMES.stall} de ${s.owner}</h2>
    <p>Lo que pongas sale de tu mochila y se queda aquí. Cambiar el precio es gratis. En un ${NAMES.order.toLowerCase()} (Busco) la paga se aparta y quien trae lo pedido cobra al momento. Dos como mucho.</p>
    ${rows}
    <p>${NAMES.till}: ${tillText(s)}</p>
    <button data-a="till"${tillTotal(s) > 0 ? '' : ' disabled'}>Vaciar ${NAMES.till.toLowerCase()}</button>
    ${s.log.length ? `<p>Últimas ventas:</p>${s.log.map((v) => `<p>${v.who} · ${v.n} ${low(v.give)} · ${v.m} ${low(v.want)} · día ${v.day}</p>`).join('')}` : ''}
    <button class="secondary" data-a="pick">Recoger ${NAMES.stall.toLowerCase()}</button>
    <button data-a="back">Volver</button>`;
}

const tillText = (s: Stall) => {
  const parts = ITEMS.filter((k) => count(s.till, k) > 0).map((k) => `${count(s.till, k)} ${low(k)}`);
  return parts.length ? parts.join(', ') : 'vacía';
};

/** T6-B: the buyer's panel. Only stocked Vendo shelves; greyed with the reason when you can't. */
export function buyHtml(s: Stall, inv: Inventory): string {
  const rows = s.shelves
    .map((sh, i) => {
      if (sh.stock <= 0) return '';
      if (sh.mode === 'want') {
        const w = canDeliver(s, i, inv);
        return `<div class="shelf">
        <p>Busca ${sh.m} ${low(sh.want)}, paga ${sh.n} ${low(sh.give)} · ${Math.floor(sh.stock / sh.n)} veces${w ? ` · ${w}` : ''}</p>
        <button data-a="deliver-${i}"${w ? ' disabled' : ''}>Entregar</button>
      </div>`;
      }
      const why = canBuy(s, i, inv);
      return `<div class="shelf">
        <p>${sh.n} ${low(sh.give)} por ${sh.m} ${low(sh.want)} · quedan ${sh.stock}${why ? ` · ${why}` : ''}</p>
        <button data-a="buy-${i}"${why ? ' disabled' : ''}>Comprar</button>
      </div>`;
    })
    .join('');
  return `<h2>${NAMES.stall} de ${s.owner}</h2>
    ${rows || '<p>No vende nada.</p>'}
    <button data-a="back">Volver</button>`;
}

const DIRS = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];

/** T6-B: the Menú's list of Puestos (−z is north). */
export function stallListHtml(stalls: readonly Stall[], pos: { x: number; z: number }): string {
  const rows = stalls
    .map((s) => {
      const dx = s.x - pos.x;
      const dz = s.z - pos.z;
      const d = Math.round(Math.hypot(dx, dz));
      const dir = DIRS[(Math.round(Math.atan2(dx, -dz) / (Math.PI / 4)) + 8) % 8]!;
      const goods = [...new Set(s.shelves.filter((sh) => sh.mode === 'sell' && sh.stock > 0).map((sh) => low(sh.give)))];
      const wants = [...new Set(s.shelves.filter((sh) => sh.mode === 'want' && sh.stock >= sh.n).map((sh) => low(sh.want)))];
      return `<p>${NAMES.stall} de ${s.owner} · ${goods.length ? `vende ${goods.join(', ')}` : 'no vende nada'}${wants.length ? ` · busca ${wants.join(', ')}` : ''} · ${d < 5 ? 'aquí' : `${d} m al ${dir}`}</p>`;
    })
    .join('');
  return `<h2>Puestos</h2>${rows || '<p>No hay puestos.</p>'}<button data-a="back">Volver</button>`;
}
