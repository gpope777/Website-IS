# Aventura — Slice 2 · S2-C: santuarios de la Costa y ruinas hundidas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three coast shrines (ids 3–5 after the forest's 0–2) and the sunken ruins. **Marea** (beach): a tide plate 12 m from the orb, held down by a friend or by the **pumice block** carried with A. **Hundido** (beach + shallows): one lever on the beach, one on the seabed ~40 m out (only reachable diving on the fish); both within 8 s. **Islote** (islet 1): a fan-gate turned by 3 wheels pulled within 6 s (3 players), or by a Viento gust — **Viento arrives in S2-F**, so solo it is a "come back later" shrine now. **6 chests** on the deep seabed near 2 ruin clusters: A on the seabed (fish diving) opens yours → 6–10 wood/stone/berries + 1 **perla**. **3 perlas + 10 piedra + 5 madera** at the Heart → **weapon upgrade** (+15 % punch and bow damage, max +3).

**Architecture:** Coast shrines are seeded in a new `src/shared/coast-shrines.ts` (`generateCoastShrines`) and appended to the same `Shrine[]` list (server and client concatenate forest + coast), so views, orbs, stamina and "one orb per player" reuse the Slice 1 code. New `ShrineKind`s `'tide' | 'sunken' | 'fan'`. Chests are seeded in the same file (`generateChests`). Pearls are a new `ItemId` `'pearl'`. The upgrade is `UPGRADE` + `weaponMult(lvl)` in `items.ts`. Live puzzle state stays live-only (pumice block position/holder, lever and wheel pull times); saved: `SavedPlayer.chests?: number[]`, `SavedPlayer.weaponLvl?: number` (optional, old saves load).

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-2-costa-design.md` §6.1, §6.2, §11.2, §12 (row S2-C). The "Decisiones de Gabriel" block (perlas + mejora de arma: sí) overrides the rest.

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES` (`NAMES.pearl`, `NAMES.powerWind`, `NAMES.heart`).
- **Phones first. Touch grid stays at 10 pills.** Everything is the contextual **A** (keyboard E): levers, wheels, pick up / drop the pumice block, open a chest, upgrade at the Heart.
- **Trust boundary:** every client message through `decodeClient`; the server checks reach, the seabed depth (seabed lever and chests need `p.y ≤ seabed + 2`), holder, costs and the upgrade cap.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 14 → 15 (`shrine` part ≤ 3, `ShrineView.block?`); Task 3 bumps 15 → 16 (`chest`, `upgrade`, `SelfState.chests`, `SelfState.weapon`). New saved fields optional only.
- **Viento does not exist yet (S2-F).** The Islote fan-gate is built and visible now and opens with 3 wheels; the gust path is a `// S2-F: Viento gust opens the fan` marker plus the toast "La verja-molino no se mueve. Quizá con viento… o con tres manos". Marea's gust-slides-the-block path is also left for S2-F.
- **[D] No forge exists** in the game. The upgrade is bought at **the Heart** (the base's one landmark), A within `HEART.tendReach`, when you carry ≥3 perlas. Cost 3 perlas + 10 piedra + 5 madera ("the forge's current cost" → a fixed build-like cost).
- **[D] The pumice block does not slow you** (same as the dungeon root block): a server speed cap needs client prediction too, and the plate is 12 m away.
- **[D] Coast orbs cleanse nothing yet:** coast corruption zones come in a later plan; a coast orb must not cleanse a forest zone (spec mirror rule).
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Coast shrines, chests, pearls and the upgrade (shared)

**Files:** Create `src/shared/coast-shrines.ts`, `src/shared/coast-shrines.test.ts`; Modify `src/shared/shrines.ts` (kinds + labels), `src/shared/items.ts` (`pearl`, `UPGRADE`, `weaponMult`); Test `items.test.ts`.

**Interfaces:**
```ts
export type ShrineKind = 'levers' | 'plate' | 'ledge' | 'tide' | 'sunken' | 'fan';
// Shrine.parts: tide = [plate, blockStart]; sunken = [beach lever, seabed lever]; fan = [wheel, wheel, wheel]
export const COAST_SHRINE = { firstId: 3, tideDist: 12, sunkenGap: 8, seabedReach: 2, sunkenWindow: 8, wheelGap: 5, wheelWindow: 6 } as const;
export function generateCoastShrines(t: Terrain, seed: number): Shrine[];  // ids 3,4,5
export const CHEST = { count: 6, reach: 2.5, above: 2 } as const;
export interface Chest { id: number; x: number; y: number; z: number; loot: Inventory } // loot has 6–10 of one material + pearl 1
export function generateChests(t: Terrain, seed: number): Chest[];
// items.ts
export type ItemId = 'wood' | 'stone' | 'berries' | 'pearl';
export const UPGRADE = { pearls: 3, cost: { pearl: 3, stone: 10, wood: 5 }, step: 0.15, max: 3 } as const;
export function weaponMult(lvl: number): number; // 1 + 0.15 * clamp(lvl, 0, 3)
```
- [ ] **Step 1: failing tests.** For 4 seeds: 3 coast shrines, ids 3/4/5, kinds tide/sunken/fan, same list for the same seed. Tide: orb and both parts on dry beach (`HALF+20 < z < HALF+50`, height ≥ WATER_LEVEL+0.3), plate 12 m from the orb. Sunken: orb + beach lever dry on the beach; seabed lever in the shallows with depth 2–4 and ~35–45 m from the beach lever. Fan: orb on islet 1 (dry), 3 wheels dry, ~5 m from the orb. 6 chests in the deep sea (z > HALF+110, depth ≥ 6, not within islet/island r + 5), y = seabed height, loot = one material 6–10 + 1 pearl. `weaponMult(0)=1`, `(3)=1.45`, `(9)=1.45`.
- [ ] **Step 2: implement** (seeded `createRng(seed ^ 0xc5a1)`, bounded tries with a fallback; 2 ruin cluster centres, 3 chests scattered ≤ 12 m around each).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): santuarios y cofres de la costa (reglas)`.

### Task 2: Coast shrine puzzles on the server (protocol v15)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`; Tests `protocol.test.ts`, `world-sim.test.ts`.

