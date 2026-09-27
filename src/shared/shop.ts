import { addItem, count, hasAll, ITEM_LABELS, ITEMS, removeAll, type Inventory, type ItemId } from './items';

/** Tiendas (spec #6 §3, §10.1): the Puesto's constants. */
export const STALL = { cost: { wood: 8, stone: 4 }, shelves: 4, shelfMax: 60, totalMax: 120, tillMax: 200, wantMax: 2, reach: 4, apart: 15, nMax: 20 } as const;

/** "Vendo n give por m want", with `stock` units of `give` kept in the Puesto. 'want' shelves (Encargos) come in T6-D. */
export interface Shelf { mode: 'sell' | 'want'; give: ItemId; n: number; want: ItemId; m: number; stock: number; escrow?: number }
export interface Sale { who: string; give: ItemId; n: number; want: ItemId; m: number; day: number }
export interface Stall { id: number; owner: string; x: number; y: number; z: number; rot: number; shelves: Shelf[]; till: Inventory; log: Sale[] }
export type ShopResult = { ok: true; stall: Stall; inv: Inventory } | { ok: false; why: string };

const fail = (why: string): ShopResult => ({ ok: false, why });
const isItem = (v: unknown): v is ItemId => (ITEMS as readonly unknown[]).includes(v);
const amount = (v: number) => Number.isInteger(v) && v >= 1 && v <= STALL.nMax;
const shelfOk = (s: Stall, i: number) => Number.isInteger(i) && i >= 0 && i < s.shelves.length;
const withShelf = (s: Stall, i: number, sh: Shelf): Stall => ({ ...s, shelves: s.shelves.map((x, j) => (j === i ? sh : { ...x })), till: { ...s.till }, log: [...s.log] });

export function newStall(id: number, owner: string, x: number, y: number, z: number, rot: number): Stall {
  const shelves = Array.from({ length: STALL.shelves }, (): Shelf => ({ mode: 'sell', give: 'wood', n: 1, want: 'berries', m: 1, stock: 0 }));
  return { id, owner, x, y, z, rot, shelves, till: {}, log: [] };
}

/** Everything the Puesto holds: stock, set-aside pay and the Caja. */
export function stallGoods(s: Stall): Inventory {
  let g: Inventory = { ...s.till };
  for (const sh of s.shelves) {
    if (sh.stock > 0) g = addItem(g, sh.give, sh.stock);
    if (sh.escrow) g = addItem(g, sh.want, sh.escrow);
  }
  return g;
}

const stockTotal = (s: Stall) => s.shelves.reduce((a, sh) => a + sh.stock, 0);

/** Change a shelf's offer. Free; only the material can't change while it holds stock. */
export function setShelf(s: Stall, i: number, give: ItemId, n: number, want: ItemId, m: number, inv: Inventory): ShopResult {
  if (!shelfOk(s, i) || !isItem(give) || !isItem(want) || !amount(n) || !amount(m)) return fail('Eso no vale.');
  if (give === want) return fail('Cambiar algo por lo mismo no tiene gracia.');
  const sh = s.shelves[i]!;
  if (sh.stock > 0 && sh.give !== give) return fail('Quita el género primero.');
  return { ok: true, stall: withShelf(s, i, { ...sh, give, n, want, m }), inv: { ...inv } };
}

/** Reponer: one tanda (`n` units) from the mochila onto the shelf. */
export function restock(s: Stall, i: number, inv: Inventory): ShopResult {
  if (!shelfOk(s, i)) return fail('Eso no vale.');
  const sh = s.shelves[i]!;
  if (sh.mode !== 'sell') return fail('Eso no vale.');
  if (sh.stock + sh.n > STALL.shelfMax) return fail('El estante está lleno.');
  if (stockTotal(s) + sh.n > STALL.totalMax) return fail('El puesto está lleno.');
  const cost = { [sh.give]: sh.n } as Inventory;
  if (!hasAll(inv, cost)) return fail(`Te falta: ${ITEM_LABELS[sh.give].toLowerCase()}.`);
  return { ok: true, stall: withShelf(s, i, { ...sh, stock: sh.stock + sh.n }), inv: removeAll(inv, cost) };
}

/** Quitar: the whole shelf back to the mochila. */
export function takeShelf(s: Stall, i: number, inv: Inventory): ShopResult {
  if (!shelfOk(s, i)) return fail('Eso no vale.');
  const sh = s.shelves[i]!;
  if (sh.stock <= 0) return fail('No hay nada que quitar.');
  return { ok: true, stall: withShelf(s, i, { ...sh, stock: 0 }), inv: addItem(inv, sh.give, sh.stock) };
}

/** Recoger puesto: shelves, Caja and the full cost back into the mochila. */
export function pickUp(s: Stall, inv: Inventory): Inventory {
  let out: Inventory = { ...inv };
  const back = stallGoods(s);
  for (const k of ITEMS) {
    const n = count(back, k) + count(STALL.cost as Inventory, k);
    if (n > 0) out = addItem(out, k, n);
  }
  return out;
}

/** Null if `owner` may put a Puesto at (x, z); otherwise why not. */
export function canPlaceStall(stalls: readonly Stall[], owner: string, x: number, z: number): string | null {
  if (stalls.some((s) => s.owner === owner)) return 'Ya tienes un puesto.';
  if (stalls.some((s) => Math.hypot(s.x - x, s.z - z) < STALL.apart)) return 'Hay otro puesto demasiado cerca.';
  return null;
}

/** T6-B: the last sales kept in the Puesto's log. */
export const LOG_MAX = 10;

/** T6-B: units in the Caja. */
export function tillTotal(s: Stall): number {
  return ITEMS.reduce((a, k) => a + count(s.till, k), 0);
}

/** T6-B: null if `inv` can buy one tanda from shelf `i` now; otherwise why not. */
export function canBuy(s: Stall, i: number, inv: Inventory): string | null {
  if (!shelfOk(s, i)) return 'Eso no vale.';
  const sh = s.shelves[i]!;
  if (sh.mode !== 'sell') return 'Eso no vale.';
  if (sh.stock < sh.n) return 'No queda.';
  if (count(inv, sh.want) < sh.m) return `No te llega: ${ITEM_LABELS[sh.want].toLowerCase()}.`;
  if (tillTotal(s) + sh.m > STALL.tillMax) return 'Caja llena.';
  return null;
}

/** T6-B: buy one tanda. `inv` is the buyer's mochila; the pay goes into the Caja. */
export function buy(s: Stall, i: number, inv: Inventory, who: string, day: number): ShopResult {
  const why = canBuy(s, i, inv);
  if (why) return fail(why);
  const sh = s.shelves[i]!;
  const next = withShelf(s, i, { ...sh, stock: sh.stock - sh.n });
  next.till = addItem(next.till, sh.want, sh.m);
  next.log = [{ who, give: sh.give, n: sh.n, want: sh.want, m: sh.m, day }, ...next.log].slice(0, LOG_MAX);
  return { ok: true, stall: next, inv: addItem(removeAll(inv, { [sh.want]: sh.m } as Inventory), sh.give, sh.n) };
}

/** T6-B: Vaciar caja — everything in it to the owner's mochila. */
export function collectTill(s: Stall, inv: Inventory): ShopResult {
  if (tillTotal(s) === 0) return fail('La caja está vacía.');
  let out: Inventory = { ...inv };
  for (const k of ITEMS) if (count(s.till, k) > 0) out = addItem(out, k, count(s.till, k));
  return { ok: true, stall: { ...s, shelves: s.shelves.map((x) => ({ ...x })), till: {}, log: [...s.log] }, inv: out };
}
