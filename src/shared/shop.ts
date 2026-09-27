import { inCorrupt, inMountains, inSwamp, HALF } from './terrain';
import { addItem, count, hasAll, ITEM_LABELS, ITEMS, removeAll, type Inventory, type ItemId } from './items';

/** Tiendas (spec #6 §3, §10.1): the Puesto's constants. */
export const STALL = { cost: { wood: 8, stone: 4 }, shelves: 4, shelfMax: 60, totalMax: 120, tillMax: 200, wantMax: 2, reach: 4, apart: 15, nMax: 20 } as const;

/**
 * "Vendo n give por m want", with `stock` units of `give` kept in the Puesto.
 * T6-D 'want' (Busco, an Encargo): "Busco m want, pago n give"; `stock` is the pay set aside (units of `give`).
 */
export interface Shelf { mode: 'sell' | 'want'; give: ItemId; n: number; want: ItemId; m: number; stock: number }
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
  }
  return g;
}

const stockTotal = (s: Stall) => s.shelves.reduce((a, sh) => a + sh.stock, 0);

/** Change a shelf's offer. Free; the material and the mode (T6-D Vendo/Busco) can't change while it holds stock. */
export function setShelf(s: Stall, i: number, give: ItemId, n: number, want: ItemId, m: number, inv: Inventory, mode?: Shelf['mode']): ShopResult {
  if (!shelfOk(s, i) || !isItem(give) || !isItem(want) || !amount(n) || !amount(m) || (mode !== undefined && mode !== 'sell' && mode !== 'want')) return fail('Eso no vale.');
  if (give === want) return fail('Cambiar algo por lo mismo no tiene gracia.');
  const sh = s.shelves[i]!;
  const md = mode ?? sh.mode;
  if (sh.stock > 0 && (sh.give !== give || sh.mode !== md)) return fail('Quita el género primero.');
  if (md === 'want' && sh.mode !== 'want' && s.shelves.filter((x) => x.mode === 'want').length >= STALL.wantMax) return fail('Solo dos encargos.');
  return { ok: true, stall: withShelf(s, i, { ...sh, mode: md, give, n, want, m }), inv: { ...inv } };
}

