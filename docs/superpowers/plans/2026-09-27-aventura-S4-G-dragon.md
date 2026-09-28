# Aventura — Slice 4 · S4-G: el Dragón — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The fourth mount and the slice's payoff. On **storm** days, once El Cucurucho is purified (`purified4`), **el Dragón Marchito** (`public/enemies/enemy4.png`, paper cutout 8 m wide, purple tint) circles **el Pico**: radius 14 m, 8 m below the top, one lap every 10 s. From the Pico's edge, **A** when it passes under you (≤ 4 m horizontally, below you) → you land on it and the timing ring runs **5 rounds** (3.4 → 5.4 rad/s, zone 0.9 → 0.5 rad), **reversing** on rounds 3 and 5. Fail = thrown off in the air → glider. Won: **el Dragón** is yours (personal, like deer/fish/frog). **Simplified flight:** stick steers at 15 m/s, **hold B = climb 4 m/s**, release = descend 2 m/s, no stamina, **ceiling ground + 35 m** (absolute y ≤ 120). Lands when it touches ground/water; A gets off (only landed); A near your parked dragon gets back on. **One passenger** ("Subir detrás de …", the usual act 4). No aerial combat. A **muro de niebla** north of the rim turns it back: "La niebla te devuelve. Aún no".

**Architecture:** Pure rules in a new `src/shared/dragon.ts` (`DRAGON`, `dragonOut`, `dragonPos`, `dragonCeil`, `inFog`, `leapOk`), used by `WorldSim` and the client. The wild dragon is a pure function of `(seed, time, purified4)` — no state, no network beyond `purified4`. The ring reuses `Live.tame` with `beast: 'dragon'`; **reversal = negative speed** (`ringAngle` already wraps negatives, so the client needle needs no new field). Riding is live-only `Live.dragon`; the parked dragon is `SavedPlayer.dragon?: {x, z}` (optional: old saves load).

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-4-montanas-design.md` §10 (Mount: el Dragón Marchito), §14, §16 (dragon vision), plan map row S4-G.

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES.dragon` / `NAMES.dragonWild` (add them).
- **Touch grid stays at 10 pills.** Leap / tame tap / mount / get off = contextual **A** (E / M). Climb = **B** held (Space) while flying.
- **Trust boundary:** client messages through `decodeClient`; the server checks the leap window from the pure `dragonPos`, the ring timing, who rides, speed cap **17**, height ≤ `min(ground + 36, 120)`, the fog wall, landing near the Heart in a raid.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 40 → 41 (mount acts 15–17, `TameView.beast`/`PlayerView.ride` + `'dragon'`, `SelfState.dragon`/`onDragon`, `snap.dragons`). Task 3 bumps 41 → 42 (flight rules change what the server accepts).
- **[D] Fold into `mount`** like fish/frog: 15 = leap from the Pico, 16 = get on your dragon, 17 = get off. Act max 14 → 17.
- **[D] Personal** (spec §10): one wild dragon shape for everyone, each player tames their own copy.
- **[D] A missed leap does not jump:** the server only accepts or tells "Aún no. Espera a que pase por debajo". Nobody is thrown off the Pico by a bad guess; the fall-and-glide happens only when the ring throws you off (you are already in the air on its back).
- **[D] No enemy id for the dragon:** it is drawn from `snap.dragons` (wild = owner null, computed from time) like the frog, so the special-ids test is untouched.
- **[D] Raid rule:** during a raid a dragon rider within 30 m of the Heart cannot land (server rejects y < ground + 5 there; client holds ground + 6; A to get off says "Aquí no se aterriza en pleno asedio").
- **[D] Dungeons:** entering any dungeon, death or teleport drops you off the dragon (it stays parked), exactly as with the frog.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Dragon rules (shared)

**Files:** Create `src/shared/dragon.ts`, `src/shared/dragon.test.ts`; Modify `src/shared/names.ts`.

**Interfaces:**
```ts
export const DRAGON = {
  radius: 14, below: 8, lap: 10, leapR: 4, leapMaxDrop: 14,
  rounds: [{ speed: 3.4, width: 0.9 }, { speed: 3.9, width: 0.8 }, { speed: -4.4, width: 0.7 }, { speed: 4.9, width: 0.6 }, { speed: -5.4, width: 0.5 }],
  fly: 15, climb: 4, sink: 2, ceil: 35, maxY: 120, maxSpeed: 17, serverCeil: 36, grace: 2, reach: 5,
  heartNoLand: 30, raidFloor: 5, height: 1.2, width: 8,
} as const;
export function dragonOut(seed: number, day: number, purified4: boolean): boolean;  // storm that day && purified4
export function dragonPos(pico: { x: number; z: number; top: number }, time: number): { x: number; y: number; z: number; yaw: number };
export function dragonCeil(ground: number): number;   // min(ground + ceil, maxY)
export function inFog(z: number): boolean;            // north of the rim (z < -HALF - MOUNTAINS.rimFrom)
export function leapOk(pico, time, p: { x: number; y: number; z: number }): boolean; // ≤ leapR horizontal, below you, not more than leapMaxDrop
export function picoOf(t: Terrain, seed: number): { x: number; z: number; top: number };
```
- [ ] **Step 1: failing tests.** `dragonOut` false without `purified4`, false on a clear day, true on a storm day with it. `dragonPos` is 14 m from the Pico centre, `top − 8` high, back to the same place after 10 s, and moves ~8.8 m/s. `dragonCeil(10) = 45`, `dragonCeil(100) = 120`. `inFog` true past the rim, false in the Faldas. `leapOk` true standing on the Pico edge at the instant the dragon is right below, false 1/4 lap later and false if you are below it. 5 rounds, rounds 3 and 5 negative. Names present.
- [ ] **Step 2: implement.**
- [ ] **Step 3:** green, self-review, commit `feat(aventura): reglas del dragón (vuelta al Pico, salto, techo, niebla)`.

