import { count, ITEM_LABELS, ITEMS, type Inventory, type ItemId } from '../shared/items';
import { NAMES, qty } from '../shared/names';
import type { TradeView } from '../shared/protocol';
import { TRADE, type TradeLine } from '../shared/shop';

const low = (k: ItemId) => ITEM_LABELS[k].toLowerCase();

/** T6-C: the nearest standing player within reach for A → Cambiar, or null. */
export function tradeTarget(pos: { x: number; z: number }, others: readonly { name: string; x: number; z: number; down?: boolean }[]): string | null {
  let best: { name: string; d: number } | null = null;
  for (const o of others) {
    if (o.down) continue;
    const d = Math.hypot(o.x - pos.x, o.z - pos.z);
    if (d <= TRADE.reach && (!best || d < best.d)) best = { name: o.name, d };
  }
  return best?.name ?? null;
}

/** Materials in the mochila not already on a line. */
const free = (lines: readonly TradeLine[], inv: Inventory) => ITEMS.filter((k) => count(inv, k) > 0 && !lines.some((l) => l.item === k));

/** A new line with the first material you have that isn't offered yet; null if none or already 3. */
export function addLine(lines: readonly TradeLine[], inv: Inventory): TradeLine[] | null {
  const k = free(lines, inv)[0];
  return k && lines.length < TRADE.lines ? [...lines, { item: k, n: 1 }] : null;
}

/** Line `i` switches to the next material you have (and isn't on another line); amount clamps to what you have. */
export function cycleLine(lines: readonly TradeLine[], i: number, inv: Inventory): TradeLine[] {
  const cur = lines[i]!;
  const opts = ITEMS.filter((k) => count(inv, k) > 0 && (k === cur.item || !lines.some((l) => l.item === k)));
  const k = opts[(opts.indexOf(cur.item) + 1) % opts.length] ?? cur.item;
  return lines.map((l, j) => (j === i ? { item: k, n: Math.max(1, Math.min(l.n, count(inv, k))) } : { ...l }));
}

/** Line `i` ± d, between 1 and what you have (max 99). */
export function bumpLine(lines: readonly TradeLine[], i: number, d: number, inv: Inventory): TradeLine[] {
  return lines.map((l, j) => (j === i ? { item: l.item, n: Math.max(1, Math.min(l.n + d, count(inv, l.item), TRADE.nMax)) } : { ...l }));
}

const lineText = (ls: readonly TradeLine[]) => (ls.length ? ls.map((l) => `<p>${qty(l.n, l.item)}</p>`).join('') : '<p>Nada.</p>');

/** T6-C: the trade window. Asked: Ver / No. Waiting: Cancelar. Open: two columns, Vale, Cancelar. */
export function tradeHtml(tr: TradeView, inv: Inventory): string {
  if (!tr.open && !tr.asker)
    return `<h2>${NAMES.trade}</h2><p>${tr.with} quiere cambiar.</p><button data-a="yes">Ver</button><button class="secondary" data-a="no">No</button>`;
  if (!tr.open) return `<h2>${NAMES.trade}</h2><p>Esperando a ${tr.with}…</p><button class="secondary" data-a="cancel">Cancelar</button>`;
  const mine = tr.mine
    .map(
      (l, i) =>
        `<div class="shelf"><button class="secondary" data-a="dec-${i}">−</button><button class="secondary" data-a="item-${i}">${qty(l.n, l.item)}</button><button class="secondary" data-a="inc-${i}">+</button><button class="secondary" data-a="del-${i}">Quitar</button></div>`,
    )
    .join('');
  const canAdd = addLine(tr.mine, inv) !== null;
  return `<h2>${NAMES.trade} con ${tr.with}</h2>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:140px"><p><b>Tú das</b></p>${mine || '<p>Nada.</p>'}${canAdd ? '<button class="secondary" data-a="add">Añadir</button>' : ''}</div>
      <div style="flex:1;min-width:140px"><p><b>${tr.with} da</b></p>${lineText(tr.theirs)}</div>
    </div>
    <p>${tr.okMine ? 'Tú: Vale.' : 'Tú: pensando.'} ${tr.okTheirs ? `${tr.with}: Vale.` : `${tr.with}: pensando.`}</p>
    <p>Cualquier cambio quita los dos Vale.</p>
    <button data-a="ok"${tr.okMine ? ' disabled' : ''}>Vale</button>
    <button class="secondary" data-a="cancel">Cancelar</button>`;
}
