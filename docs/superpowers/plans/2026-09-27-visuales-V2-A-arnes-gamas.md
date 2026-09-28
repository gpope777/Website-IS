# Visuales · V2-A: Arnés y gamas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** the first plan of subproject #2 (spec §3, §7, §8, row V2-A of §12). Measure before touching anything: a **performance harness** (`npm run perf`) that walks a fixed camera route through every biome at noon and midnight in the three tiers and records draw calls, triangles, points, geometries, textures and programs; the **baseline of today** committed to `scripts/perf/baseline.json`; the **`?fps=1`** on-screen counter for real phones; the **new `TierSettings` fields** (unused yet, no visual change); the **4 s FPS probe** on the first game and the **automatic downgrade** when the game runs under 24 fps for 10 s.

**Architecture:** pure logic in `src/client/quality.ts` (`probeVerdict`, `FpsGuard`, the new fields) with tests. `game.ts` wires the probe, the guard and the `?fps=1` overlay (`src/client/fps-meter.ts`), and, **only in dev/perf builds** (`import.meta.env.DEV || import.meta.env.MODE === 'perf'`, stripped from production), `?perf=1` exposes `window.__perf` (hold the player at a point, set the camera angle and the hour, read `renderer.info`). `scripts/perf/run.mjs` builds with `--mode perf`, starts `wrangler dev` on a throw-away state dir, creates world `perf` with seed 42, drives Chromium headless through the route and compares with the baseline.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers (wrangler dev), playwright-core 1.56.1 (devDependency, no browser download).

**Spec:** `docs/superpowers/specs/2026-09-27-visuales-design.md` §3, §7, §8, §12 (V2-A).

## Global Constraints

- **No visual change, no gameplay/collision/protocol change.** `PROTOCOL_VERSION` stays 62. The new `TierSettings` fields are declared and tested, not read by the scene yet.
- Spanish, dry voice: "Bajé los gráficos." · "Esto va sobrado: prueba gráficos Media en el Menú." · overlay "N fps · Baja".
- **[D] Playwright as a pinned devDependency `playwright-core@1.56.1`** (its Chromium revision 1194 is the one in `/opt/pw-browsers`), instead of the spec's separate `npm i playwright` in `scratch/perf`: one reproducible version in the lockfile, no browser download (`playwright-core` never downloads; install with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` anyway). Browser lookup: `PERF_CHROMIUM` (an executable) → `PLAYWRIGHT_BROWSERS_PATH` → `/opt/pw-browsers`; with none the harness prints "Sin Chromium: …" and exits 0 (skipped, not failed).
- **[D] `npm run perf` is not part of `npm test`** (vitest only picks `src/**/*.test.ts`; the harness lives in `scripts/`).
- **[D] Route** (seed 42, world `perf`, 8 stops × noon/midnight × 3 tiers = 48 readings): bosque (0, 60), costa (0, 275), bajo el agua (0, 330, y = agua − 6), pantano (−340, 160), montañas (20, −300), tierras (0, −560), mazmorra (Raíz-madre, inside the interior strip), hogar (spawn). "Tierras purificadas simuladas" has nothing to simulate until V2 adds the purified look; that plan adds the stop.
- **[D] Reading** = `renderer.info` of the last of 30 frames after placing the camera (no FPS: SwiftShader is not a phone). Fails if a reading passes the §3 budget of its tier (calls 120/180/260, triangles 250k/500k/1.2M) **only when it also regressed**: today's numbers are the baseline even if already over (spec §3: "si hoy ya se pasa… el plan que toque ese bioma lo baja"); any figure > 10 % over the baseline fails; `--update` rewrites the baseline.
- **[D] Probe:** only when there is no saved tier (first game) and not `?perf=1`: frames 21.. of the first 4 s after the world appears; mean > 33 ms on media/alta → one step down, saved, applied live (pixel ratio, far plane, shadows off) — grass and terrain segments follow on the next entry; mean < 12 ms on baja with touch → the offer toast once (`bosque.tierOffer`), never an automatic upgrade.
- **[D] Guard:** 10 s window, mean < 24 fps → pixel ratio × 0.85 (floor 0.7 on baja, one step on media/alta), then "Bajé los gráficos." and one tier down; at most one change per 60 s; off with `?perf=1`; ignores frames while the tab is hidden (dt > 0.5 s).
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## File Structure