### Task 2: Leap and taming on the server (protocol v41)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`; Tests `protocol.test.ts`, new `src/shared/sim/world-sim-s4g.test.ts`.

**Interfaces:**
```ts
// Live: dragon: boolean; tame.beast + 'dragon' (while taming the dragon the server carries you along its circle)
// SelfState: dragon: boolean (owns one), onDragon: boolean
// PlayerView.ride + 'dragon'; TameView.beast + 'dragon'; snap.dragons: SteedView[] (wild owner null while out + parked)
// SavedPlayer.dragon?: { x: number; z: number }
```
- [ ] **Step 1: failing tests.** `decodeClient` accepts mount act 15–17, rejects 18. On a storm day with `purified4`, a player on the Pico placed right above the dragon: act 15 starts a 5-round tame (`self.tame.beast 'dragon'`, `rounds 5`); a quarter lap off → toast "Aún no…", no tame; no storm or no `purified4` → nothing. While taming, the server keeps the player on the dragon's circle. Five good taps (round 3 and 5 needle runs backwards) → `SavedPlayer.dragon` set, `onDragon`, `ride 'dragon'`, vision «Mi dragón… Eso sí que no, <nombre>». A bad tap → thrown off: tame null, player left in the air (a following descending move is accepted). `snap.dragons` carries the wild dragon only while it is out.
- [ ] **Step 2: implement** (`roundsOf` + dragon; `onDragonAct`; carry in the tick like `stepSeats`; `dragonViews`).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): saltar al dragón y domarlo (protocolo v41)`.

### Task 3: Flying on the server (protocol v42)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`; Test `world-sim-s4g.test.ts`.

- [ ] **Step 1: failing tests.** A dragon rider's 15 m/s move is accepted, 25 m/s rejected; ground + 30 accepted, ground + 40 rejected, y 125 rejected; slopes and the steep rule do not apply in the air; a move into the fog (past the rim) rejected with "La niebla te devuelve. Aún no". Act 17 while high up → nothing; on the ground → off (dragon parked, grace 2 s at cap 17). Act 16 ≤ reach from your parked dragon → on. A passenger (act 4 near a dragon rider) sits behind and is carried; a second one cannot. During a raid, a rider near the Heart moving to ground + 1 is rejected; act 17 there toasts. Dungeon entry drops you off. Walkers still capped at 9.
- [ ] **Step 2: implement** in `onMove` (dragon branch before the ground checks), `board`/`stepSeats` (rider = deer **or** dragon), `dismount`.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): volar en el dragón (techo, niebla, pasajero)`.

### Task 4: Client — dragon, leap, ring, flight, fog

**Files:** Create `src/client/scene/dragon.ts`; Modify `src/client/movement.ts`, `src/client/mount-ui.ts`, `src/client/game.ts`, `src/client/camera-rig.ts` (if needed); Tests `movement.test.ts`, `mount-ui.test.ts`.

- [ ] **Step 1: failing tests.** `stepBody` with `b.dragon`: 15 m/s along the stick, B held climbs 4 m/s, released sinks 2 m/s, never above `dragonCeil`, stops at the fog, lands on ground/water (onGround), no stamina spent. `mountAction`: taming → `{1}`; on the dragon landed → `{17, 'Bajar del dragón'}`, in the air → null; near your parked dragon → `{16, 'Montar el dragón'}`; on the Pico with the wild dragon out and none owned → `{15, 'Saltar al dragón'}`.
- [ ] **Step 2: implement.** `DragonMeshes`: one textured double-sided quad (enemy4.png, 8 m) per visible dragon, purple tint for the wild one, a gold ring on the Pico edge when the leap window is open; riders sit `DRAGON.height` above it. Flying pulls the camera back (distance ×1.6, a little higher) — no extra draw distance or lights (phone). A thin grey fog plane along the rim (one mesh). Prompt "Espacio (mantener) · Subir" while flying.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente del dragón (vuelta, salto, vuelo, niebla)`.

### Task 5: Ship

- [ ] Full suite green; push `aventura/resto`; append "## Slice 4 · S4-G — el Dragón — HECHO" to `docs/superpowers/HANDOFF-aventura.md`; one short comment on PR #3.
