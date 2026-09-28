# Aventura — Slice 3 · S3-D: corrupción del Pantano y La Gata Araña — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Four swamp corruption zones (ids 10–13) in the same list as the forest's 0–5 and the coast's 6–9. Zone 10 is the **Raíz-madre del Pantano** in the middle of the Laguna Negra; 11 on a montículo, 12 in open bog, 13 on the Nenúfares shore. Same visuals and night rule. **Swamp shrine orbs cleanse the nearest corrupt swamp zone** (11–13, never 10). A **world raid counter** (`SavedWorld.raidN`) and a **swamp-seen flag** (`SavedWorld.swampSeen`): once anyone has entered the swamp and while zone 10 is corrupt, **every 3rd raid is led by La Gata Araña** (`enemy2.png` paper cutout, 300 PV, bites 12 every 2 s, +20 % speed aura for raiders within 8 m, hunts the nearest player instead of the Heart). Beating her makes the rest of the raid flee (gone in 3 s), gives **2 ámbar** to each player present and a vision.

**Architecture:** `src/shared/corruption.ts` gains `SWAMP_ZONES`, `generateSwampZones(terrain, seed)` and `isSwampZone`; `isCoastZone` narrows to 6–9; `allZones` appends swamp zones. New pure module `src/shared/sim/lieutenant.ts` (`GATA` constants, `gataLeads`, `stepGata`, `hasteNear`). `EnemyKind` gains `'lieut1'`; `Wolf` gains optional `haste`. The sim keeps `raidN`, `swampSeen`, the Gata's id and a flee timer.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-3-pantano-design.md` §7, §8, §11, §14.2 (row S3-D of §15).

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES` (`NAMES.lieutenant1`, `NAMES.swampRoot`, `NAMES.amber`).
- **Touch grid stays at 10 pills.** No new action: orbs (A) and normal combat.
- **Trust boundary:** no new client message; everything is server-side.
- **Protocol:** Task 2 bumps 26 → 27 (the shared zone list changes), Task 3 bumps 27 → 28 (`EnemyKind` + `'lieut1'`). New saved fields `raidN?`, `swampSeen?` optional; old saves load with swamp zones corrupt.
- **[D] Swamp ids fixed 10–13**, whatever the forest count: saved `cleansed` never shifts.
- **[D] Fuego cleansing is S3-E:** leave `// S3-E` markers (Llamarada ≤5 m of a swamp root cleanses 11–13). **Zone 10 is cleansed by El Zancudo (S3-F)**: `// S3-F` marker. Enredadera and Viento never cleanse swamp zones.
- **[D] "Every 3rd raid"** = raids whose `raidN` (counted at the dusk warning, 1-based) is a multiple of 3. The counter always counts, even before the swamp is seen.
- **[D] "Players present"** for the amber drop = alive players within 40 m of her when she falls.
- **[D] "Stays behind her pack":** she spawns 10 m further out than the raiders; with no player within 28 m she walks toward the Heart and stops 14 m short of it (never chews structures).
- **[D] Flee** = raid wolves stop attacking and run away from the Heart for 3 s, then vanish. The night still counts as survived at dawn.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Swamp zones (shared)

**Files:** Modify `src/shared/corruption.ts`; Test `src/shared/corruption.test.ts`.

