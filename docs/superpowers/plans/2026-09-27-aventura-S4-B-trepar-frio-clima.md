# Aventura — Slice 4 · S4-B: trepar la montaña, el frío y el clima — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mountains climbable. Inside `inMountains`, pushing uphill into a cell steeper than 45° that is **not smooth** and **not wet** grabs the slope and you climb it with stamina (same costs as crags). Above 30 m of terrain height the mountains are **cold** (warmth drains like night by day, ×2 at night). A seeded **weather** per in-game day (`clear / rain / storm`, 60/25/15 %, a storm at least every 4 days) only matters in the mountains: rain or storm makes rock wet (no grabbing, climbers slide off), rain/snow particles and a darker sky there, and a dawn line "Hoy en la montaña: lluvia".

**Architecture:** New pure module `src/shared/weather.ts` (`weatherAt`, `WEATHER`, `weatherLine`, `wetAt`) and `altitudeCold` in `src/shared/mountains.ts`. `tickVitals` gains an optional `cold` env flag. The server (`WorldSim.onMove`) lets walkers go uphill on steep non-smooth dry rock; the client (`movement.ts`) gains a terrain-climb state (`Body.wall`) next to the crag climb, and a slide-down on steep ground when not holding on. The client computes weather from `seed` + server time (no network), so no new snapshot fields.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-4-montanas-design.md` §3.3 (climbing), §3.4 (cold), §8 (weather), §15.5 (risks), §16 row S4-B.

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Proper names through `NAMES`.
- **Phones first. Touch grid stays at 10 pills.** Climbing is contextual (push the stick into the rock); B lets go. No new action.
- **Trust boundary:** the server decides whether a steep uphill move is allowed (not smooth, not wet, not riding; tolerance 50°) and applies the cold. Stamina stays client-side (as with crags).
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 32 → 33 (the move rule changed; client and server must agree). No new saved or snapshot fields: old saves load.
- **Outside the mountains nothing changes.**
- **Out of this plan:** the dragon (storm only sets the weather), quartz, Cornisa, refugios (S4-C), pillars (S4-E).
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Weather, altitude cold and the Llamarada's warmth

**Files:** Create `src/shared/weather.ts`, `src/shared/weather.test.ts`; Modify `src/shared/survival.ts`, `src/shared/mountains.ts`, `src/shared/sim/world-sim.ts`; Tests `survival.test.ts`, `mountains.test.ts`, `world-sim.test.ts`.

**Interfaces:**
```ts
// weather.ts
export type Weather = 'clear' | 'rain' | 'storm';
export const WEATHER = { rain: 0.25, storm: 0.15, stormEvery: 4 } as const;
export const WEATHER_TEXT: Record<Weather, string> = { clear: 'despejado', rain: 'lluvia', storm: 'tormenta' };
export function weatherAt(seed: number, day: number): Weather;   // day = floor(time / DAY_LENGTH); deterministic
export function wetAt(w: Weather): boolean;                      // rain or storm
export function weatherLine(w: Weather): string;                 // "Hoy en la montaña: lluvia"
// mountains.ts
export const COLD = { y: 30, warmFlame: 20 } as const;
export function altitudeCold(t: Terrain, x: number, z: number): boolean; // inMountains && heightAt > COLD.y
// survival.ts: VitalsEnv.cold?: boolean — when not near a fire: warmth −warmthNight by day, −2·warmthNight at night
```
- [ ] **Step 1: failing tests.** `weatherAt` is deterministic; over 4 000 days for 3 seeds the shares are ~60/25/15 % (±5 %); no run of 4 days without a storm; `weatherLine('rain')` is "Hoy en la montaña: lluvia". `tickVitals` with `cold` by day drains at `warmthNight`, at night at twice it, near fire still warms. `altitudeCold` false in the forest and at the Peldaños foot, true at the Pico. Server: a player standing at the Pico by day loses warmth over 10 s; one in the forest by day gains it; a Llamarada gives the caster +20 warmth (capped at 100).
- [ ] **Step 2: implement.** Per-day hash (mulberry-like) of `(seed, day)`; storm forced when the 3 previous days had no natural storm (recursive over 3 days, bounded). Server tick passes `cold: altitudeCold(...)`; `onFlame` adds `COLD.warmFlame`.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): clima sembrado por día y frío de altura`.

