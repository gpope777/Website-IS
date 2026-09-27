# Aventura — Slice 2 · S2-B: el Pez Grande — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The second mount. One wild giant fish circles in the shallows off the beach (golden halo). Each player tames their own copy: press A near it, it bolts, and **6 water rings** appear; swim through each within 7 s of the previous one. Then the deer's timing ring, **2 rounds**. Riding: 9 m/s, sprint 14 (no stamina), server cap 15; **B held = dive** to the seabed, release to float up. A in shallow water (depth < 1 m) dismounts; the fish waits there. No Ciénaga, no aguas bravas, no dungeons on the fish.

**Architecture:** All fish rules are pure functions in a new `src/shared/fish.ts` (`FISH`, `wildFish`, `fishRings`, `inBravas`, `fishStepOk`, `fishFloor`), used by both `WorldSim` and `client/movement.ts`. The race is live-only server state (`Live.race = { i, deadline }`) checked every tick against the last *validated* position; the ring list is seeded, so the client computes the same list from the seed. Taming part 2 reuses `Live.tame` with a `beast` field and the deer's ring code. Riding the fish is live-only `Live.fish` (like `riding`); the parked fish is `SavedPlayer.fish?: {x, z}` (optional, old saves load).

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-2-costa-design.md` §3.3 (fish riders' water rules), §5.1 (giant fish), §11.2, §12 (row S2-B). The "Decisiones de Gabriel" block overrides the rest (nothing there changes the fish).

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES.fish`.
- **Phones first. Touch grid stays at 10 pills.** Taming / mounting / dismounting the fish is the contextual **A** (keyboard E / M). Diving is **B held** (Space), which already is the jump button — no new button.
- **Trust boundary:** every client message through `decodeClient`; the server validates reach, depth, the aguas bravas ring, dive depth and speed.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 13 → 14: `mount` acts 6/7/8, `PlayerView.ride: 'deer' | 'fish' | null` (was boolean), `SelfState.fish` / `onFish` / `race`, `snap.fish: SteedView[]`. New saved field `SavedPlayer.fish?` only: old saves load.
- **[D] Fold into `mount`, not a new `tame` message:** acts 6 = start the fish race, 7 = mount your fish, 8 = get off the fish; act 1 (ring tap) serves both beasts. One decoder branch instead of a new message.
- **[D] The wild fish holds still at its seeded home** (server); the client swims it in a small circle for show only, so reach checks stay simple.
- **[D] Rings must be swimmable on foot** (depth 1–3.5 m, shallows band), because the race is swum before you have the fish.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Fish rules (shared)

**Files:** Create `src/shared/fish.ts`, `src/shared/fish.test.ts`.

**Interfaces:**
```ts
export const FISH = {
  reach: 4, rings: 6, ringGap: [10, 14], ringR: 2.2, ringTime: 7, retry: 3,
  rounds: [{ speed: 3.0, width: 1.1 }, { speed: 4.2, width: 0.75 }],
  walk: 9, run: 14, maxSpeed: 15, grace: 2, sink: 3, rise: 4, shore: 1, bravas: 30, height: 0.6,
} as const;
export function wildFish(t: Terrain, seed: number): { x: number; z: number };           // shallows, depth 1.5–3.5
export function fishRings(t: Terrain, seed: number, home: { x: number; z: number }): { x: number; z: number }[]; // 6, 10–14 m apart, depth 1–3.5
export function inBravas(island: Islet, x: number, z: number): boolean;                 // within island.r + FISH.bravas
export function fishFloor(t: Terrain, x: number, z: number): number;                    // seabed + 0.5 (dive limit)
export function fishStepOk(t: Terrain, island: Islet, x: number, z: number): boolean;   // wet (h < WATER_LEVEL - 0.3), not Ciénaga, not bravas, in map
```
- [ ] **Step 1: failing tests.** For 4 seeds: the wild fish sits in the shallows (`HALF+50 < z < HALF+90`) with depth 1.5–3.5; 6 rings, consecutive gaps 10–14 m (first from home), each depth 1–3.5 and in the shallows band, same list for the same seed. `inBravas` true at the island edge + 10, false + 40. `fishStepOk` false on the beach, in the Ciénaga and in aguas bravas, true in shallows and deep sea. `fishFloor` < WATER_LEVEL in the deep sea.
- [ ] **Step 2: implement** (seeded `createRng(seed ^ 0xf154)`, bounded tries with a fallback).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): reglas del pez (anillos, aguas bravas)`.

### Task 2: Taming the fish on the server (protocol v14)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`; Tests `protocol.test.ts`, `world-sim.test.ts`.

