# Tiendas · T6-A: Reglas y el Puesto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the first plan of subproject #6 (spec §3.1, §3.2, §7, §10.1–10.4, row T6-A of §11). Pure shop rules in `src/shared/shop.ts` with **conservation tests** (no sequence of stock / take / set / pick up creates or destroys a material), the **Puesto** saved in `SavedWorld.stalls`, building it from the Menú and picking it up with A, the 4 **Vendo** shelves with Reponer / Quitar and free prices, the owner's HTML panel, and one merged mesh. Buying, the Caja's income, the log and the map are T6-B.

**Architecture:** `shop.ts` holds `STALL`, `Stall`, `Shelf`, `newStall`, `setShelf`, `restock`, `takeShelf`, `pickUp`, `stallGoods` and `canPlaceStall`; every op is pure and returns `{ ok: true, stall, inv } | { ok: false, why }` without mutating. `WorldSim` keeps `stalls: Stall[]` (not in `structures`: sieges never see them, no hp), applies an op only when it returns `ok`, and broadcasts `{ t: 'stall', s }` / `{ t: 'stall', s, gone: true }`. The panel is pure HTML from `src/client/stall-ui.ts`; the mesh lives in `src/client/scene/stalls.ts`.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-tiendas-design.md` §3.1, §3.2, §7, §9, §10, §11 (T6-A).

## Global Constraints

- Spanish, dry voice. `NAMES.stall = 'Puesto'`, `NAMES.till = 'Caja'` in `names.ts` (the rest of §9 comes with its plan).
- **No new pills.** Menú → "Poner puesto (8 madera, 4 piedra)" when you have none; A beside your own Puesto opens its panel; A beside someone else's says "Puesto de Ana." (buying is T6-B). A priority: after the Heart / upgrade / Capa, before harvesting.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 58 → 59. New client messages, all through `decodeClient`: `stallPlace {x, z, rot}`, `stallSet {shelf, give, n, want, m}`, `stallStock {shelf, n}`, `stallTake {shelf}`, `stallPick {}`. New server message `stall {s, gone?}`; `welcome.stalls?`. New saved field, optional: `SavedWorld.stalls?: Stall[]`. Old saves load with no Puestos.
- **Conservation is the core rule.** Every op checks everything, then applies everything; a failed op changes nothing. Tests: for random op sequences (seeded), `inv + stallGoods(stall)` per material is constant; only building (−cost) and picking up (+cost) move the known amount. Same check at the `WorldSim` level summing mochilas + tumbas + Puestos.
- **[D] Separate message `stallPlace`** instead of a new `StructureKind`: the Puesto is not a `Structure` (no hp, no siege target), and adding a kind would force entries in every `Record<StructureKind, …>` table.
- **[D] Changing a shelf's `give` while it has stock is refused** ("Quita el género primero."): otherwise stock would silently turn into another material. Changing `n`, `want`, `m` is always free.
- **[D] Reponer adds one tanda (`n` units)** per tap, capped by 60 per shelf and 120 per Puesto; Quitar returns the whole shelf.
- **[D] Where:** on dry land inside the map (`|x|,|z| ≤ HALF`, so never in the off-map dungeons/tower), within `BUILD_REACH`, ≥ 15 m from another Puesto, ≥ 1,5 m from any structure. **Not** limited to the forest (§5.4 wants Puestos in every biome).
- **[D] `stall` events go to everyone** (3–4 players; the 60 m filter of §10.2 is not worth it yet).
- **[D] Shelf default:** `{ mode: 'sell', give: 'wood', n: 1, want: 'berries', m: 1, stock: 0 }`.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## File Structure

- Create `src/shared/shop.ts` + `shop.test.ts`, `src/shared/sim/world-sim-t6a.test.ts`, `src/client/stall-ui.ts` + `.test.ts`, `src/client/scene/stalls.ts`.
- Modify `src/shared/names.ts`, `src/shared/protocol.ts` (+ test), `src/shared/sim/world-sim.ts`, `src/client/game.ts`, `src/client/hud.ts`, version tests (58 → 59).

## Tasks

### Task 1: pure rules — `shop.ts` and conservation

```ts
export const STALL = { cost: { wood: 8, stone: 4 }, shelves: 4, shelfMax: 60, totalMax: 120, tillMax: 200, wantMax: 2, reach: 4, apart: 15, nMax: 20 } as const;
export interface Shelf { mode: 'sell' | 'want'; give: ItemId; n: number; want: ItemId; m: number; stock: number; escrow?: number }
export interface Stall { id: number; owner: string; x: number; y: number; z: number; rot: number; shelves: Shelf[]; till: Inventory; log: Sale[] }
export type ShopResult = { ok: true; stall: Stall; inv: Inventory } | { ok: false; why: string };
export function newStall(id, owner, x, y, z, rot): Stall;
export function setShelf(s: Stall, i: number, give: ItemId, n: number, want: ItemId, m: number, inv: Inventory): ShopResult;
export function restock(s: Stall, i: number, inv: Inventory): ShopResult; // + one tanda
export function takeShelf(s: Stall, i: number, inv: Inventory): ShopResult;
export function pickUp(s: Stall, inv: Inventory): Inventory; // shelves + till + cost back
export function stallGoods(s: Stall): Inventory; // stock + escrow + till
export function canPlaceStall(stalls: Stall[], owner: string, x: number, z: number): string | null;
```

- [ ] **Step 1: failing tests.** A new stall has 4 empty sell shelves; `setShelf` validates `give ≠ want`, 1 ≤ n, m ≤ 20 and integer, the shelf index, and refuses a new `give` with stock; `restock` moves `n` from the mochila, refuses without enough ("No te llega la madera."), past 60 per shelf or 120 total; `takeShelf` returns all; `pickUp` returns shelves + till + cost; `canPlaceStall` refuses a second Puesto of the same owner and one closer than 15 m; inputs are never mutated; **property test:** 500 seeded random sequences of 40 ops (set / restock / take, valid and invalid) keep `inv + stallGoods` constant per material; after `pickUp`, `inv` = start + cost.
- [ ] **Step 2: implement.**
- [ ] **Step 3:** green, self-review, commit `feat(tiendas): reglas puras del Puesto y conservación`.

### Task 2: server — stalls in the world (protocolo v59)

- [ ] **Step 1: failing tests** (`world-sim-t6a.test.ts`, `protocol.test.ts`). Protocol 59; `decodeClient` accepts the 5 messages and rejects bad shelves, amounts, items; `stallPlace` with materials builds a Puesto (−8 madera −4 piedra, event `stall` to everyone, `welcome.stalls` has it); a second one → "Ya tienes un puesto."; in water / off-map / too far / near another Puesto → refused, nothing spent; `stallSet`/`stallStock`/`stallTake` only by the owner within 4 m (others: nothing changes); `stallPick` gives everything back and removes it (`gone: true`); save → load keeps the Puesto; an old save without `stalls` loads; a raid never targets a Puesto (not in `structures`); **property test** over `handle()`: random stall messages from owner and a stranger keep mochilas + tumbas + Puestos constant, except place/pick by exactly the cost.
- [ ] **Step 2: implement** (`stalls` array, `onStallPlace`, `onStallSet`, `onStallStock`, `onStallTake`, `onStallPick`, save/load, welcome).
- [ ] **Step 3:** green (adapt 58 → 59 in the version tests, noted), self-review, commit `feat(tiendas): el Puesto en el servidor (protocolo v59)`.

### Task 3: client — mesh, Menú, A and the owner's panel

- [ ] **Step 1: failing tests.** `stall-ui.ts`: `stallHtml(stall, inv)` shows "Puesto de Ana", 4 rows "Vendo 1 madera por 1 bayas · quedan 0", buttons `give-i`, `n-i-dec/inc`, `want-i`, `m-i-dec/inc`, `stock-i` ("Reponer +1", disabled without enough), `take-i` (disabled at 0), `pick`, `back`; `nextItem` cycles the 7 materials; `stallAction(pos, stalls, me)` returns own / other / null by distance 4.
- [ ] **Step 2: implement.** `StallMeshes` (1 merged geometry, 1 material, a collider circle); `welcome`/`stall` events update them; Menú button "Poner puesto" (only without one); A → panel (owner) or toast (others); panel taps send the messages and redraw on the next `stall` event.
- [ ] **Step 3:** green, self-review, commit `feat(tiendas): el Puesto en el cliente`.

### Task 4: Ship

- [ ] Full suite green; push; HANDOFF: "## Tiendas · T6-A — …"; one short comment on PR #3.