**Interfaces:**
```ts
export const SWAMP_ZONES = { firstId: 10, root: 10, r: 16, rootR: 18 } as const;
export function isCoastZone(id: number): boolean;  // 6..9 (was >= 6)
export function isSwampZone(id: number): boolean;  // >= 10
export function generateSwampZones(terrain: Terrain, seed: number): Zone[]; // ids 10,11,12,13
// allZones(...) = forest + coast + swamp
```
- [x] **Step 1: failing tests.** For 4 seeds: `allZones` ends with ids 10–13; 10 at the Laguna centre (r 18); 11 centre on a montículo (dry); 12 in bog (`inBog`); 13 within 4 m of the Nenúfares shore pad (`generateSwampShrines(...)[1].parts[0]`); all four `inSwamp`, no two overlap. `isCoastZone(10) === false`, `isSwampZone(10)`, `isSwampZone(9) === false`. `coastRaidBrutes([6,7,10,11]) === 1` (swamp zones don't count).
- [x] **Step 2: implement** (mound farthest from the Laguna that is dry; bog point by seeded search `createRng(seed ^ 0x5a2e0)`, fallback the swamp's centre line).
- [x] **Step 3:** green, self-review, commit `feat(aventura): zonas corruptas del Pantano (reglas)`.

### Task 2: Server — swamp orbs cleanse (protocol v27)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`; Tests `protocol.test.ts`, `world-sim.test.ts`.

- [x] **Step 1: failing tests.** New world `snap.corrupt` = `[0..13]`. A swamp orb (shrine 6, gate forced open) cleanses the nearest corrupt swamp zone among 11–13 ("La luz del santuario limpia un trozo de pantano"), never 10, never forest/coast. A coast orb never cleanses swamp zones. Enredadera at zone 11's root cleanses nothing. Night rule: a player in zone 11 at dusk brings extra beasts. Old save `cleansed: [0,6]` loads with 10–13 corrupt. Version → 27 (intentional).
- [x] **Step 2: implement.** Resolve the `// S3-D` marker in `onShrine`; the vine filter excludes swamp; add `// S3-E` (Llamarada cleanses 11–13) and `// S3-F` (Zancudo cleanses 10) markers.
- [x] **Step 3:** green, self-review, commit `feat(aventura): corrupción del Pantano en el servidor (protocolo v27)`.

### Task 3: La Gata Araña (rules + server, protocol v28)

**Files:** Create `src/shared/sim/lieutenant.ts` + test; Modify `src/shared/protocol.ts` (`EnemyKind`), `src/shared/sim/wolves.ts` (`ENEMY.lieut1`, label, `haste`), `src/shared/sim/marchito.ts` (`VISION.gata`), `src/shared/sim/world-sim.ts`; Tests.

**Interfaces:**
```ts
export const GATA = { hp: 300, damage: 12, biteCooldown: 2, aura: 8, haste: 1.2, every: 3, amber: 2, present: 40, fleeFor: 3, behind: 10, hold: 14, sight: 28 } as const;
export function gataLeads(raidN: number, swampSeen: boolean, corrupt: readonly number[]): boolean; // swampSeen && corrupt has 10 && raidN % 3 === 0
export function stepGata(w: Wolf, targets: WolfTarget[], goal: RaidGoal, terrain: Terrain, dt: number, rng: () => number): string | null;
```
- [x] **Step 1: failing tests.** Pure: `gataLeads` truth table; `stepGata` chases a player at 20 m and bites; with nobody near it walks to the Heart and stops ~14 m away; `stepRaider` with `haste: 1.2` moves 20 % further. Sim: entering `inSwamp` sets `swampSeen` (saved). `raidN` saved and +1 per dusk warning. Raid 3 with swamp seen: warning has "La Gata Araña guía el asedio esta noche", one `lieut1` raider with 300 PV; raid 3 without swamp seen or with zone 10 cleansed: none; raid 2: none. Raiders within 8 m get haste. Killing her: the other raiders vanish within 3 s, a nearby player gets +2 ámbar, a far one doesn't, a vision with "Mi gata". Old save without `raidN` loads (0). Version → 28.
- [x] **Step 2: implement.**
- [x] **Step 3:** green, self-review, commit `feat(aventura): La Gata Araña guía asedios (protocolo v28)`.

### Task 4: Client — the Gata as a paper cutout

**Files:** Modify `src/client/game.ts`.
- [x] **Step 1:** `GATA_IMG = '/enemies/enemy2.png'` (408 × 512, real alpha), `PaperActor(GATA_IMG, 2.6, camera, 408 / 512)` for `lieut1`, white tint (not the boss's weak tint). Health bar label if the HUD lists enemy kinds. `check` + `build` (pure logic already covered).
- [x] **Step 2:** green, self-review, commit `feat(aventura): cliente de La Gata Araña`.

### Task 5: Ship

- [x] Push `aventura/resto`; append "Slice 3 · S3-D" to `docs/superpowers/HANDOFF-aventura.md`; one short comment on PR #3. No merge, no deploy.
