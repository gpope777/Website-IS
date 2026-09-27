# Aventura — Slice 2 · S2-E: la Ballena — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The third mount. One wild whale per world spouts in the deep sea at a seeded spot. **It needs at least 2 players within 10 m to be tamed** (Gabriel's decision: never solo). Taming is the timing ring, **4 rounds** (2.2 → 4.8 rad/s, zone 1.2 → 0.55 rad), each zone ×(1 + 0.4 × extra players, up to 3 extra); any player in range may tap and the first good tap counts. A bad tap (or dropping under 2 players) makes it dive 10 s. Once tamed it belongs to the world (`SavedWorld.whale`). **4 seats**: seat 0 is the pilot (first aboard), the rest are passengers placed by the server. 5 m/s, sprint 7, surface only, never shallower than 3 m ("La ballena no cabe"), **can cross the aguas bravas** (the only way to the dungeon island). With nobody aboard for 10 min of online time it goes back home.

**Architecture:** Pure rules in a new `src/shared/whale.ts` (`WHALE`, `wildWhale`, `whaleStepOk`, `whaleWidth`, `seatOffset`, `canTame`), shared by `WorldSim` and `client/movement.ts`. Taming is **world** state in the sim (`whaleTame = { round, start, zone } | null`, `whaleReadyAt`), shown to every player in range as their `SelfState.tame` with `beast: 'whale'`, so the client's ring UI and act 1 are reused unchanged. Seats are live-only (`whaleSeats: (string|null)[4]`), like the deer passenger (S2-A): the pilot's validated moves move the whale; `stepWhale` places passengers every tick and compacts the seats (pilot leaves → seat 1 is pilot).

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-2-costa-design.md` §3.3 (whale riders), §5.2 (whale), §11.2, §12 (row S2-E). The "Decisiones de Gabriel" block overrides §5.2's "solo is possible but hard": **minimum 2 players**.

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES.whale`.
- **Phones first. Touch grid stays at 10 pills.** Taming, boarding and leaving are the contextual **A** (keyboard E / M); the ring tap is A or B as today. Sprint is the existing sprint.
- **Trust boundary:** every client message through `decodeClient`; the server checks reach (10 m to tame, 5 m to board), the 2-player minimum, the seat, the 3 m depth rule and speed.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 17 → 18: `mount` acts 9/10/11, `TameView.beast` gains `'whale'`, `PlayerView.ride` gains `'whale'`, `SelfState.whaleSeat`, `snap.whale: WhaleView`. New saved field `SavedWorld.whale?` only: old saves load (untamed).
- **[D] Fold into `mount`:** 9 = start taming the whale, 10 = board, 11 = leave. Act 1 (ring tap) serves all beasts.
- **[D] Range = within 10 m of the whale, alive and connected** (not "on a fish"): nobody reaches 10 m of the deep sea except on a fish or the whale anyway.
- **[D] The wild whale holds still at home** (like the fish); the client bobs it and draws the spout.
- **[D] Leaving puts you in the water beside it** (2 m to the side). If your parked fish is within 8 m you are back on it; boarding from the fish parks it where you were.
- **[D] Return home = snap back** after 10 min with no riders (counted only while someone is online); the client lerps. A swim path could beach it on an islet.
- **[D] `snap.whale` is always sent** (one small object) so the spout is seen from the beach.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Whale rules (shared)

**Files:** Create `src/shared/whale.ts`, `src/shared/whale.test.ts`.

**Interfaces:**
```ts
export const WHALE = {
  tameReach: 10, reach: 5, minPlayers: 2, seats: 4,
  rounds: [{ speed: 2.2, width: 1.2 }, { speed: 3.1, width: 0.95 }, { speed: 4.0, width: 0.75 }, { speed: 4.8, width: 0.55 }],
  perExtra: 0.4, maxExtra: 3, dive: 10,
  walk: 5, run: 7, maxSpeed: 8, minDepth: 3, idle: 600, height: 2.2, fishBack: 8,
} as const;
export function wildWhale(t: Terrain, seed: number): { x: number; z: number };   // deep sea, depth ≥ 8, not bravas, not near islets
export function whaleStepOk(t: Terrain, x: number, z: number): boolean;         // in map, depth ≥ WHALE.minDepth (bravas allowed)
export function whaleWidth(base: number, players: number): number;              // base × (1 + 0.4 × min(3, players − 1))
export const canTame = (players: number) => players >= WHALE.minPlayers;
export function seatOffset(seat: number, yaw: number): { x: number; z: number }; // 0 front, 1–3 behind
```
- [ ] **Step 1: failing tests.** For 4 seeds: the whale home is in the deep sea (z > HALF + COAST.deepFrom − 10), depth ≥ 8, `whaleStepOk` there, not in bravas. `whaleStepOk` false on the beach and in the shallows (< 3 m), true in aguas bravas. `whaleWidth(1, 1) = 1`, `(1, 2) = 1.4`, `(1, 9) = 2.2`. `canTame(1)` false, `(2)` true. Seat offsets are distinct and rotate with yaw.
- [ ] **Step 2: implement** (seeded `createRng(seed ^ 0xba11e)`, bounded tries, fallback).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): reglas de la ballena`.

### Task 2: Co-op taming on the server (protocol v18)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`; Tests `protocol.test.ts`, `world-sim.test.ts`.

