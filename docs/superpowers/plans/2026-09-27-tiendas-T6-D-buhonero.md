# Tiendas · T6-D: Buhonero, biomas y Encargos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the last plan of subproject #6 (spec §5, §6, §7, §9, §10.2, row T6-D of §11). **El Buhonero**: an NPC beside the Corazón from the first dawn after the Tragón's rescue (`invasion2 === 'rescued'`). He buys everything and sells only the common stuff, paying and charging in bayas at poor rates (the fixed `MERCHANT` table of spec §5.2), **20 tratos per player per game day**, and **never sells** perlas, ámbar, cuarzo or espinas. **Biome restock**: at dawn a Puesto standing in a biome, with a Vendo shelf of that biome's material, gets **+1** of it (the shelf never passes 10 by restock) if its owner has **gathered** that material before (`found`). **Encargos**: up to 2 of the 4 shelves can be **Busco** ("Busco 3 cuarzo, pago 12 piedra"); the pay leaves the owner's mochila when posted and stays in the shelf, so whoever brings the material is paid at once with **Entregar**, owner online or not. Names in `names.ts`. Conservation tests extended to the Buhonero (explicit source/sink) and Encargos.

**Architecture:** `shop.ts` gains `MERCHANT`, `merchantDeal`, `biomeItem`, `biomeRestock`, `canDeliver`, `deliver`, and `setShelf` takes an optional `mode` (≤2 Busco, only on an empty shelf). `WorldSim`: saved `merchant` flag (set at the first dawn after the rescue), `merchantAt()` (Corazón + fixed offset), `onDeal`, `onDeliver`, a `gain()` helper at the gather points that records rare `found`, dawn restock. New `src/client/merchant-ui.ts`; the Buhonero is one more paper actor; the Puesto panels learn Busco.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-tiendas-design.md` §5, §6, §7, §9, §10, §11 (T6-D).

## Global Constraints

- Spanish, dry voice. `NAMES.merchant = 'Buhonero'`, `NAMES.order = 'Encargo'`.
- **No new pills.** The Buhonero is a contextual A (priority after the Puesto, before Cambiar; spec §10.5); his panel and Busco live in the existing HTML overlays.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 61 → 62. New client messages via `decodeClient`: `deal {id}` (integer index into `MERCHANT.deals`), `deliver {stall, shelf}`; `stallSet` gains optional `mode: 'sell' | 'want'`. Snapshots gain optional `merchant: {x, z} | null`; `self` gains `deals` (tratos left today). New optional saved fields: `SavedWorld.merchant?: true`, `SavedPlayer.found?: ItemId[]`, `SavedPlayer.merchant?: { day, used }`. Old saves load: no Buhonero until the next dawn after a rescue; `found` inferred from the mochila and the weapon/Capa levels (arma ≥1 → perla, ≥4 → cuarzo, 6 → espina; Capa ≥1 → ámbar, 4 → espina).
- **Conservation is the core rule.** Encargos and Entregar conserve every material exactly (mochilas + tumbas + Puestos). The only accounted-for sources/sinks: a Buhonero trato (exactly the table row, both sides), dawn restock (exactly +1 of the local material on one shelf). Property tests assert totals after every step equal before ± those logged events.
- **[D] Busco pay lives in the shelf's `stock`** (units of `give`, the pay). "Busco m want, pago n give" is the same transfer as a sale seen from the other side, so `stallGoods`, caps (60/120), Reponer and Quitar work unchanged and nothing can be counted twice. The unused optional `escrow` field of `Shelf` is dropped.
- **[D] Mode changes only on an empty shelf** ("Quita el género primero."); at most 2 Busco ("Solo dos encargos.").
- **[D] Entregar shares the 0,5 s limiter with Comprar**; it is logged like a sale and counted in "vendió N veces" for an owner who is away. The owner can't deliver to himself.
- **[D] The Buhonero appears at the first dawn with `invasion2 === 'rescued'`** and stays (saved flag); he stands 6 m east of the Corazón; with no Corazón he isn't there.
- **[D] Deals are rows**; one tap = one trato; `day = floor(time / DAY_LENGTH)`; `used` resets when the day changes. He needs no stock.
- **[D] Biome restock: one unit per Puesto per dawn**, on the first Vendo shelf of the local material with stock < 10 (and within 60/120). Bosque → bayas (common: no `found` needed). Coast = south of the forest's rim (`z > HALF`) outside the Pantano.
- **[D] `found` counts only gathering** (nodes, drops, bosses, shrines/orbs), never buying, trading, graves or the Buhonero.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## File Structure

- Modify `src/shared/shop.ts`, `src/shared/names.ts`, `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`, `src/client/stall-ui.ts` (+test), `src/client/game.ts`, version tests (61 → 62).
- Create `src/shared/merchant.test.ts`, `src/shared/sim/world-sim-t6d.test.ts`, `src/client/merchant-ui.ts` + `merchant-ui.test.ts`.

## Tasks

### Task 1: pure rules — Buhonero, biomas, Encargos

```ts
export const MERCHANT = { reach: 4, perDay: 20, offset: { x: 6, z: 0 }, deals: [
  { give: 'wood', n: 5, get: 'berries', m: 1 }, { give: 'stone', n: 5, get: 'berries', m: 1 },
  { give: 'pearl', n: 1, get: 'berries', m: 4 }, { give: 'amber', n: 1, get: 'berries', m: 4 },
  { give: 'quartz', n: 1, get: 'berries', m: 5 }, { give: 'thorn', n: 1, get: 'berries', m: 6 },
  { give: 'berries', n: 6, get: 'wood', m: 5 }, { give: 'berries', n: 6, get: 'stone', m: 5 },
  { give: 'stone', n: 10, get: 'berries', m: 5 } ] } as const;
