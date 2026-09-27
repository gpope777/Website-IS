# Aventura — Slice 2 · S2-D: corrupción de la Costa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four coast corruption zones (ids 6–9) in the same list as the forest's 0–5. Zone 6 is the **coast Raíz-madre** on the dungeon island; 7 on the beach, 8 in the shallows, 9 on an islet. Same visuals and same night rule (+2 beasts per player standing in one). **Coast shrine orbs cleanse the nearest corrupt coast zone** (never 6, never a forest zone); forest orbs never cleanse coast zones. **Raid pressure:** while zone 6 is corrupt, every raid gets **+1 brute per 2 corrupt coast zones**, and the dusk warning adds "Algo sube de la costa". Raids still come from the corrupt zone nearest the Heart, over all 10 zones.

**Architecture:** `src/shared/corruption.ts` gains `COAST_ZONES` and `generateCoastZones(terrain, seed)` (fixed ids 6–9, placed from `coastFeatures(seed)` and the `COAST` bands), and `generateZones` appends them after the forest zones, so client and server keep one `Zone[]`. A pure `coastRaidBrutes(corrupt)` gives the extra brutes. `SavedWorld.cleansed` already stores any ids: no new saved field. Protocol bump 16 → 17 because the zone list both sides derive from the seed changes (an old client would not draw the coast zones).

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-2-costa-design.md` §6.4, §11.2, §12 (row S2-D). The "Decisiones de Gabriel" block overrides the rest (nothing there changes S2-D).

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES` (`NAMES.coastRoot`, `NAMES.biomeCoast`).
- **Touch grid stays at 10 pills.** No new action: cleansing happens through the existing orb (A).
- **Trust boundary:** no new client message; everything is server-side from validated positions.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 16 → 17. No new saved fields; old saves load (their `cleansed` has only forest ids, so coast zones start corrupt).
- **[D] Forest zone ids stay 0–5 and coast ids are fixed 6–9**, even if a seed fits fewer than 6 forest zones: saved `cleansed` ids never shift.
- **[D] Enredadera cleanses forest zones only.** The spec's coast mirror is Viento (S2-F); left as a `// S2-F` marker.
- **[D] Zone 6 is cleansed by beating the coast boss (S2-G);** a `// S2-G` marker. Until then the raid pressure stays at least +1 brute while 2+ coast zones are corrupt.
- **[D] Extra brutes are added on top of `RAID.maxWave`** and also after the forest boss is purified: the coast pressure is its own number.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Coast zones (shared)

**Files:** Modify `src/shared/corruption.ts`; Test `src/shared/corruption.test.ts`.

**Interfaces:**
```ts
export const COAST_ZONES = { firstId: 6, root: 6, r: 16, rootR: 18 } as const;
export function generateCoastZones(terrain: Terrain, seed: number): Zone[]; // ids 6,7,8,9
export function isCoastZone(id: number): boolean;           // id >= 6
export function coastRaidBrutes(corrupt: readonly number[]): number; // corrupt.includes(6) ? floor(#coast corrupt / 2) : 0
// generateZones(...) now returns forest zones (0..5) + generateCoastZones(...)
```
- [ ] **Step 1: failing tests.** For 4 seeds: `generateZones` has ids 6–9 after the forest ones, forest zones unchanged vs. the forest-only list. Zone 6 centre = the dungeon island centre. Zone 7 dry on the beach (`HALF+20 < z < HALF+50`), zone 8 in the shallows (depth 0.5–4), zone 9 on an islet centre. Coast zones don't overlap each other. `coastRaidBrutes([6,7,8,9]) = 2`, `([6,7]) = 1`, `([6]) = 0`, `([7,8,9]) = 0`, `([0,1]) = 0`.
- [ ] **Step 2: implement** (seeded `createRng(seed ^ 0xc0a2e)`, bounded tries along x with a fallback at x = 0).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): zonas corruptas de la costa (reglas)`.

### Task 2: Server — orbs, raid pressure, warning (protocol v17)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`; Tests `protocol.test.ts`, `world-sim.test.ts`.

- [ ] **Step 1: failing tests.** `snap.corrupt` of a new world = `[0..9]`. A coast orb cleanses the nearest corrupt coast zone among 7–9 ("La luz del santuario limpia un trozo de costa"); never 6, never a forest zone. A forest orb never cleanses a coast zone (a world with all forest zones but 0 cleansed: forest orb cleanses nothing). Enredadera at a coast zone's root cleanses nothing. Raid with 6–9 corrupt spawns 2 extra brutes and the warning contains "Algo sube de la costa"; with 6 cleansed (set via save) no extra brutes and no line. Night rule: a player standing in coast zone 7 at dusk brings extra beasts. Old save with `cleansed: [0,1]` loads, coast zones corrupt. Version tests → 17 (intentional).
- [ ] **Step 2: implement** (`onShrine` filter by coast/forest; vine filter `!isCoastZone`; `spawnRaiders` adds `coastRaidBrutes` brutes; `stepRaid` warning line; `// S2-F`, `// S2-G` markers).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): corrupción de la costa en el servidor (protocolo v17)`.

### Task 3: Client — tint the far sea mesh too

**Files:** Modify `src/client/game.ts`.

Coast zones already get their withered root (the zone list is shared). Zones 6 and 9 lie on the coarse far mesh, which was "never tinted": tint it too (colours only, on corrupt-set change).
- [ ] **Step 1:** keep the far mesh in a field and call `tintTerrain` on both meshes. (No pure logic: covered by `taintAt` tests; `check` + `build`.)
- [ ] **Step 2:** green, self-review, commit `feat(aventura): cliente de la corrupción de la costa`.

### Task 4: Ship

- [ ] Push `aventura/slice-1`; append "Slice 2 · S2-D" to `docs/superpowers/HANDOFF-aventura.md`; one short comment on PR #2. No merge, no deploy.