- Modify `src/client/quality.ts` (+test), `src/client/game.ts`, `package.json`, `.gitignore` (`scratch/`).
- Create `src/client/fps-meter.ts` (+test), `scripts/perf/run.mjs`, `scripts/perf/baseline.json`.

## Tasks

### Task 1: gamas — new fields, probe and guard (pure)

```ts
export interface TierSettings { /* old */ grassRadius: number; grassPerChunk: number; waterGrid: number; clouds: number;
  stars: boolean; heightFog: boolean; glowPoints: number; ambient: number; particles: number; triplanar: boolean; shadowRadius: number; }
export const TIER_ORDER: readonly Tier[]; export function lowerTier(t: Tier): Tier | null;
export function probeVerdict(frameMs: readonly number[], tier: Tier, touch: boolean): 'down' | 'offer' | 'keep';
export class FpsGuard { constructor(tier: Tier, ratio: number); feed(dtSec: number, nowSec: number): GuardAction | null; }
type GuardAction = { kind: 'ratio'; ratio: number } | { kind: 'tier'; tier: Tier };
```

Values (spec §3): grassRadius 35/60/90, grassPerChunk 2100/2700/3600 (≈ 8 k/30 k/90 k in view), waterGrid 1/64/128, clouds 0/1/2, stars no/no/sí, heightFog no/sí/sí, glowPoints 4/8/8, ambient (luciérnagas) 40/120/250, particles 200/400/600, triplanar no/sí/sí, shadowRadius 0/40/60.

- [x] **Step 1: failing tests** (`quality.test.ts`): every numeric field low ≤ medium ≤ high and every boolean monotone (false→true); shadowRadius 0 iff no shadows; `lowerTier`. `probeVerdict`: ignores the first 20 frames; 40 ms on medium → down; 40 ms on low → keep; 10 ms low+touch → offer, not without touch; < 21 frames → keep. `FpsGuard`: steady 60 fps → nothing; 10 s at 15 fps on low → ratio 0.85, a minute later 0.72, then 0.7, then nothing (low has no lower tier); on medium → one ratio step then `tier: 'low'`; never two actions within 60 s; hidden-tab gaps (dt > 0.5) ignored.
- [x] **Step 2: implement.**
- [x] **Step 3:** green, self-review, commit `feat(visuales): campos de gama nuevos, prueba de FPS y bajada automática (puro)`.

### Task 2: client — `?fps=1`, probe, guard, `?perf=1`

- [x] **Step 1: failing tests** (`fps-meter.test.ts`): `fpsText(fps, tier, ratio)` → "58 fps · Media" and "22 fps · Baja · ×0,85"; `FpsMeter` averages over 0.5 s.
- [x] **Step 2: implement.** `FpsMeter` div (fixed, top-left, `pointer-events: none`) when `?fps=1`. `game.ts`: probe after the first world frame when there was no saved tier; guard every frame; live apply (`setPixelRatio`, camera far, `shadowMap.enabled = false`); `saveTier`; toasts. Perf hook: `window.__perf = { ready(), stop({x, z, y?, yaw, pitch, frac}), release(), info() }` — `stop` holds the body there (no moves sent), fixes the hour; `info()` returns `renderer.info` numbers + `programs`. Gated by the build mode so production has none of it (checked by grepping `dist/` for `__perf`).
- [x] **Step 3:** green, self-review, commit `feat(visuales): contador ?fps=1, prueba de FPS en la primera partida y gancho de rendimiento`.

### Task 3: the harness and today's baseline

- [x] **Step 1:** `scripts/perf/run.mjs` (see Architecture): `npm run perf` (`node scripts/perf/run.mjs`), flags `--update`, `--tier low`, `--shots` (PNGs to `scratch/perf/shots/`, git-ignored). Console table + `scratch/perf/perf-report.json`. Exit 1 on a budget/regression failure, 0 otherwise.
- [x] **Step 2:** run `npm run perf -- --update` (15–16 min las 3 gamas en SwiftShader); la segunda pasada de baja dio las mismas cifras (determinista). Commit `baseline.json`.
- [x] **Step 3:** green, self-review, commit `feat(visuales): arnés npm run perf y cifras de hoy`.

### Task 4: Ship

- [x] Full suite green; push; HANDOFF "## Visuales · V2-A — …" with the baseline table, what the phone test should look at (`?fps=1`), and the decisions; one short comment on PR #3.
