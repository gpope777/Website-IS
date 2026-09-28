# Aventura — Slice 3 · S3-B: la Rana — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The third mount. One wild frog waits on the montículo closest to the Laguna Negra's north shore (golden halo). Each player tames their own copy: press A near it, it hops away to **3 lily pads** (8–12 m apart over bog water); reach each (≤ 2.5 m) within **6 s**. Then the timing ring, **3 rounds** (3.0 → 4.6 rad/s, zone 1.1 → 0.7). Riding: land and water up to **2 m** deep, 8 m/s, sprint 11 (no stamina), bog does not slow it, server cap **12**. **B = salto alto:** 7 m up, 9 m forward, cooldown 1.2 s, lands on anything, no fall damage. A anywhere gets off; the frog waits there. Not in dungeons. The Zarzal still bites.

**Architecture:** Frog rules are pure functions in a new `src/shared/frog.ts` (`FROG`, `wildFrog`, `frogPads`, `frogStepOk`, `frogHop`), used by `WorldSim` and `client/movement.ts`. The chase reuses the fish race (`Live.race` gains `beast`), the ring reuses `Live.tame` (`beast` gains `'frog'`). Riding is live-only `Live.frog` (like `riding`/`fish`); the parked frog is `SavedPlayer.frog?: {x, z}` (optional: old saves load).

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-3-pantano-design.md` §5 (la Rana), §14.2, §15 (row S3-B).

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Name via `NAMES.frog`.
- **Touch grid stays at 10 pills.** Taming / mounting / getting off is the contextual **A** (E / M). The high jump is **B** (Space) while riding — no new button.
- **Trust boundary:** client messages through `decodeClient`; the server validates reach, pad order and deadlines, depth ≤ 2 m, speed cap 12, jump height.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 23 → 24: `mount` acts 12/13/14, `PlayerView.ride` + `'frog'`, `TameView.beast` + `'frog'`, `SelfState.frog` / `onFrog`, `SelfState.race.beast`, `snap.frogs: SteedView[]`. Saved field `SavedPlayer.frog?` only.
- **[D] Fold into `mount`** like the fish: 12 = start the chase, 13 = get on your frog, 14 = get off. `mount` act max 11 → 14.
- **[D] The wild frog sits still at its seeded home** (server); the client bobs it for show. The pads are seeded, the client computes the same list.
- **[D] Pads are wadeable** (bog, depth < 0.6 m) so the chase is done on foot.
- **[D] Frog floats at `WATER_LEVEL`** in water (≤ 2 m): never "swimming" for the server's sea rule.
- **[D] Jump check on the server = a ceiling** (`ground + FROG.ceil`, 13 m) for frog riders instead of the usual +4; horizontal speed is the cap. No server jump physics (same "ponytail" as gliding).
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Frog rules (shared)

**Files:** Create `src/shared/frog.ts`, `src/shared/frog.test.ts`.

**Interfaces:**
```ts
export const FROG = {
  reach: 4, pads: 3, padGap: [8, 12], padR: 2.5, padTime: 6, retry: 3,
  rounds: [{ speed: 3.0, width: 1.1 }, { speed: 3.8, width: 0.9 }, { speed: 4.6, width: 0.7 }],
  walk: 8, run: 11, maxSpeed: 12, grace: 2, deep: 2, height: 0.7,
  hop: { up: 7, fwd: 9, cd: 1.2 }, ceil: 13,
} as const;
export function wildFrog(t: Terrain, seed: number): { x: number; z: number };  // top of the montículo closest to the Laguna's north shore
export function frogPads(t: Terrain, seed: number, home: { x: number; z: number }): { x: number; z: number }[]; // 3, 8–12 m apart, bog
export function frogStepOk(t: Terrain, x: number, z: number): boolean;        // in map, water ≤ FROG.deep
export function frogHop(gravity: number): { vy: number; fwd: number };        // launch speeds for 7 m up / 9 m forward
```
- [ ] **Step 1: failing tests.** For 4 seeds: the wild frog is in the swamp, on dry ground (above `WATER_LEVEL`), within 30 m of the Laguna's north end and outside the Zarzal; 3 pads, gaps 8–12 m (first from home), each in the bog (`inBog`), same list for the same seed. `frogStepOk` true on a montículo and in the bog, false in the Laguna's deep middle and outside the map. `frogHop(14)`: apex = 7 m (±0.1) and forward travel over the flight = 9 m (±0.1).
- [ ] **Step 2: implement** (seeded `createRng(seed ^ 0xf209)`, bounded tries with the fish's fallback).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): reglas de la rana (nenúfares, salto alto)`.