export const RARE: readonly ItemId[]; // pearl, amber, quartz, thorn
export function merchantDeal(inv: Inventory, id: number, used: number): { ok: true; inv: Inventory } | { ok: false; why: string };
export function biomeItem(x: number, z: number): ItemId;
export function biomeRestock(s: Stall, found: readonly ItemId[]): Stall | null; // +1 or null
export function canDeliver(s: Stall, i: number, inv: Inventory): string | null;
export function deliver(s: Stall, i: number, inv: Inventory, who: string, day: number): ShopResult;
// setShelf(..., mode?)
```

- [ ] **Step 1: failing tests** (`src/shared/merchant.test.ts`). Table: he never gives a rare material (`get` ∉ RARE); no loop through him gains anything (every sell-then-buy cycle loses bayas); `merchantDeal` applies exactly one row, refuses a bad id, a short mochila ("No te llega: madera.") and `used >= 20` ("Por hoy ya está."), never mutates. `biomeItem` for the five biomes. `biomeRestock`: +1 on the first matching Vendo shelf, none for Busco shelves, none at 10, none past 60/120, rare needs `found`, bayas don't. Busco: `setShelf` with `mode` only on empty shelves, third Busco refused; Reponer/Quitar move the pay; `deliver` moves `m want` from the deliverer to the Caja and `n give` from the shelf to him, refused on Vendo shelves, short, no pay left, Caja llena; `buy` refused on Busco. **Property:** 500 seeded runs of 60 random ops (setShelf with modes, restock, take, buy, deliver, collect, merchant deals with a logged ledger, biomeRestock with a logged ledger): per-material totals = start + ledger; nothing negative; Busco ≤ 2.
- [ ] **Step 2: implement** (+ `NAMES.merchant`, `NAMES.order`).
- [ ] **Step 3:** green, self-review, commit `feat(tiendas): Buhonero, biomas y encargos, reglas puras`.

### Task 2: server (protocolo v62)

- [ ] **Step 1: failing tests** (`world-sim-t6d.test.ts`). Protocol 62; decoder accepts `deal`, `deliver`, `stallSet` with/without `mode`, rejects bad ids/modes. No Buhonero before the rescue (`deal` ignored, `merchant: null` in snap); rescued → next dawn he appears 6 m east of the Corazón, saved flag survives `save()`→load. `deal` far away → "Acércate al Buhonero."; near → row applied, `self.deals` 19; the 21st trato in a day refused, next day resets. `found`: gathering quartz adds it, buying it doesn't; old save with arma 4 infers pearl + quartz. Dawn restock: Puesto in the Montaña selling cuarzo with owner `found` quartz → +1, not without `found`, not in the Bosque for cuarzo, bayas in the Bosque yes. Busco: Ana posts "Busco 3 cuarzo, pago 12 piedra" (mode + Reponer), goes away; Bea delivers → Bea +12 piedra −3 cuarzo, Caja +3 cuarzo, `soldSince` 1. **Property:** 30 runs × 100 steps with Ana, Bea, Cai (deals, deliver, buy, stallSet with modes, stock, take, till, moves, away/connect, dawns): totals = start + ledger of merchant rows and restocks.
- [ ] **Step 2: implement.**
- [ ] **Step 3:** green (61 → 62 in version tests, noted), self-review, commit `feat(tiendas): Buhonero, reposición y encargos en el servidor (protocolo v62)`.

### Task 3: client — the Buhonero and Busco

- [ ] **Step 1: failing tests.** `merchant-ui.test.ts`: `merchantAction(pos, m)` within 4 m; `merchantHtml(inv, left)`: "Buhonero", "Te quedan N tratos hoy.", one row per deal "5 madera → 1 bayas" with `deal-i` disabled when short or none left; never a row that gives a rare material. `stall-ui.test.ts`: owner panel shows a `mode-i` toggle (Vendo/Busco, disabled with stock) and Busco rows "Busco 3 cuarzo, pago 12 piedra · pagos para 1"; buyer panel shows Busco shelves with **Entregar** (`deliver-i`, greyed with the reason); Menú → Puestos says "busca cuarzo".
- [ ] **Step 2: implement.** Buhonero as a paper actor (a tinted defender) at `m.merchant`; A order: … Puesto > Buhonero > Cambiar.
- [ ] **Step 3:** green, self-review, commit `feat(tiendas): Buhonero y encargos en el cliente`.

### Task 4: Ship

- [ ] Full suite green; push; HANDOFF: "## Tiendas — resumen" at the top of the Tiendas area, "## Tiendas · T6-D — …", and the top "Aventura completa — estado" (#6 done; next #2 Visuales, #7 Pulido); one short comment on PR #3.
