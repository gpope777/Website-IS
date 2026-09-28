# Pulido · P7-C: UI y textos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** row P7-C of the spec's plan map (§14). (1) **Quantities read right**: one `qty(n, item)` in `src/shared/names.ts` ("1 perla / 3 perlas", "1 espina negra / 2 espinas negras", "2 de ámbar", "1 cuarzo / 2 cuarzos") and `costText(inv)`; every text with a number + material goes through them (stalls, sales, Buhonero, Encargos, trueque, server toasts, costs, the bag), and a grep test fails on a hand-built plural. (2) **Phone HUD**: `env(safe-area-inset-*)` everywhere, the bag line leaves the screen for a **🎒 button** by MENÚ (grid of 7 materials with icon + number, Arma, Capa, Rango), **toasts ≤ 3**, newest on top, 4 s, repeats grouped ("Madera +1 ×3"); vitals show the number only under 50; the 🌳 bar only in a raid or when the Heart is hurt; one top-right line (jefe > asedio > carrera). (3) **Pills by progress** in **10 fixed slots** (a hidden pill leaves its gap; never reorder), **52 px** minimum, A/B 76 px. (4) **Tabbed Menú** — `Jugar · Libro · Ajustes · Ayuda · Salir`, 44 px tabs, remembers the last tab; every current button moves in (Seguir, fogata trips, mount calls, trap, raids toggle, Puesto, Puestos, Libro, Oficios, Aspecto, camera, quality, shake, vibration, sound). (5) **Ayuda by topic**, only what you have discovered, with the controls of the device in use. (6) **Accessibility**: text size Normal / Grande (×1.25 via a CSS variable), shape marks for colour-blind players (on by default), camera sensitivity. (7) **Cleaner death panel**: "Has caído." + cause + the revive countdown as a bar + a big Reaparecer, world visible behind (blurred on medium/high, grey veil on low).

**Architecture:** pure and tested: `src/shared/names.ts` (`ITEM_FORMS`, `qty`, `costText`), `src/client/settings.ts` (new fields), `src/client/hud-model.ts` (pill visibility, toast queue, top line priority, vital label, bag rows, death cause, discovery flags), `src/client/menu-ui.ts` (tab HTML builders: Jugar, Libro, Ajustes, Ayuda, Salir; help cards by topic and device). Wiring: `hud.ts` (tabs, 🎒, toasts, death), `touch.ts` (slots, 🎒 button), `game.ts` (feeds the models), `style.css`.

**Tech Stack:** TypeScript, DOM/CSS, Vite, Vitest 4, Playwright (screenshots only, not in `npm test`).

**Spec:** `docs/superpowers/specs/2026-09-28-pulido-design.md` §5.1–5.6, §6, §10.1 (plural), §14 (P7-C).

## Global Constraints