### Task 2: Taming the frog on the server (protocol v24)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`; Tests `protocol.test.ts`, `world-sim.test.ts`.

**Interfaces:**
```ts
// Live: race gains beast: 'fish' | 'frog'; tame.beast: 'deer' | 'fish' | 'frog'; frog: boolean
// SelfState: frog: boolean (owns one), onFrog: boolean, race: { i; deadline; beast } | null
// PlayerView.ride + 'frog'; TameView.beast + 'frog'; snap.frogs: SteedView[] (wild owner null + parked)
// SavedPlayer.frog?: { x: number; z: number }
```
- [ ] **Step 1: failing tests.** `decodeClient` accepts mount acts 12–14, rejects 15. Act 12 ≤ `FROG.reach` from the wild frog starts a chase ("Salta al agua. Sigue los nenúfares"); far / already owning one / during retry does nothing or toasts. Standing on pads in order advances `race.i`; waiting past 6 s → "Se escapa" + 3 s retry. After pad 3 a 3-round taming starts; three good taps → `SavedPlayer.frog` set, `onFrog`, `ride: 'frog'`, toast. A bad tap → retry. `snap.frogs` shows the wild frog to anyone near. The fish race still works (race.beast 'fish').
- [ ] **Step 2: implement** (`stepRace` picks list/radius/time by beast; `roundsOf` + frog; `nextRound`/`throwOff` share the race retry).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): domar a la rana (nenúfares, protocolo v24)`.

### Task 3: Riding and the high jump on the server

**Files:** Modify `src/shared/sim/world-sim.ts`; Test `world-sim.test.ts`.

- [ ] **Step 1: failing tests.** A frog rider's 11 m/s move over the bog is accepted (no 60 % bog cap), 20 m/s rejected; a move into water deeper than 2 m rejected; a jump to ground + 7 accepted (walkers' +4 rule does not apply), ground + 15 rejected; the Zarzal still bites and still caps at 3 m/s. Act 14 anywhere gets off (frog parked, 2 s grace at cap 12). Act 13 ≤ reach mounts. On the frog you cannot mount the deer / fish, board a seat or the whale; entering a dungeon, death and teleport drop you off the frog.
- [ ] **Step 2: implement** in `onMove` (frog cap, depth, ceiling), `onMount`, `dismount`, `frogViews`.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): montar la rana y el salto alto`.

### Task 4: Client — frog, pads, riding, jump

**Files:** Create `src/client/scene/frog.ts`; Modify `src/client/movement.ts`, `src/client/mount-ui.ts`, `src/client/game.ts`; Tests `movement.test.ts`, `mount-ui.test.ts`.

- [ ] **Step 1: failing tests.** `stepBody` with `b.frog`: speed 8 / 11 sprint, bog does not slow, stamina not spent; stops before water deeper than 2 m; B (fresh press, on ground) jumps ~7 m high and ~9 m forward, a second press within 1.2 s does nothing; floats at `WATER_LEVEL` in shallow water. `mountAction`: near the wild frog (none owned) → `{12, 'Domar a la rana'}`; racing → null; on the frog → `{14, 'Bajar de la rana'}`; near your parked frog → `{13, 'Montar la rana'}`.
- [ ] **Step 2: implement.** `FrogMeshes` (boxy green frog, pale throat, golden halo for the wild one, one under every frog rider; instanced-free, a few meshes). Lily pads as flat green discs (next one bright). HUD line "Nenúfar 2/3 · 4 s". Prompt "Espacio · Salto alto" while riding. Riders sit `FROG.height` above.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente de la rana (nenúfares, montar, salto)`.

### Task 5: Ship

- [ ] Push `aventura/resto`; append "Slice 3 · S3-B" to `docs/superpowers/HANDOFF-aventura.md`; one short comment on PR #3. No merge, no deploy.
