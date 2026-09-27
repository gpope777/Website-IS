# Aventura — Slice 4 · S4-H: Tobogán de nieve y visiones de la Montaña — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The slice's "Idea de Claude" and its last loose ends. On **snow** with a slope over **15°**, **B while running** throws you on your belly: the **tobogán** slides downhill along the gradient, the stick steers ±30°, speed ramps to **14 m/s**. It ends when the slope stays under 8° for 1 s, on B, on hitting a tree/rock (stop, no damage) or off snow. The packed **snow chute** down the middle (|x| < CHUTE.half + 1) carries you south all the way down the Peldaños and stops you at the **Umbral**. The server gives sliders a speed cap of **16** (+1 s grace) only when the window's start and end are snow and the move goes downhill. Plus the two visions still marked `// S4-H`: the first entry into the mountains («Qué alto, <nombre>. Qué frío») and raising the Escalera del Umbral.

**Architecture:** Pure rules in a new `src/shared/snowslide.ts` (`SNOWSLIDE`, `snowAt`, `inChute`, `slideDir`, `slideMoveOk`) used by the client's `stepBody` (new `stepSlide` branch, `Body.sliding`) and by `WorldSim.onMove` (cap 16 when `m.anim === 'slide'` and `slideMoveOk`). `'slide'` joins `ANIMS` (protocol v43). No saved fields. Visions in `VISION` (`src/shared/sim/marchito.ts`).

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-4-montanas-design.md` §9.1 (Tobogán de nieve), §14 (visions), plan map row S4-H.

## Global Constraints

- Player-facing text in **Spanish**, dry voice.
- **Touch grid stays at 10 pills.** Tobogán = **B** (Space) while running (touch: stick past the sprint zone). B again gets up.
- **Trust boundary:** the only new client input is the `'slide'` anim on `move` (already validated by `decodeClient` against `ANIMS`). The server decides the cap from the terrain, not from the anim alone.
- **Protocol:** Task 1 bumps `PROTOCOL_VERSION` 42 → 43 (`ANIMS` + `'slide'`; the server accepts faster moves). Old saves load (no new saved fields).
- **[D] Snow** = inside the mountains and terrain height **> 55 m absolute** (the spec's "+55"; the Pico's skirt and top), **or** the chute band (|x| < CHUTE.half + 1, depth > 0).
- **[D] The chute carries you:** in the band the slide heads south (toward the Umbral) whatever the local slope — the chute's own profile has 7–15° stretches and small bumps, so the "under 8° for 1 s" stop only applies on open snow. It ends at depth 0 (the forest rim, 3 m from the Umbral block). From the Pico (d = 170) that is ~15 s at 14 m/s, not the spec's ~40 s; the speed stays as specified.
- **[D] Server downhill check** = end height ≤ start height + 3 m over the (≤ 1 s) window (the chute has small bumps).
- **[D] Entry vision** once per world (worlds that already had `mountainsSeen` do not get it, like the swamp's).
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Snow-slide rules and the server cap (protocol v43)

**Files:** Create `src/shared/snowslide.ts`, `src/shared/snowslide.test.ts`; Modify `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`; Tests `protocol.test.ts`, new `src/shared/sim/world-sim-s4h.test.ts`.

**Interfaces:**
```ts
export const SNOWSLIDE = { snowY: 55, startDeg: 15, stopDeg: 8, stopAfter: 1, speed: 14, accel: 6, steer: Math.PI / 6, maxSpeed: 16, grace: 1, bump: 3, chutePad: 1 } as const;
export function inChute(x: number, z: number): boolean;                 // |x| < CHUTE.half + pad, mountain depth > 0
export function snowAt(t: Terrain, x: number, z: number): boolean;       // inMountains && (h > snowY || inChute)
export function slideDir(t: Terrain, x: number, z: number): { x: number; z: number }; // unit; chute → south (+z); else downhill gradient
export function slideMoveOk(t: Terrain, ax: number, az: number, x: number, z: number): boolean; // both snow, h(end) ≤ h(start) + bump
```
- [ ] **Step 1: failing tests.** `inChute(0, -HALF - 50)` true, `(20, …)` false, forest false. `snowAt` true on the Pico top and in the chute, false in the Faldas off the chute and in the forest. `slideDir` in the chute points +z; on the Pico skirt points away from the Pico centre. `slideMoveOk` true chute-downward, false going up 10 m, false off snow. Server: a move with anim `'slide'` 14 m in 1 s down the chute is accepted; the same with anim `'run'` is rejected (cap 9); a `'slide'` 25 m/s rejected; a `'slide'` in the forest at 14 m/s rejected; right after a slide, a 14 m/s `'run'` move within 1 s still passes (grace). `ANIMS` includes `'slide'`; `PROTOCOL_VERSION` 43.
- [ ] **Step 2: implement.** In `onMove`: `const sliding = m.anim === 'slide' && !l.riding && !l.frog && slideMoveOk(this.terrain, l.anchorX, l.anchorZ, m.x, m.z)`; cap = `max(cap, SNOWSLIDE.maxSpeed)` when sliding; on accept set `l.rodeUntil = time + grace`, `l.graceCap = max(…, 16)`.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): reglas del tobogán de nieve y tope del servidor (protocolo v43)`.

### Task 2: The remaining mountain visions

**Files:** Modify `src/shared/sim/marchito.ts`, `src/shared/sim/world-sim.ts`; Test `world-sim-s4h.test.ts`.

- [ ] **Step 1: failing tests.** A player stepping into the mountains in a fresh world → one vision naming them («Qué alto, Ana. Qué frío.»); a second tick → none; a world saved with `mountainsSeen` → none. The third Piedra crack on the Umbral → the Escalera vision naming the active players. No `// S4-H` marker left in `src/`.
- [ ] **Step 2: implement.** `VISION.mountains(name)`, `VISION.escalera(names)`; replace both markers.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): visiones de la Montaña (entrada y Escalera)`.

### Task 3: Client tobogán

**Files:** Modify `src/client/movement.ts`, `src/client/actors/actor.ts`, `src/client/game.ts`; Test `movement.test.ts`.

- [ ] **Step 1: failing tests.** On a synthetic 25° snow slope inside the mountains, B edge while running → `b.sliding`, speed ramps to ~14 m/s downhill, `animFor` = `'slide'`, no jump. On a 10° slope B jumps as usual. The stick steers at most 30° off downhill. B again → stops. Sliding onto a flat (< 8°) off the chute → stops after ~1 s. Hitting a tree circle → stops. Leaving snow → stops. In the chute on the real terrain, starting at d = 140 the slide reaches the forest rim near x = 0 and stops there.
- [ ] **Step 2: implement.** `Body.sliding?`, `Body.flatFor?`; `stepSlide` (ground-hugging, no stamina, trees stop you); `PLAYER_CLIPS.slide` (belly pose placeholder); HUD toast once per session on the first slide: "Tobogán. B para levantarte".
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente del tobogán de nieve`.

### Task 4: Ship

- [ ] Full suite green; push `aventura/resto`; add "## Slice 4 — resumen (LEER PRIMERO)" before S4-A and "## Slice 4 · S4-H — …" after S4-G in `docs/superpowers/HANDOFF-aventura.md`; one short comment on PR #3.
