# Pulido · P7-D: Guía — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** row P7-D of the spec's plan map (§14), spec §7 and §9. (1) **"Qué sigue"**: one line at the top centre with **icon + what + where** ("✨ Santuario del Bosque · 120 m ↗"), dimmed to 40 % after 8 s without change, full again on tap (tap opens Ayuda); a small **arrow on the screen edge** points at the target while it is off screen. (2) The step comes from a **pure `nextStep(view)` in `src/shared/guide.ts`** over an ordered list of ~30 story steps (5 biomes + post-game), each marked **world** (shared: done by anyone counts) or **player** (your orb, your power, your mount). First not-done wins; secondaries (oficio points, full moon, a purple zone near you) only when the story has nothing left or nothing better near. "(Bea está allí)" when a friend is ≤ 30 m from the target. (3) **First-time tips**: a one-line tip under the tracker for 6 s, once per device, ~25 of them, switchable in Ajustes. (4) **"New" dots (●)** on the Menú tabs and on a pill that just appeared, until tapped. (5) **"El eco del bosque"**: returning after > 30 min, a 3-line card of what **others** did (and what your Puesto sold), fed by a 20-event in-memory log in the DO.

**Architecture:** pure and tested: `src/shared/guide.ts` (steps, `nextStep`, `bearing`, `edgeArrow`), `src/shared/echo.ts` (event log + `echoLines`), `src/client/guide-model.ts` (tips, dots, dim timer). Server: `world-sim.ts` gains `snap.story`, the echo log, `SavedPlayer.left` and the `echo` message. Wiring: `game.ts` builds the `GuideView` from the snapshot + seed places, `hud.ts` draws the line / arrow / tip / card, `menu-ui.ts` and `touch.ts` draw dots, `settings.ts` gets `guide` and `tips`.

**Tech Stack:** TypeScript, DOM/CSS, Vite, Vitest 4, Playwright (screenshots only).

**Spec:** `docs/superpowers/specs/2026-09-28-pulido-design.md` §5.1 (arriba centro), §6 (Mostrar "Qué sigue", Consejos), §7, §9, §14 (P7-D).

## Global Constraints

- **No gameplay, balance or rule change.** The server only *reports* (a `story` summary and the echo log); nothing it simulates changes.
- **Protocol:** the spec's map says "campos en 63", but 63 already shipped in P7-A. New fields are optional, but the repo bumps on every wire change, so **63 → 64** once for `snap.story`, the `echo` message and `SavedPlayer.left` (optional: old saves load and simply get no echo the first time). P7-F's tutorial then takes **65** (noted in the HANDOFF).
- **Touch grid ≤ 10**: no new pill. The line and the arrow are DOM (0 draw calls); nothing new in the 3D scene, so the perf harness must stay equal.
- Spanish player-facing text, dry voice, no exclamations. Tests pinning `PROTOCOL_VERSION` 63 move to 64 (intended). No test deleted or weakened.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## Decisions (Decidido por Claude — revisar)