- **No gameplay, balance or protocol change.** `PROTOCOL_VERSION` stays 63. Server changes are text only (toasts through `qty`).
- **Touch grid ≤ 10 pills**, fixed positions. 🎒 is a system button next to MENÚ, not a pill.
- Nothing new in the 3D scene (perf harness must stay equal); everything is DOM/CSS.
- Tests that pinned "1 perlas" are updated to "1 perla" (intended text change, noted in the HANDOFF). No test deleted or weakened.
- Spanish player-facing text, dry voice. `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## Decisions (Decidido por Claude — revisar)

- **[D] Item forms** live in `names.ts` next to the proper names (`ITEM_FORMS: Record<ItemId, [one, many]>`): madera/madera, piedra/piedra, baya/bayas, perla/perlas, ámbar/"de ámbar", cuarzo/cuarzos, espina negra/espinas negras. Madera and piedra stay uncountable ("3 madera", as the game always said). `ITEM_LABELS` stays for column headers (capitalised plural) but no longer builds quantities.
- **[D] Grep test** (`src/shared/plural.test.ts`): scans `src/**/*.ts` (not tests) for `${…} <material word>` and `${…} ${NAMES.pearl|amber|quartz|thorn}` / `ITEM_LABELS[…]` after a number; an allow-list is empty at the end of T1.
- **[D] Pills by progress** (spec §5.1), fixed slots in today's order: 🫐 once you have had berries (or rank > 1); 🔥 once you have had wood; 🧱 and 🗡️ when the world has a Heart; 🌳 only when it has none; 🌀 🛡️ 🏹 🎯 once you have seen a wolf close (≤ 40 m) or rank > 1; 🌿 with any power. "Once" = a per-device discovery set in `localStorage['bosque.seen']` (the same set Ayuda reads; P7-D/F can reuse it). Veterans (rank > 1 or any orb) see everything at once.
- **[D] Toasts:** ≤ 3, 4 s, newest on top; the same text within its 4 s bumps a "×N" instead of stacking. Gathering toasts from the server are not ours to reword (`+1` floaters need protocol), so they simply group.
- **[D] Top-right line:** one line, jefe > asedio > carrera.
- **[D] Vitals:** number shown only under 50; the 🌳 Heart bar only during a raid or below full HP.
- **[D] Menú tabs:** Jugar (Seguir, trips, calls, trap, raids, Puesto, Puestos) · Libro (Libro, Oficios, Aspecto) · Ajustes (quality, camera, sensitivity, shake, vibration, sound, text size, marks) · Ayuda · Salir (confirm). Last tab in `settings.tab`. The Oficios/Aspecto/Libro/Puestos screens keep their own panels and "Volver" returns to the Menú.
- **[D] Ayuda topics:** Moverse (always), Pelear (wolf seen), Poderes (a power), Monturas (a mount), Corazón y asedios (a Heart), Santuarios y zonas (an orb), Mazmorras (entered one), Fogatas (a lit fogata), Tiendas (a stall exists or the Buhonero seen), El Marchito (met). Touch shows pill icons and A/B; PC shows keys. Nothing about places you have not reached.
- **[D] Death cause** without protocol: pure guess from what the client saw — a hurt in the last 3 s → "Te mordieron."; warmth 0 → "El frío."; hunger 0 → "El hambre."; otherwise "El terreno." Wrong guesses are cheap; a real cause needs protocol (P7-D/F can add it).
- **[D] Shape marks** (on by default): taming ring zone dashed + ▲ tick, Oficios ✔ / 🔒 and shelves ✔ / ✕ text marks, low vitals get a ! glyph, boss/raid lines prefixed with a shape. 3D markers (Marchito sprouts ▲●■) are **not** in P7-C (they are in the scene; left for P7-E with the other 3D fixes).
- **[D] Text size** Grande = `--ui-scale: 1.25` on `#app` (HUD, panels, pills' labels, toasts).
- **[D] Sensitivity** 0.5×–2× (steps of 0.25) multiplies `rig.look`.

## File Structure

- Modify `src/shared/names.ts` (+`names-qty.test.ts`), `src/shared/items.ts`, `src/shared/shop.ts`, `src/shared/sim/world-sim.ts` (texts only), `src/client/{stall,trade,merchant,coast,swamp,skills}-ui.ts`, their tests (text updates).
- Create `src/shared/plural.test.ts`, `src/client/hud-model.ts` (+test), `src/client/menu-ui.ts` (+test).
- Modify `src/client/settings.ts` (+test), `src/client/hud.ts`, `src/client/touch.ts`, `src/client/game.ts`, `src/client/style.css`.

## Tasks

### Task 1: `qty`, `costText` and the text sweep

```ts
// names.ts
export const ITEM_FORMS: Record<'wood'|'stone'|'berries'|'pearl'|'amber'|'quartz'|'thorn', readonly [string, string]>;
export function qty(n: number, item: ItemId): string;          // "1 perla", "3 perlas", "2 de ámbar"
export function itemWord(n: number, item: ItemId): string;      // just the word
export function costText(cost: Partial<Record<ItemId, number>>): string; // "8 madera, 4 piedra"
```

- [x] **Step 1: failing tests.** `qty` for every item at 0, 1, 2 (0 is plural: "0 perlas"); thorn follows `NAMES.thorn`; `costText` keeps key order and skips zeros; the grep test flags a sample hand-built plural and passes on the tree.
- [x] **Step 2: implement and sweep.** `shop.ts` "No te llega/Te falta", world-sim sales, deals, deliveries, trades, chest, amber/quartz yields, orb gifts, thorns, "Hacen falta N bayas"; `stall-ui`, `trade-ui`, `merchant-ui`, `coast-ui`, `swamp-ui`, `skills-ui`, the Puesto cost in the Menú. Update the tests that pinned "1 perlas".
- [x] **Step 3:** green, commit `feat(pulido): qty() y cantidades en singular o plural en todos los textos`.

### Task 2: pure UI models and settings