/** Reponer: one tanda (`n` units) from the mochila onto the shelf. */
export function restock(s: Stall, i: number, inv: Inventory): ShopResult {
  if (!shelfOk(s, i)) return fail('Eso no vale.');
  const sh = s.shelves[i]!;
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

/** T6-C: trueque directo (spec §4). Distances in m, times in s. */
export const TRADE = { reach: 4, leash: 6, lines: 3, nMax: 99, timeout: 60, askEvery: 5, noMax: 3, noWait: 60 } as const;
export interface TradeLine { item: ItemId; n: number }

/** Up to 3 lines, distinct materials, whole amounts 1–99. Only the 7 materials: nothing else can be traded. */
export function linesOk(lines: unknown): lines is TradeLine[] {
  if (!Array.isArray(lines) || lines.length > TRADE.lines) return false;
  const seen = new Set<unknown>();
  for (const l of lines as unknown[]) {
    if (!l || typeof l !== 'object') return false;
    const { item, n } = l as { item?: unknown; n?: unknown };
    if (!isItem(item) || seen.has(item) || typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > TRADE.nMax) return false;
    seen.add(item);
  }
  return true;
}

export function offerInv(lines: readonly TradeLine[]): Inventory {
  let o: Inventory = {};
  for (const l of lines) o = addItem(o, l.item, l.n);
  return o;
}

/** Both sides at once, or nothing. Never mutates. */
export function trade(a: Inventory, b: Inventory, la: readonly TradeLine[], lb: readonly TradeLine[]): { ok: true; a: Inventory; b: Inventory } | { ok: false; side: 0 | 1; item: ItemId } {
  const short = (inv: Inventory, ls: readonly TradeLine[]) => ls.find((l) => count(inv, l.item) < l.n)?.item;
  const sa = short(a, la);
  if (sa) return { ok: false, side: 0, item: sa };
  const sb = short(b, lb);
  if (sb) return { ok: false, side: 1, item: sb };
  let na = removeAll(a, offerInv(la));
  let nb = removeAll(b, offerInv(lb));
  for (const l of lb) na = addItem(na, l.item, l.n);
  for (const l of la) nb = addItem(nb, l.item, l.n);
  return { ok: true, a: na, b: nb };
}

/** T6-D: el Buhonero (spec §5.2). You give `n` of `give`, you get `m` of `get`. He never sells a rare material. */
export const MERCHANT = {
  reach: 4,
  perDay: 20,
  offset: { x: 6, z: 0 },
  deals: [
    { give: 'wood', n: 5, get: 'berries', m: 1 },
    { give: 'stone', n: 5, get: 'berries', m: 1 },
    { give: 'pearl', n: 1, get: 'berries', m: 4 },
    { give: 'amber', n: 1, get: 'berries', m: 4 },
    { give: 'quartz', n: 1, get: 'berries', m: 5 },
    { give: 'thorn', n: 1, get: 'berries', m: 6 },
    { give: 'berries', n: 6, get: 'wood', m: 5 },
    { give: 'berries', n: 6, get: 'stone', m: 5 },
    { give: 'stone', n: 10, get: 'berries', m: 5 },
  ],
} as const satisfies { reach: number; perDay: number; offset: { x: number; z: number }; deals: readonly { give: ItemId; n: number; get: ItemId; m: number }[] };

/** T6-D: what only exploring gives. */
export const RARE: readonly ItemId[] = ['pearl', 'amber', 'quartz', 'thorn'];

/** T6-D: one trato; `used` = tratos already done today. Never mutates. */
export function merchantDeal(inv: Inventory, id: number, used: number): { ok: true; inv: Inventory } | { ok: false; why: string } {
  const d = Number.isInteger(id) ? MERCHANT.deals[id] : undefined;
  if (!d) return { ok: false, why: 'Eso no vale.' };
  if (used >= MERCHANT.perDay) return { ok: false, why: 'Por hoy ya está.' };
  if (count(inv, d.give) < d.n) return { ok: false, why: `No te llega: ${ITEM_LABELS[d.give].toLowerCase()}.` };
  return { ok: true, inv: addItem(removeAll(inv, { [d.give]: d.n } as Inventory), d.get, d.m) };
}

/** T6-D: each biome's material (spec §5.4). The coast is south of the forest's rim, outside the Pantano. */
export function biomeItem(x: number, z: number): ItemId {
  if (inCorrupt(x, z)) return 'thorn';
  if (inMountains(x, z)) return 'quartz';
  if (inSwamp(x, z)) return 'amber';
  if (z > HALF) return 'pearl';
  return 'berries';
}

/** T6-D: a shelf never passes this by biome restock. */
export const RESTOCK_MAX = 10;

/** T6-D: the dawn's +1 of the local material on the first Vendo shelf that sells it, or null. Rare ones need `found`. */
export function biomeRestock(s: Stall, found: readonly ItemId[]): Stall | null {
  const k = biomeItem(s.x, s.z);
  if (RARE.includes(k) && !found.includes(k)) return null;
  if (stockTotal(s) + 1 > STALL.totalMax) return null;
  const i = s.shelves.findIndex((sh) => sh.mode === 'sell' && sh.give === k && sh.stock < RESTOCK_MAX);
  if (i < 0) return null;
  const sh = s.shelves[i]!;
  return withShelf(s, i, { ...sh, stock: sh.stock + 1 });
}

/** T6-D: null if `inv` can fill Encargo `i` once now; otherwise why not. */
export function canDeliver(s: Stall, i: number, inv: Inventory): string | null {
  if (!shelfOk(s, i)) return 'Eso no vale.';
  const sh = s.shelves[i]!;
  if (sh.mode !== 'want') return 'Eso no vale.';
  if (sh.stock < sh.n) return 'Ya no paga.';
  if (count(inv, sh.want) < sh.m) return `No te llega: ${ITEM_LABELS[sh.want].toLowerCase()}.`;
  if (tillTotal(s) + sh.m > STALL.tillMax) return 'Caja llena.';
  return null;
}

/** T6-D: Entregar — `m want` from the deliverer to the Caja, the pay (`n give`) from the shelf to him. */
export function deliver(s: Stall, i: number, inv: Inventory, who: string, day: number): ShopResult {
  const why = canDeliver(s, i, inv);
  if (why) return fail(why);
  const sh = s.shelves[i]!;
  const next = withShelf(s, i, { ...sh, stock: sh.stock - sh.n });
  next.till = addItem(next.till, sh.want, sh.m);
  next.log = [{ who, give: sh.give, n: sh.n, want: sh.want, m: sh.m, day }, ...next.log].slice(0, LOG_MAX);
  return { ok: true, stall: next, inv: addItem(removeAll(inv, { [sh.want]: sh.m } as Inventory), sh.give, sh.n) };
}