- **[D] What the client lacks today** (and `snap.story` adds): whether Invasions 1–3 are none / owed / over, the Tragón taken vs rescued, and which of the 4 bosses are purified (the white allies only show while the Heart lives). `story: { inv: [0|1|2, 0|1|2|3, 0|1|2]; bosses: [b, b, b, b] }` (inv2: none, owed, taken, rescued). Everything else (orbs, powers, mounts, whale, Zarzal, Escalera, fog, pillars, towerOpen, ending, corrupt zones, fogatas) already arrives.
- **[D] Places** are pure seed data the client already builds (`generateShrines`… `generateEntrance`, `coastEntrance`, `swampEntrance`, `mountainEntrance`, `wildFish`, `wildFrog`, `generateWild`, `picoOf`, `rescueSite`, `pillarSites`, `cenizaFogata`, `TOWER`, `UMBRAL`, `ZARZAL_KNOT`, `estrellaAt`). `nextStep` takes them in a `Places` record so tests use fake coordinates.
- **[D] The steps** (W = world, P = player; first not done wins):
  1 🌳 Planta el Corazón (W) · 2 ✨ Santuarios del Bosque, nearest missing (P) · 3 🌀 Entra en la Raíz-madre (W: forest boss) · 4 🌿 Coge la Enredadera (P) · 5 🦌 Doma el ciervo (P) · 6 🌑 Aguanta la Invasión (W, owed) · 7 🐟 Doma el pez (P) · 8 ✨ Santuarios de la Costa (P) · 9 🌑 Invasión 2 owed → "Vuelve al Corazón antes del atardecer" / taken → "Rompe las anclas de la jaula" (W) · 10 🐋 Doma la ballena, con alguien (W) · 11 🌬️ Mazmorra de la Costa: el Viento (P) · 12 🦗 Vence a El Antenón (W) · 13 🐸 Doma la rana (P) · 14 ✨ Santuarios del Pantano (P) · 15 🔥 Mazmorra del Pantano: el Fuego (P) · 16 🦟 Vence a El Zancudo (W) · 17 🔥 Quema el nudo del Zarzal (W) · 18 ✨ Santuarios de la Montaña (P) · 19 🪨 Mazmorra de la Montaña: la Piedra (P) · 20 🍦 Vence a El Cucurucho (W) · 21 🪜 Levanta la Escalera del Umbral (W) · 22 🐉 Doma el dragón en la tormenta (P) · 23 🌫️ Abre la niebla con el dragón (W) · 24 🔥 Enciende la fogata de la Ceniza (W) · 25 🌳 Rompe los Pilares-raíz, nearest (W) · 26 🌑 Aguanta la Invasión 3 (W) · 27 🗼 Sube a la Torre (W: ending) · 28 ⭐ Doma la Estrella en luna llena (P, after the ending) — 28 story steps; with the two-state invasion lines it reads as ~30 lines. After the last: secondaries only, or nothing.
- **[D] Secondaries** (max one, only when no story step or the story target is > 300 m and a secondary is closer): "Tienes N puntos de oficio (Menú › Libro)" · "Luna llena esta noche" · the nearest purple zone within 150 m. No "Tu Caja tiene…" (the Caja count does not reach the client; not worth protocol).
- **[D] Rumbo** = distance + an arrow **relative to the camera** (↑ ↗ → ↘ ↓ ↙ ← ↖), not a compass: there is no map to read N from. Under 8 m: "aquí". Target inside a dungeon: the door.
- **[D] Edge arrow**: a DOM `▲` rotated, clamped to a rectangle 24 px inside the safe area, shown only when the target is off screen or behind; pure `edgeArrow(ndc, behind)`.
- **[D] Tips**: ~25, keyed by the P7-C `Seen` flags plus a few client triggers (night, cold, raid warning, bog, Zarzal, first mount, each power, dungeon, fogata, Puesto, low health). Once per device (`bosque.tips`), queued one at a time, 6 s each; Ajustes › Consejos off hides them. Veterans (rank > 1 on first load) get the "seen" set pre-filled so they are not flooded.
- **[D] Dots (●)**: on the MENÚ button and a tab when it has something new (Libro: oficio points; Ayuda: a new card), and on a pill that just appeared; cleared on open/tap. Stored per device (`bosque.ack`); the first load acknowledges everything current.
- **[D] El eco del bosque**: the sim logs ≤ 20 events `{ t, who, kind, n?, where? }` in memory (lost on restart, fine): zone cleansed, boss purified, mount tamed, whale tamed, raid held, invasion over, pillar broken, Rango up, the ending. `SavedPlayer.left = { t, ms }` is set on `markAway` (real ms from the room). On connect, if `now − left.ms > 30 min` and there are events by **others** since `left.t`, or your Puesto sold, the server sends `{ t: 'echo', lines }` (≤ 3 lines, grouped: "Bea limpió 2 zonas del Pantano") instead of the old sales toast. The client shows it in the vision card, ✕ to close, 6 s. The "brillo de 1 minuto" of changed places is **not** done (3D cost; left for later).

## File Structure