```ts
// settings.ts: Settings += { text: 'normal' | 'grande'; marks: boolean; sens: number; tab: MenuTab }
// hud-model.ts
export const PILLS = ['eat','campfire','wall','heart','trap','roll','block','bow','lock','power'] as const;
export interface Progress { heart: boolean; power: boolean; seen: Set<Seen>; veteran: boolean }
export function pillsShown(p: Progress): boolean[];              // length 10, fixed order
export class Toasts { push(text: string, now: number): void; tick(now: number): { text: string; n: number }[] } // ≤3, 4 s, grouped
export function topLine(boss: string | null, raid: string | null, race: string | null): string | null;
export function vitalLabel(v: number): string;                   // '' at ≥ 50
export function heartShown(h: { hp: number; max: number } | null, raid: boolean): boolean;
export function bagRows(inv, weapon, capa, rank): { icon: string; label: string; n: string }[];
export function deathCause(o: { lastHurtAgo: number; warmth: number; hunger: number }): string;
export function discover(seen: Set<Seen>, view: DiscoverView): Seen[]; // newly seen flags
// menu-ui.ts
export const MENU_TABS: { id: MenuTab; label: string }[];      // Jugar, Libro, Ajustes, Ayuda, Salir
export function helpCards(seen: Set<Seen>, touch: boolean): { title: string; lines: string[] }[];
export function tabsHtml(active: MenuTab): string;
```

- [x] **Step 1: failing tests.** Settings parse/clamp (sens 0.5–2, bad text → normal). `pillsShown`: new player = none; berries → 🫐 only in slot 0; heart → 🧱 🗡️ and no 🌳; wolf → four combat pills; veteran → all but 🌳 with a Heart; always length 10. `Toasts`: 4th push drops the oldest; same text → n 2; expires at 4 s. `topLine` priority. `vitalLabel`. `heartShown`. `bagRows` skips zeros and uses `qty` words. `deathCause` each branch. `discover`. `helpCards`: new player only Moverse; touch mentions 🌀 not "Q"; PC mentions "Q"; no card names a place not seen (no "Pantano" before `swamp`).
- [x] **Step 2: implement.** **Step 3:** green, commit `feat(pulido): modelos puros del HUD, Ayuda por temas y ajustes nuevos`.

### Task 3: HUD, 🎒, toasts, pills, death panel, text size, marks

- [x] **Step 1:** `hud.ts`: inventory line → 🎒 panel (`showBag`), toasts through `Toasts` (≤ 3, ×N), one top-right line, vitals via `vitalLabel`, Heart row via `heartShown`, new death panel (cause, bar, big button, `.dead` class on the overlay for the blur/veil), `setScale`, `setMarks`. `touch.ts`: `setPills(boolean[])` hides with `visibility:hidden` (slot kept), 🎒 system button. `style.css`: safe-area insets on `.hud` children and `.touch-*`, pills 52 px, A/B 76 px, `--ui-scale`, `.marks` rules, death styles. `game.ts`: `discover` each snapshot → save `bosque.seen`; pills; 🎒 → bag; `I`-free key for the bag on PC? (**no new key**: 🎒 is in the Menú › Jugar on PC); death cause.
- [x] **Step 2:** green, commit `feat(pulido): HUD de móvil: zonas seguras, mochila 🎒, avisos agrupados, pastillas por progreso y muerte`.

### Task 4: tabbed Menú, Ayuda, Ajustes; screenshots and perf

- [x] **Step 1:** `showMenu` rebuilt on `menu-ui.ts`: tabs bar (44 px), one tab body at a time, all old buttons migrated, Salir with confirm, Ajustes with text size / marks / sensitivity / camera, Ayuda with `helpCards`. Sub-screens (Libro, Oficios, Aspecto, Puestos) get "Volver" to the Menú. Remember the tab.
- [x] **Step 2:** screenshots (Playwright, `npm run dev:server`-style build + wrangler) at 390×844 and 844×390: HUD, 🎒, each tab, death panel; look at them and fix what overlaps. Perf: `npm run perf -- --tier low` equal to base.
- [x] **Step 3:** green, commit `feat(pulido): Menú con pestañas (Jugar, Libro, Ajustes, Ayuda, Salir) y Ayuda por temas`.

### Task 5: Ship

- [x] HANDOFF "## Pulido · P7-C — …" (Decidido por Claude — revisar, Qué probar, NO verificado, tests updated, perf); push; one short comment on PR #3.
