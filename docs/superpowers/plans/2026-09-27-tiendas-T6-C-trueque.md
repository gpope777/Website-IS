# Tiendas · T6-C: Trueque directo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the third plan of subproject #6 (spec §4, §7, §10.2, row T6-C of §11). A beside another player (≤4 m, nothing more important under A) → **Cambiar**; the other gets "Ana quiere cambiar." with **Ver** / **No**. A two-column window: each puts **up to 3 lines** (material + cantidad) from their mochila; **Vale**; any change by either clears both Vale; with both Vale the server re-checks everything and applies the four operations at once, or cancels touching nothing. Cancelled when someone moves >6 m away, dies, disconnects, enters a dungeon or 60 s pass. The world row is **saved right after** a trade. Rate: 1 request every 5 s; after 3 "No" in a row from the same player, 60 s before asking them again.

**Architecture:** `shop.ts` gains `TRADE`, `TradeLine`, `linesOk`, `offerInv` and pure `trade(a, b, la, lb)` (never mutates; all or nothing). `WorldSim` keeps live-only `trades` (never saved: a reload simply has no open trade), handlers `onTradeAsk/Answer/Offer/Ok/Cancel`, a per-step `checkTrades()` (distance, death, away, dungeon, timeout), cancels in `markAway` and `kill`, and a `takeSave()` flag the room reads after `handle()` to `persist()` at once. New `src/client/trade-ui.ts` (`tradeTarget`, `tradeHtml`) and the window in `game.ts`.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-tiendas-design.md` §4, §7, §10.2, §10.5, §11 (T6-C).

## Global Constraints

- Spanish, dry voice. `NAMES.trade = 'Cambiar'` already exists.
- **No new pills.** Cambiar is the last choice of the contextual A (after everything else, including harvesting); the window is an HTML overlay like the Puesto panel.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 60 → 61. New client messages via `decodeClient`: `tradeAsk {to}` (NAME_RE), `tradeAnswer {yes: boolean}`, `tradeOffer {lines: TradeLine[]}` (≤3, distinct materials from `ITEMS`, integer 1–99), `tradeOk {}`, `tradeCancel {}`. New server message `trade {tr: TradeView | null}` to each side. No new saved fields; old saves load unchanged.
- **Conservation is the core rule.** Only the 7 materials can be offered (the decoder only accepts `ItemId`); `trade` checks both mochilas then applies both; failure changes nothing. Property test over `handle()` with 2–3 players doing random ask/answer/offer/ok/cancel/move/away/connect/die: per-material totals (mochilas + tumbas + Puestos) constant after every step; every player's mochila changes only by a whole accepted trade (never a part); counts never negative.
- **[D] Offers are checked when made** ("No tienes tanto.") and again at the close (the mochila may have changed: eating, building, buying).
- **[D] The 60 s run from the request**, open window included; the spec says "pasan 60 s" without more.
- **[D] Distinct materials per side** (3 lines = 3 different materials) and 1–99 per line: simplest valid form; the UI adds up with + anyway.
- **[D] Trades are live-only**: a room restart cancels them (nothing moved until the close, so nothing is lost).
- **[D] "No" counter** is per asker → target, live-only; it resets on a "Ver" and after the 60 s wait.
- **[D] Only being dead or in a dungeon blocks a trade**; riding is fine (the 6 m leash is the only movement rule).
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## File Structure

- Modify `src/shared/shop.ts` + `shop.test.ts`, `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`, `src/server/world-room.ts`, `src/client/game.ts`, version tests (60 → 61).
- Create `src/shared/sim/world-sim-t6c.test.ts`, `src/client/trade-ui.ts` + `trade-ui.test.ts`.

## Tasks

### Task 1: pure rules — `trade`

```ts
export const TRADE = { reach: 4, leash: 6, lines: 3, nMax: 99, timeout: 60, askEvery: 5, noMax: 3, noWait: 60 } as const;
export interface TradeLine { item: ItemId; n: number }
export function linesOk(lines: unknown): lines is TradeLine[];
export function offerInv(lines: readonly TradeLine[]): Inventory;
export function trade(a: Inventory, b: Inventory, la: readonly TradeLine[], lb: readonly TradeLine[]): { ok: true; a: Inventory; b: Inventory } | { ok: false; side: 0 | 1; item: ItemId };
```

- [x] **Step 1: failing tests** (`src/shared/trade.test.ts`). `linesOk`: ≤3, distinct, items only, integers 1–99, rejects objects with extra junk types; `trade` swaps, gifts (one side empty) work, short side refused with which side/item, inputs not mutated. **Property:** 500 seeded random pairs of mochilas and offers: `a+b` per material constant, either both change exactly by the offers or neither changes, never negative.
- [x] **Step 2: implement.**
- [x] **Step 3:** green, self-review, commit `feat(tiendas): trueque, reglas puras`.

### Task 2: server — ask/answer/offer/ok/cancel (protocolo v61)

- [x] **Step 1: failing tests** (`world-sim-t6c.test.ts`). Protocol 61; decoder accepts/rejects the five messages (4 lines, duplicate material, `rank`/`hat` as items, n 0/100/1.5, bad names). Ana asks Bea at 3 m → both get `trade` views, Bea's "asked"; too far (5 m) / self / unknown / Bea already trading → toast, no trade; second ask within 5 s ignored; Bea says No 3 times → Ana can't ask Bea for 60 s ("Bea no quiere cambiar ahora."), can ask Cai. Ver → open; offers set lines and clear both Vale; offering more than you have refused; both Vale → mochilas swap, `trade null` to both, "Hecho." toasts, `takeSave()` true once; Vale with a mochila that shrank since → cancelled, nothing moves. Cancels: Bea walks to 7 m, dies, goes away (`markAway`), enters a dungeon, 60 s pass, `tradeCancel` → `trade null` + toast to the other, nothing moves. **Property:** 40 runs × 120 steps with Ana, Bea, Cai (random ask/answer/offer/ok/cancel, moves of ±4 m, markAway/connect, kill, time jumps): totals constant; each mochila equals before, or before ± a whole accepted trade; counts non-negative integers.
- [x] **Step 2: implement** (`trades`, handlers, `checkTrades` in `step`, cancels in `markAway`/`kill`, `takeSave`; room: `if (sim.takeSave()) persist()` after `handle`).
- [x] **Step 3:** green (60 → 61 in version tests, noted), self-review, commit `feat(tiendas): trueque en el servidor (protocolo v61)`.

### Task 3: client — Cambiar and the two-column window

- [ ] **Step 1: failing tests** (`trade-ui.test.ts`). `tradeTarget(pos, others)` → nearest living, non-away player ≤4 m or null; `tradeHtml(tr, inv)`: asked → "Ana quiere cambiar." + `yes`/`no`; waiting → "Esperando a Bea…" + `cancel`; open → two columns "Tú das" / "Bea da", my lines with `dec-i`/`item-i`/`inc-i`/`del-i`, `add` (hidden at 3 lines or when nothing left to add), their lines as text ("3 perlas"), "Nada." when empty, `ok` ("Vale", disabled after my Vale), status "Bea: Vale." and `cancel`. `nextLine` helpers: add the first material I have that isn't already a line; cycle a line's material through the ones I have.
- [ ] **Step 2: implement.** A: after harvest, `tradeTarget` → `tradeAsk`; `trade` message → store, show/redraw the window (or close it when null); each tap sends a full `tradeOffer`.
- [ ] **Step 3:** green, self-review, commit `feat(tiendas): ventana de trueque en el cliente`.

### Task 4: Ship

- [ ] Full suite green; push; HANDOFF: "## Tiendas · T6-C — …"; one short comment on PR #3.