- Modify `src/shared/protocol.ts` (+`StoryView`, `echo` message, 64), `src/shared/protocol.test.ts`, `src/shared/sim/world-sim.ts`; create `src/shared/echo.ts` (+test), `src/shared/sim/world-sim-p7d.test.ts`; update tests pinning 63.
- Create `src/shared/guide.ts` (+`guide.test.ts`).
- Create `src/client/guide-model.ts` (+test); modify `src/client/settings.ts` (+test).
- Modify `src/client/hud.ts`, `src/client/menu-ui.ts`, `src/client/touch.ts`, `src/client/game.ts`, `src/client/style.css`, `src/server/world-room.ts` (pass `Date.now()`).

## Tasks

### Task 1: server — `story`, the echo log, `SavedPlayer.left`, protocol 64

```ts
// protocol.ts
export interface StoryView { inv: [number, number, number]; bosses: [boolean, boolean, boolean, boolean] }
// snap: story?: StoryView     ServerMsg: | { t: 'echo'; lines: string[] }
// echo.ts
export type EchoKind = 'zone' | 'boss' | 'mount' | 'whale' | 'raid' | 'invasion' | 'pillar' | 'rank' | 'ending';
export interface EchoEvent { t: number; who: string; kind: EchoKind; what?: string }
export const ECHO = { max: 20, awayMs: 30 * 60 * 1000, lines: 3 } as const;
export function pushEcho(log: EchoEvent[], e: EchoEvent): void;           // keeps the last 20
export function echoLines(log: readonly EchoEvent[], me: string, since: number, sold: number): string[];
// world-sim.ts: connect(name, nowMs = 0); markAway(name, nowMs = 0)
```

- [x] **Step 1: failing tests.** `echoLines`: groups same who+kind ("Bea limpió 2 zonas"), skips your own events and older ones, priority ending > boss > invasion > pillar > whale > mount > zone > raid > rank, ≤ 3 lines with the sale line last ("Tu puesto vendió 4 veces"), empty when nothing. Sim: `snap.story` reflects invasions/bosses; a tame / cleanse / boss / Rango up by Bea is logged; Ana away 31 min (real) with Bea's events → one `echo` with Bea's line and no separate sales toast; away 10 min → no echo; old save without `left` → no echo, sales toast as before; log never above 20. Protocol pins → 64.
- [x] **Step 2: implement.** `story` in the snapshot; `echo()` calls at the existing milestone spots (`cleanse`, `purified*`, tame finish, whale, raid held, invasions over, pillar, `gainXp` rank up, `winFinal`); `left` on `markAway`; room passes `Date.now()`.
- [x] **Step 3:** green, commit `feat(pulido): story en el snapshot, registro del eco y protocolo 64`.

### Task 2: pure `guide.ts` — `nextStep`, bearing, edge arrow

```ts
export type Scope = 'world' | 'player';
export interface Step { id: string; scope: Scope; icon: string; text: string; target: { x: number; z: number } | null; help?: string }
export interface Places { shrines: { id: number; x: number; z: number }[]; forestDoor; coastDoor; swampDoor; mountainDoor; deer; fish; frog; pico; cage; knot; umbral; rim; ceniza; pillars: { x: number; z: number }[]; tower; estrella }
export interface GuideView { touch: boolean; me: { x: number; z: number }; self: {...orbs, powers, mounts, skillPts}; world: {...heart, story, whale, zarzal, escalera, fog, pillars, towerOpen, ending, corrupt zones, fogatas, fullMoon}; friends: { name: string; x: number; z: number }[]; places: Places }
export const STORY: readonly { id: string; scope: Scope; done(v: GuideView): boolean; show(v: GuideView): Step }[];
export function nextStep(v: GuideView): Step | null;   // story first, then one secondary, else null
export function lineText(s: Step, v: GuideView): string; // "✨ Santuario del Bosque · 120 m ↗ (Bea está allí)"
export function bearing(me, yaw: number, t): { m: number; arrow: string };
export function edgeArrow(ndcX: number, ndcY: number, behind: boolean, w: number, h: number, pad: number): { x: number; y: number; deg: number } | null;
```

