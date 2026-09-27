# Tiendas · T6-B: Comprar, Caja y registro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the second plan of subproject #6 (spec §3.3, §3.4, §5.4 "Mapa del Menú", §7, row T6-B of §11). Anyone but the owner **buys** one tanda from a Vendo shelf; the pay lands in the **Caja** (cap 200); the owner **vacía la Caja** with A; the Puesto keeps the **last 10 sales**, and an owner who was away hears "Tu puesto vendió N veces desde que te fuiste." when they connect; the buyer's panel; the Puestos listed in the Menú with what they sell; 1 purchase every 0,5 s per player. Conservation tests extended to buy / till / empty from several players.

**Architecture:** `shop.ts` gains pure `buy(s, i, inv, who, day)` and `collectTill(s, inv)` (same `ShopResult`, never mutate), `tillTotal`, `canBuy` and `LOG_MAX = 10`. `WorldSim` gets `onBuy` (reach, not owner, rate, then the pure op) and `onStallTill`; a sale bumps `SavedPlayer.soldSince` of an owner who is not in `live`, and `connect` turns it into a toast and resets it. `stall-ui.ts` gains `buyHtml(s, inv, me)` and `stallListHtml(stalls, pos)`.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-tiendas-design.md` §3.3, §3.4, §5.4, §7, §10.2, §11 (T6-B).

## Global Constraints

- Spanish, dry voice. No new names needed (`stall`, `till` already in `names.ts`).
- **No new pills.** A beside someone else's Puesto opens the buy panel (was a toast); A beside your own opens the owner panel, which now shows the Caja, "Vaciar caja" and the log. Menú gets one button "Puestos" (only when there is at least one).
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 59 → 60. New client messages through `decodeClient`: `buy {stall, shelf}` (stall a non-negative integer id), `stallTill {}`. New optional saved field `SavedPlayer.soldSince?: number`. No new server message: results are the existing `stall` event + `toast`. Old saves load unchanged.
- **Conservation is the core rule.** `buy` / `collectTill` check everything then apply everything; failure changes nothing. Pure property test: random sequences of set / restock / take / buy (by several buyers, each with its own mochila) / collectTill keep `Σ mochilas + stallGoods` constant per material, the Caja never exceeds 200, no mochila goes negative. Same over `handle()` with Ana (owner), Bea and Cai (buyers).
- **[D] Till cap check:** a sale is refused when `tillTotal + m > 200` ("Caja llena."), so the Caja never exceeds 200 (never partially fills).
- **[D] The owner cannot buy from their own Puesto** ("Es tu puesto."); it would be a free Quitar that fills the Caja.
- **[D] Log entry:** `{ who, give, n, want, m, day }`, newest first, 10 kept; `day` = game day (`floor(time / DAY_LENGTH) + 1`).
- **[D] "Aviso al conectar" is a toast on `connect`**, not a Libro entry (the spec says "resumido, en el Libro"; a toast is the simplest place the owner is sure to see; the log is in the panel anyway). Only counts sales while the owner was not connected.
- **[D] Rate limit uses sim time** (`live.buyReadyAt`, not saved): calls faster than 0,5 s are ignored silently.
- **[D] "Puntos en el mapa":** the Menú has no map today; the Menú gets a **"Puestos"** list instead — "Puesto de Ana · vende perlas, madera · 40 m al norte". A real map is not in scope.
- **[D] Owner online toast:** "Bea compró 1 perlas en tu puesto." (fixed plural, like T6-A).
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## File Structure

- Modify `src/shared/shop.ts` + `shop.test.ts`, `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`, `src/client/stall-ui.ts` + `.test.ts`, `src/client/game.ts`, `src/client/hud.ts`, version tests (59 → 60).
- Create `src/shared/sim/world-sim-t6b.test.ts`.

## Tasks

### Task 1: pure rules — `buy`, `collectTill` and conservation with several players

```ts
export const LOG_MAX = 10;
export function tillTotal(s: Stall): number;
export function canBuy(s: Stall, i: number, inv: Inventory): string | null; // null = ok, else why
export function buy(s: Stall, i: number, inv: Inventory, who: string, day: number): ShopResult; // inv = buyer's
export function collectTill(s: Stall, inv: Inventory): ShopResult;
```

- [x] **Step 1: failing tests.** `buy` moves `m` want from the buyer into the Caja and `n` give from the shelf to the buyer, logs the sale first; refuses: bad index, empty/short shelf ("No queda."), buyer short ("No te llega: bayas."), Caja would pass 200 ("Caja llena."), and changes nothing; log keeps 10; inputs not mutated. `collectTill` moves the whole Caja to the mochila, refuses when empty. **Property test:** 300 seeded runs × 60 ops over one stall and three mochilas (owner set/restock/take/collect; buyers buy) keep the sum constant, till ≤ 200, all counts non-negative integers.
- [x] **Step 2: implement.**
- [x] **Step 3:** green, self-review, commit `feat(tiendas): comprar y Caja, reglas puras`.

### Task 2: server — buy, Caja, log, notice, rate (protocolo v60)

- [ ] **Step 1: failing tests** (`world-sim-t6b.test.ts`). Protocol 60; `decodeClient` accepts `buy`/`stallTill`, rejects bad ids/shelves; Bea beside Ana's Puesto buys: mochilas and Caja move, `stall` event, toast to Bea and to Ana (online); too far / own Puesto / unknown id / short → toast, nothing moves; two buys in the same 0,5 s → only one; Ana away (not connected): the sale bumps `soldSince`, on `connect` she gets "Tu puesto vendió 2 veces desde que te fuiste." and it resets; `stallTill` by the owner beside it empties the Caja, by others nothing; `soldSince` survives save/load; **property test** over `handle()` with Ana, Bea, Cai (buy / stallTill / stallStock / stallSet / stallTake, time advancing randomly) keeps mochilas + tumbas + Puestos constant and Caja ≤ 200.
- [ ] **Step 2: implement** (`onBuy`, `onStallTill`, `buyReadyAt` in `Live`, `soldSince`, connect notice).
- [ ] **Step 3:** green (adapt 59 → 60 in version tests, noted), self-review, commit `feat(tiendas): comprar y Caja en el servidor (protocolo v60)`.

### Task 3: client — buyer's panel, Caja in the owner panel, Puestos in the Menú

- [ ] **Step 1: failing tests** (`stall-ui.test.ts`). `buyHtml(s, inv)`: "Puesto de Ana", a row per shelf with stock "1 perlas por 6 bayas · quedan 3" and `buy-i` (disabled when short / empty / Caja llena, with the reason), empty shelves hidden, "No vende nada." when none; `stallHtml` shows "Caja: 12 bayas", `till` button (disabled when empty) and the log lines "Bea · 1 perlas · 6 bayas · día 14"; `stallListHtml(stalls, pos)` lists "Puesto de Ana · vende perlas · 40 m al norte".
- [ ] **Step 2: implement.** A beside another's Puesto → buy panel (redraws on `stall`); owner panel gets Vaciar caja; Menú "Puestos" button → the list.
- [ ] **Step 3:** green, self-review, commit `feat(tiendas): comprar en el cliente y lista de puestos`.

### Task 4: Ship

- [ ] Full suite green; push; HANDOFF: "## Tiendas · T6-B — …"; one short comment on PR #3.