**Interfaces:**
```ts
export interface WhaleView { x: number; z: number; yaw: number; tamed: boolean; diving: boolean; seats: (string | null)[] }
// SavedWorld.whale?: { x: number; z: number; yaw: number }
// TameView.beast: 'deer' | 'fish' | 'whale'; SelfState.whaleSeat: number | null; snap.whale: WhaleView
```
- [ ] **Step 1: failing tests.** `decodeClient` accepts acts 9–11, rejects 12. Act 9 alone in range → "Sola no se deja. Hacen falta dos" and nothing starts. With 2 in range: taming starts, both see `self.tame.beast === 'whale'` with width 1.2 × 1.4. Four good taps (from either player) → `save().whale` set, `snap.whale.tamed`, toast to all. A bad tap → `diving`, act 9 refused for 10 s. One player leaving range mid-round (under 2) → dive. Old save without `whale` loads untamed.
- [ ] **Step 2: implement** (`whaleTame` world state; `tameView` falls back to it; act 1 routes to `whaleTap` when `l.tame` is null; `stepWhaleTame` checks range count and round timeout).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): domar la ballena entre varios (protocolo v18)`.

### Task 3: Seats, pilot, aguas bravas and return home

**Files:** Modify `src/shared/sim/world-sim.ts`; Test `world-sim.test.ts`.

- [ ] **Step 1: failing tests.** Act 10 ≤ 5 m from the tamed whale → first free seat (first aboard is seat 0, pilot); 5th player → "No queda sitio". Pilot moves at 7 m/s accepted and move the whale (also into aguas bravas); 12 m/s, or into < 3 m depth, rejected (`fix`). Passenger moves only change yaw; the passenger sits at whale + `seatOffset`. Pilot act 11 → seat 1 becomes pilot; leaving puts you 2 m to the side in the water, on your fish if it waits within 8 m. Death / away / dungeon drop you off. On the whale: no deer, no fish acts. `snap.players[].ride === 'whale'`. After 600 s online with nobody aboard the whale is back home; `save().whale` keeps its spot.
- [ ] **Step 2: implement** (`whaleSeats`, `whaleIdle`, a whale branch in `onMove`, `boardWhale`, `dismount` handles the seat, `stepWhale` in `step`).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): subir a la ballena (piloto, pasajeros, aguas bravas)`.

### Task 4: Client — whale, spout, piloting, prompts

**Files:** Create `src/client/scene/whale.ts`; Modify `src/client/movement.ts`, `src/client/mount-ui.ts`, `src/client/game.ts`; Tests `movement.test.ts`, `mount-ui.test.ts`.

- [ ] **Step 1: failing tests.** `stepBody` with `b.whale`: 5 m/s / 7 sprinting, surface only, stops where `whaleStepOk` fails, goes through aguas bravas. `mountAction`: near the wild whale (≤10 m, not tamed, not diving) → `{9, 'Domar la ballena'}`; near the tamed whale with a free seat → `{10, 'Subir a la ballena'}`; aboard → `{11, 'Bajar de la ballena'}`.
- [ ] **Step 2: implement.** `WhaleMesh` (a big boxy whale, a spout column that pulses — tall while wild), placed from `snap.whale` (the pilot's own body when we pilot). Passengers follow the snapshot like the deer passenger. Prompts and HUD reuse the ring.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente de la ballena`.

### Task 5: Ship

- [ ] Push `aventura/slice-1`; append "Slice 2 · S2-E" to `docs/superpowers/HANDOFF-aventura.md`; one short comment on PR #2. No merge, no deploy.