- [x] **Step 1: failing tests.** **Walk test**: a simulated save from a new world, applying each step's "done" mutation in story order, must yield exactly the 28 story ids in order and then `null` (or a secondary). Each step's target is the right place (nearest missing shrine; nearest unbroken pillar; door for dungeon steps). **Co-op**: with every world step done by someone else, a fresh player's first step is "Santuarios del Bosque" and never a world step; player steps stay until *you* do them. Invasion 2 shows two texts by state. Secondaries: oficio points only when the story is done or far; full moon; nearest zone ≤ 150 m. `lineText`: "aquí" under 8 m, friend note at ≤ 30 m, touch vs PC key in "Planta el Corazón (🌳 / G)". `bearing` 8 arrows around the camera. `edgeArrow`: on screen → null, behind → bottom edge, clamps to the padded rectangle. No step text has "!".
- [x] **Step 2: implement.** **Step 3:** green, commit `feat(pulido): guide.ts: el siguiente paso de la historia, rumbo y flecha de borde`.

### Task 3: pure client models — tips, dots, dimming; settings

```ts
// settings.ts: Settings += { guide: boolean; tips: boolean }
// guide-model.ts
export type TipId = ...; export const TIPS: Record<TipId, string>;   // ~25, one line each
export interface TipView { seen: ReadonlySet<Seen>; night: boolean; cold: boolean; raidWarn: boolean; bog: boolean; zarzal: boolean; mounted: boolean; powers: string[]; lowHp: boolean; touch: boolean }
export function tipsDue(v: TipView, shown: ReadonlySet<TipId>): TipId[];
export class TipQueue { push(ids: TipId[], now: number): void; current(now: number): string | null }  // 6 s each, one at a time
export function dots(o: { skillPts: number; cards: string[]; pills: boolean[] }, ack: Ack): { menu: boolean; tabs: Partial<Record<MenuTab, boolean>>; pills: boolean[] };
export function lineAlpha(changedAgo: number): number;  // 1 until 8 s, then 0.4
```

- [x] **Step 1: failing tests.** Settings default `guide: true, tips: true` and parse bad values. `tipsDue` once per id, device text (touch vs PC), `TIPS` all end without "!" and ≤ 70 chars. `TipQueue` 6 s, FIFO. `dots`: Libro dot with points; Ayuda dot on a new card, cleared once acked; a pill turning on is dotted until acked; first-load ack of everything = no dots. `lineAlpha`.
- [x] **Step 2: implement.** **Step 3:** green, commit `feat(pulido): consejos de primera vez, puntos de nuevo y ajustes de la guía`.

### Task 4: wiring — the line, the arrow, tips, dots, the echo card; screenshots and perf

- [x] **Step 1:** `game.ts`: build `Places` once after the seed; each snapshot → `GuideView` → `nextStep` → `hud.setGoal(text, changed)`; each frame project the target → `edgeArrow` → `hud.setArrow`; tips via `TipQueue`; dots → menu/tabs/pills; `echo` message → `hud.showEcho(lines)`. `hud.ts`: `.goal` line at the top centre (tap → Menú › Ayuda), `.goal-tip` under it, `.edge-arrow`, `.dot`; echo card reuses the vision card (✕, 6 s). Ajustes: "Mostrar Qué sigue" and "Consejos" toggles. `style.css`: safe-area aware, 14 px (× `--ui-scale`), text shadow.
- [x] **Step 2:** screenshots (Playwright, 390×844 and 844×390, touch): the line with a target, the arrow with the target behind, a tip, the Menú dot, the echo card (a second player acting while the first is away, with `left.ms` faked old). Perf: `npm run perf -- --tier low` equal to base.
- [x] **Step 3:** green, commit `feat(pulido): línea Qué sigue, flecha de borde, consejos, puntos y el eco del bosque`.

### Task 5: Ship

- [x] HANDOFF "## Pulido · P7-D — …" (Decidido por Claude — revisar, Qué probar, NO verificado, tests updated, perf, protocol 64 and P7-F → 65); push; one short comment on PR #3.