**Interfaces:**
```ts
// Live: race: { i: number; deadline: number } | null; raceReadyAt: number; fish: boolean;
//       tame gains beast: 'deer' | 'fish' and an anchor x/z (leash + calm are measured from it)
// SelfState: fish: boolean (owns one), onFish: boolean, race: { i: number; deadline: number } | null
// PlayerView.ride: 'deer' | 'fish' | null ; snap.fish: SteedView[] (wild owner null + parked)
// SavedPlayer.fish?: { x: number; z: number }
```
- [ ] **Step 1: failing tests.** `decodeClient` accepts acts 6–8, rejects 9. Act 6 ≤ `FISH.reach` from the wild fish starts a race ("Se escapa. Sigue los anillos"); far away / already owning one / during retry does nothing (or a toast). Standing on rings in order (with `step`) advances `race.i`; skipping order does not count; waiting past 7 s → "Se escapa" and a 3 s retry. After ring 6 a taming round starts with `FISH.rounds` speeds; two good taps → `SavedPlayer.fish` set, `onFish` true, `ride: 'fish'` in the snapshot, toast. A bad tap throws you off (retry). A friend ≤ 6 m widens the zone ×1.5. `snap.fish` shows the wild fish (owner null) to anyone near it.
- [ ] **Step 2: implement** (`stepRace` in `step`; `stepTaming` leash from the tame anchor; existing deer tests updated for the `ride` union — intentional protocol change).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): domar al pez grande (carrera de anillos, protocolo v14)`.

### Task 3: Riding and diving on the server

**Files:** Modify `src/shared/sim/world-sim.ts`; Test `world-sim.test.ts`.

- [ ] **Step 1: failing tests.** A fish rider's 14 m/s surface move in the sea is accepted, 20 m/s rejected; a move onto the beach, into the Ciénaga or into aguas bravas is rejected (`fix`); a dive to `fishFloor` + 0.1 is accepted, below `fishFloor` − 1 rejected; the deep-water current does not apply. Act 8 in depth < 1 gets you off (fish parked there, 2 s grace at cap 15); in deep water → toast "Aquí es hondo. Acércate a la orilla". Act 7 ≤ reach from your parked fish mounts it. On the fish you cannot mount the deer, board a seat, or enter the Raíz-madre (dismounts); death and away drop you off the fish.
- [ ] **Step 2: implement** in `onMove` (a fish branch for y and wet checks and the cap), `onMount`, `dismount`, `kill`/`teleport` paths, `steedViews` for parked fish.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): montar y bucear en el pez`.

### Task 4: Client — fish, rings, riding, dive

**Files:** Create `src/client/scene/fish.ts`; Modify `src/client/movement.ts`, `src/client/mount-ui.ts`, `src/client/game.ts`, `src/client/hud.ts` (race line); Tests `movement.test.ts`, `mount-ui.test.ts`.

- [ ] **Step 1: failing tests.** `stepBody` with `b.fish`: surface speed 9 / 14 sprint, no stamina spent; stops at the shore and at the aguas bravas edge; jump held sinks at 3 m/s down to `fishFloor`, release rises at 4 m/s to swim level. `mountAction`: near the wild fish (no fish owned) → `{6, 'Domar al pez'}`; racing → null; on the fish in depth < 1 → `{8, 'Bajar del pez'}`; near your parked fish → `{7, 'Montar el pez'}`.
- [ ] **Step 2: implement.** `FishMeshes` (a boxy fish + tail, golden halo for the wild one, a fish under every fish rider). Race rings as torus meshes on the water: the next one bright, the rest faint; HUD line "Anillo 3/6 · 5 s". Prompt text via `mountAction` labels. Riders sit `FISH.height` above the fish.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente del pez (anillos, montar, bucear)`.

### Task 5: Ship

- [ ] Push `aventura/slice-1`; append "Slice 2 · S2-B" to `docs/superpowers/HANDOFF-aventura.md`; one short comment on PR #2. No merge, no deploy.
