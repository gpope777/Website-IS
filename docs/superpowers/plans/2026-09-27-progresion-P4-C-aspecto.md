# Progresión · P4-C: Aspecto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** the third plan of subproject #4 (spec §5, row P4-C of §11). Every player picks **1 of 8 colours** (a per-player copy of the robot's `Main` material) and **1 of 6 hats** (or none), each hat a simple primitive mesh tied to the `Head` node so it follows the animation. Hats unlock with story milestones. The choice is saved, sent to everyone in the snapshot and validated by the server. A new **Aspecto** screen in the Menú.

**Architecture:** pure `COLORS`, `HATS`, `hatUnlocked`, `unlockedHats`, `isLook` in `src/shared/progression.ts`. `WorldSim` handles `{ t: 'look', color, hat }`, saves `SavedPlayer.look?`, sends `PlayerView.look?` (only when not the default) and `SelfState.look` + `SelfState.hats` (unlocked ids, so the client never re-derives milestones). `Actor.setLook(color, hat)` clones `Main` once, tints it, attaches a cached hat mesh to `Head`, and disposes the clone in `dispose()`. The panel is pure HTML from `src/client/look-ui.ts`.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-progresion-design.md` §5 (Apariencia), §10.2–10.4, §11 (P4-C).

## Model check (done before writing this plan)

`public/models/robot.glb` has 3 materials: `Grey` (baseColor ≈ 0.37/0.37/0.33, 1 594 vertices), **`Main` (orange 0.59/0.29/0.04, 5 056 vertices)**, `Black` (564 vertices). `Main` holds ~70 % of the vertices and is the only coloured one: the body colour lives in `Main`, `Grey` is the joints/trim. **Decidido por Claude:** clone only `Main`; verify in the browser screenshot (Task 4) and note it. Nodes `Head` and `Head_end` exist (a bone and its tip): the hat sits at `Head_end`'s local position, in `Head` space.

## Global Constraints

- Spanish, dry voice. `NAMES.look = 'Aspecto'`, `NAMES.colorNames` (8), `NAMES.hatNames` (6) in `names.ts`; code uses `NAMES`. The 3 Proeza hats are P4-D.
- **No new keys or pills.** Menú → "Aspecto".
- **Trust boundary:** `look` goes through `decodeClient` (integers, colour 0–7, hat 0–6). The server re-checks `hatUnlocked` and refuses with a toast.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 56 → 57. New saved field optional: `SavedPlayer.look?: { color: number; hat: number }`. Old saves: colour 0 (the original orange), no hat. `SavedPlayer.hats?` is reserved for P4-D (not added here).
- **[D] Colour 0 is the model's own orange:** no clone for colour 0; a clone only once someone picks another. Cloning a material adds no draw call (same meshes); the only extra draw call is the hat mesh (1 merged-ish mesh, ≤3 primitives in one group → ≤3 draw calls; **[D]** each hat is ONE `Mesh` built from a merged geometry with one material, so exactly 1 draw call per player: ≤4 with 4 players).
- **[D] Unlocks** (spec §5.2): Hoja = Rango 2 · Caracola = has Viento · Corona de ámbar = Capa 3 · Cuernos de cuarzo = has Piedra · Aureola blanca = El Marchito fell (world `ending`) · Estrella = la Estrella tamed (`star`). Never re-locked.
- Hats and cloned materials are disposed when the actor leaves (`Actor.dispose`); hat geometries/materials are module-level and shared, never disposed.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## File Structure

- Modify `src/shared/progression.ts` (+ test), `src/shared/names.ts`, `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`, `src/client/actors/actor.ts`, `src/client/game.ts`, `src/client/hud.ts`, `src/client/style.css`.
- Create `src/shared/sim/world-sim-p4c.test.ts`, `src/client/look-ui.ts` + `.test.ts`, `src/client/actors/hats.ts` + `.test.ts`.

## Tasks

### Task 1: pure rules — colours, hats, unlocks

```ts
export const COLORS: readonly number[]; // 8 hex, [0] = the model's orange
export const HAT_IDS = ['hoja', 'caracola', 'ambar', 'cuarzo', 'aureola', 'estrella'] as const; // hat n = HAT_IDS[n-1], 0 = none
export interface Look { color: number; hat: number }
export function isLook(color: unknown, hat: unknown): boolean;
export function hatUnlocked(p: ProgressSource & { capaLvl?: number }, hat: number): boolean;
export function unlockedHats(p): number[];
export const HAT_HINTS: Record<HatId, string>; // "Se gana con Piedra"
```

- [x] **Step 1: failing tests.** 8 distinct colours; 6 hats; `isLook(0,0)`, `isLook(7,6)` true, `isLook(8,0)`, `isLook(1.5,0)`, `isLook(0,7)` false; hat 0 always; Hoja needs Rango 2; Caracola `viento`; Ámbar `capaLvl 3`; Cuarzo `piedra`; Aureola `ending`; Estrella `star`; `NAMES.look`, a name per colour and hat.
- [x] **Step 2: implement.**
- [x] **Step 3:** green, self-review, commit `feat(progresion): reglas puras del Aspecto`.

### Task 2: server — `look` message, save and snapshot (protocolo v57)

- [x] **Step 1: failing tests** (`world-sim-p4c.test.ts`). Protocol 57; `decodeClient` accepts `{t:'look',color:3,hat:0}`, rejects colour 8 / hat 7 / strings. A new player: `self.look` = {0,0}, `self.hats` = []; others see no `look`. `look` colour 5 hat 0 → saved, seen by Bea as `look: {color:5,hat:0}`. Hat 4 (Cuarzo) without Piedra → refused with toast, look unchanged; with Piedra → accepted, `self.hats` includes 4. An old save without `look` loads with the default.
- [x] **Step 2: implement** (`onLook`; `PlayerView.look?`; `SelfState.look`, `SelfState.hats`).
- [x] **Step 3:** green (adapt 56 → 57 in version tests, noted), self-review, commit `feat(progresion): Aspecto en el servidor (protocolo v57)`.

### Task 3: client — tint, hats on `Head`, the Aspecto screen

- [x] **Step 1: failing tests.** `hats.ts`: `makeHat(n)` returns one `Mesh` (1 draw call) for 1–6, null for 0, same geometry object on two calls (cached). `look-ui.ts`: `lookHtml(look, unlocked)` has 8 `data-a="color-i"` swatches (the current one `on`), hats "Sin sombrero" + 6, locked ones `locked` with their hint, "Volver".
- [x] **Step 2: implement.** `Actor.setLook(color, hat)`: on first colour ≠ 0 clone `Main` on every mesh of this actor that uses it (one clone shared by the actor's meshes), set `.color`; colour 0 restores the shared original; hat mesh added under the `Head` node at `Head_end`'s position, scaled by the inverse of the bone's world scale; `dispose()` disposes the clone. `game.ts`: remote actors and `me` call `setLook`; Menú "Aspecto" button → panel → `{ t: 'look', color, hat }`.
- [x] **Step 3:** green, self-review, commit `feat(progresion): pantalla Aspecto y sombreros en la cabeza`.

### Task 4: Ship

- [x] Full suite green; headless screenshot of two players in different colours (Playwright from a scratch dir, `npm run dev:server`), report only what is seen; push; HANDOFF "## Progresión · P4-C — …"; one short comment on PR #3.