### Task 2: Server — steep dry rock can be climbed (protocol v33)

**Files:** Modify `src/shared/mountains.ts`, `src/shared/sim/world-sim.ts`, `src/shared/protocol.ts`; Tests `mountains.test.ts`, `world-sim.test.ts`, `protocol.test.ts`.

**Interfaces:**
```ts
export const STEEP_TEXT = { ..., wet: 'Roca mojada. Resbala' };
export function climbableAt(x: number, z: number, wet: boolean): boolean;   // inMountains && !smoothAt && !wet
```
- [ ] **Step 1: failing tests.** On a clear day a walker moving up a pared face is accepted; on a rain day the same move is rejected with the hint "Roca mojada. Resbala"; the Peldaños still refuse walkers ("Roca lisa. Sin agarre"); a deer rider up a pared is still refused. `PROTOCOL_VERSION` is 33 (intentional bump).
- [ ] **Step 2: implement.** In `onMove`, the steep rejection applies only when `l.riding || !climbableAt(m.x, m.z, wet)`; hint picks smooth / deer / wet / steep.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): la roca seca de la montaña se trepa (protocolo v33)`.

### Task 3: Client — climbing the slope, sliding off

**Files:** Modify `src/client/movement.ts`, `src/client/game.ts`; Test `src/client/movement.test.ts`.

**Interfaces:**
```ts
// Body: wall: boolean (climbing terrain), wet: boolean (from the weather, set by game each frame)
// StepResult.steep gains 'wet'
export const SLIDE = { speed: 4, stand: 35 } as const;
```
- [ ] **Step 1: failing tests.** Walking into a pared face on foot with stamina → `climbing` true and `b.wall`; holding forward for a few s gains height at ≤ `CLIMB_SPEED` and spends stamina; at the top (slope < 35°) you stand; running out of stamina lets go and you slide down (no height gain); B jumps off backwards and costs 20; `wet` → no grab, `steep === 'wet'`; smooth Peldaños still `'smooth'`; the deer still `'deer'`; standing still on a > 45° cell without holding slides downhill.
- [ ] **Step 2: implement.** In `steepStop`: walker, not tired, not wet, `climbableAt` → grab (`b.wall = true`). `stepWall`: gradient from `heightAt` differences; stick forward = uphill, back = downhill, sides along the contour, at `CLIMB_SPEED`; y = `heightAt + 0.4`; facing uphill; stamina 10/s moving, 3/s still. Let go when tired, wet, B (leap back 20), slope < 35° (stand on top), or back on < 45° ground. Normal step: on ground on a > 45° mountain cell → slide down the gradient at `SLIDE.speed`. `game.ts` sets `body.wet` from `weatherAt(seed, day)`, toast for `'wet'`.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): trepar las paredes de la montaña con aliento`.

### Task 4: Client — rain, snow, darker sky and the dawn line

**Files:** Create `src/client/scene/weather.ts` (+ test); Modify `src/client/game.ts`.

**Interfaces:**
```ts
export const PRECIP = { count: 600, box: 40 } as const;
export function precipKind(w: Weather, y: number): 'rain' | 'snow' | null; // null when clear; snow above +55
export class WeatherFx { constructor(scene); update(w: Weather | null, x, y, z, dt): void } // one THREE.Points, hidden outside the mountains
export function dawnCrossed(prevFrac: number, frac: number): boolean;      // crossing 0.22
```
- [ ] **Step 1: failing tests.** `precipKind`; `dawnCrossed(0.21, 0.23)` true, `(0.3, 0.31)` false, wrap-around false.
- [ ] **Step 2: implement.** One `Points` cloud following the player (1 draw call, only in the mountains and when wet); darker fog/light factor in the mountains on wet days (reuse the raid dimming argument of `light.update`); on dawn crossing, toast `weatherLine`.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): lluvia y nieve en la montaña y el parte del alba`.

### Task 5: Ship

- [ ] Push `aventura/resto`; append "Slice 4 · S4-B" to `docs/superpowers/HANDOFF-aventura.md`; brief local browser check of climbing; one short comment on PR #3. No merge, no deploy.