- [ ] **Step 1: failing tests.** `decodeClient` accepts shrine part 3, rejects 4. `sim.shrines` has 6 (old "3 shrines" test updated: intentional). **Marea:** a player standing on the tide plate opens it (hold 3.5 s like the forest plate); part 1 near the block picks it up ("Piedra pómez. Flota, pero pesa"), part 1 again drops it where you stand; dropped on the plate the shrine stays open; the block follows the holder and drops on death. **Hundido:** part 2 (seabed lever) needs reach ≤ 2.5 and `p.y ≤ seabed + 2` (a swimmer at the surface is refused with "Está en el fondo"); both levers within 8 s open it. **Islote:** parts 1–3 are wheels; all three within 6 s open it; one alone → "La verja-molino no se mueve. Quizá con viento… o con tres manos". A coast orb gives +20 stamina and cleanses no forest zone. `ShrineView.block` for the tide shrine.
- [ ] **Step 2: implement** (`shrineLive` gains `pulled` of 3 and `block`; `onShrine` switches on kind; `stepShrines` handles tide like plate plus the block; `// S2-F` markers for Viento).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): santuarios de la costa en el servidor (protocolo v15)`.

### Task 3: Chests, pearls and the weapon upgrade on the server (protocol v16)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`; Tests `protocol.test.ts`, `world-sim.test.ts`.

**Interfaces:**
```ts
// ClientMsg: { t: 'chest'; id: number } | { t: 'upgrade' }
// SelfState: chests: number[]; weapon: number
// SavedPlayer: chests?: number[]; weaponLvl?: number
```
- [ ] **Step 1: failing tests.** Decode `chest` (integer id) and `upgrade`. A diver at the chest (reach 2.5, `y ≤ chest.y + 2`) opens it: loot added, pearl +1, toast "Cofre hundido: … y una perla"; again → nothing; a swimmer at the surface → nothing; another player can open their own. Upgrade near the Heart with 3 perlas + 10 piedra + 5 madera → `weapon` 1, cost removed, toast; without → "Faltan materiales"; far from the Heart → nothing; at 3 → "El arma ya no da más de sí". Punch and bow damage × `weaponMult`. Old saves without `chests`/`weaponLvl` load (0).
- [ ] **Step 2: implement.**
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cofres hundidos, perlas y mejora de arma (protocolo v16)`.

### Task 4: Client — coast shrines, chests, upgrade

**Files:** Modify `src/client/scene/shrines.ts` (tide plate + pumice block, wheels, seabed lever at the seabed), create `src/client/scene/chests.ts`, Modify `src/client/game.ts` (shrine list concat, `shrinePart` per kind, chest and upgrade in `act` + prompts), `src/client/hud.ts` (pearl label; weapon level in the menu/inventory line). Tests: a pure helper `coastAction` in `src/client/coast-ui.ts` + `coast-ui.test.ts`.

- [ ] **Step 1: failing tests.** `coastAction`: near an unopened chest and deep enough → `{chest id, 'Abrir el cofre'}`; opened / at the surface → null; near the Heart with ≥3 perlas and lvl < 3 → `{upgrade, 'Mejorar el arma (3 perlas, 10 piedra, 5 madera)'}`; lvl 3 → null. `shrinePart` for tide block (part 1, "Coger la piedra pómez" / "Soltar la piedra pómez"), sunken levers, fan wheels ("Girar la rueda").
- [ ] **Step 2: implement.** Chests: a small brown box + gold lid and a soft bubbling glow sprite column visible from the surface; opened ones go dark. Pumice: a pale grey box following the holder. Wheels: a torus on a post that spins while pulled. Fan-gate: the usual light gate.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente de santuarios, cofres y mejora`.

### Task 5: Ship

- [ ] Push `aventura/slice-1`; append "Slice 2 · S2-C" to `docs/superpowers/HANDOFF-aventura.md`; one short comment on PR #2. No merge, no deploy.
