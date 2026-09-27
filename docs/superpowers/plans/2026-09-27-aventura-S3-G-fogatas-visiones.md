# Aventura — Slice 3 · S3-G: Fogatas del Pantano y visiones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The last Slice 3 plan. **4 seeded fogatas** (stone rings) on swamp montículos, dark until lit. A **Llamarada** at ≤4 m lights one, and so does **A with a torch** from the Candiles post (the torch is spent), so fogatas work before the dungeon. Lit fogatas are **per world** (`SavedWorld.fogatas?: boolean[]`) and glow through fog for everyone. **A at a lit fogata → "Volver al Corazón"**; at the Heart, the **Menú lists lit fogatas**. Either way a **5 s channel**: **daytime only**, cancelled by damage, by walking away (>1.5 m), by nightfall, by death or by mounting. Then the server moves you (one validated position set, `fix`). Mounts stay where they were. Also El Marchito's swamp **visions**: on first entering the swamp ("¿Te gusta mi niebla, Ana?") and on burning the Zarzal knot (the `// S3-G` line). The Gata and El Zancudo visions already exist.

**Architecture:** A pure module `src/shared/fogatas.ts` (`FOGATA`, `generateFogatas(t, seed)`), same seed on client and server. `WorldSim` gets `fogatas: boolean[]` (saved when any is lit) and a live-only `Live.travel`. One new client message `{ t: 'travel'; to: 'heart' | number }` and one for the torch `{ t: 'fogata'; id }`. `VISION.swamp` and `VISION.knot` in `marchito.ts`.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-3-pantano-design.md` §9 (Fogatas), §11 (visions), §14.2 (`travel {to}`, `snap.fogatas`), §15 (row S3-G). Names: `NAMES.fogata`, `heart`, `biomeSwamp`, `swampGate`, `villain`.

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES`.
- **Phones first. No new keys or pills.** Lighting and travelling from a fogata go through contextual **A / E**; travelling to a fogata through the **Menú** (pause pill / Esc), whose buttons only show when you stand at the Heart.
- **Trust boundary:** both messages go through `decodeClient` (`to` is `'heart'` or an integer 0–3; `id` integer). The server re-checks everything: fogata exists and is lit, you are within reach (A at a fogata ≤ 3 m; at the Heart ≤ `HEART.tendReach`), daytime (`!isNight`), alive, not in any dungeon, not riding/seated/on fish/frog/whale, not taming or racing, the Heart exists for `'heart'`. During the channel: damage (health below its value at the start), moving > 1.5 m, night, death or mounting cancel it with a line.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 30 → 31 once for the whole plan: `ClientMsg` + `travel`, `fogata`; `snap.fogatas: boolean[]`; `SelfState.travel: number | null` (whole seconds left). New saved field `SavedWorld.fogatas?` only: old saves load with all four dark.
- **[D] Placement:** 4 of the 12 montículos that no shrine or the frog uses, spread along z (sorted by z, evenly picked). On a mound the ring sits at 60 % of its radius toward the forest (east), turning around the mound until the spot is dry, so it never lands on an amber tree (trees stand at mound centres).
- **[D] Torch:** A at an unlit fogata with a torch lights it and spends the torch (same as a brazier). Without torch or Fuego: "Hace falta fuego".
- **[D] Arrival:** at a fogata, 2 m east of the ring; at the Heart, `h.x + 2` (the respawn spot). Travel between two fogatas is not offered (spec: "to/from the Heart").
- **[D] Mounted:** the channel refuses while mounted ("Baja de la montura primero") and mounting cancels it; the mount stays where you left it.
- **[D] Visions:** first-entry vision fires when `swampSeen` flips (once per world; worlds that already had it get none). Knot vision replaces the knot's `say` line.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the session's attribution lines. Push after each task.

## File Structure

- Create `src/shared/fogatas.ts`, `src/shared/fogatas.test.ts`, `src/client/scene/fogatas.ts`.
- Modify `src/shared/protocol.ts` (+ test), `src/shared/sim/marchito.ts`, `src/shared/sim/world-sim.ts` (+ test).
- Modify `src/client/game.ts`, `src/client/swamp-ui.ts` (+ test), `src/client/hud.ts` (Menú buttons).

## Tasks

### Task 1: The rules (pure)

**Files:** Create `src/shared/fogatas.ts` + test; Modify `src/shared/sim/marchito.ts`.

- [ ] **Step 1: failing tests.** `generateFogatas(t, seed)` gives 4 fogatas with ids 0–3, each on dry ground inside the swamp, on a montículo no shrine/frog uses, ≥ 2.5 m from every amber tree, ≥ 10 m apart, the same for the same seed. `VISION.swamp(name)` names the player; `VISION.knot(names)` names who burnt it.
- [ ] **Step 2: implement** (`FOGATA = { count: 4, light: 4, reach: 3, channel: 5, drift: 1.5, arrive: 2 }`).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): reglas de las fogatas del Pantano`.

### Task 2: Server: lighting, travel, visions (protocol v31)

**Files:** Modify `src/shared/protocol.ts` (+ test), `src/shared/sim/world-sim.ts` (+ test).

- [ ] **Step 1: failing tests.** decodeClient accepts `travel` to `'heart'`/0–3 and `fogata` id, rejects `to: 4`, `'casa'`, `-1`. A Llamarada at ≤4 m lights a fogata (line, `snap.fogatas`, saved); a torch lights one and is spent; no torch → "Hace falta fuego". Travel from a lit fogata by day: after 5 s you are at the Heart (`fix`); by night refused; unlit refused; far refused; mounted refused; damage mid-channel cancels; walking away cancels. From the Heart: the Menú route to fogata 2 lands you by it. Old save loads with all dark and saves no `fogatas`. First entering the swamp → a `vision` naming the player, once. Burning the knot → a `vision`. Protocol v31.
- [ ] **Step 2: implement** (`fogatas`, `Live.travel`, `onTravel`, `onFogata`, `stepTravel` in `step`, `flameThings` lighting, `snap.fogatas`, `SelfState.travel`, visions).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): fogatas del Pantano en el servidor (protocolo v31)`.

### Task 3: Client

**Files:** Create `src/client/scene/fogatas.ts`; Modify `src/client/game.ts`, `src/client/swamp-ui.ts` (+ test), `src/client/hud.ts`.

- [ ] **Step 1: failing tests** for `fogataAction(ctx)`: unlit + torch → `{ t: 'fogata', label: 'Encender la fogata' }`; unlit without → "Hace falta fuego" (no message); lit → `{ t: 'travel', to: 'heart', label: 'Volver al Corazón' }`; far → null. `fogataTargets(lit, atHeart)` lists lit ids only at the Heart.
- [ ] **Step 2: implement.** Stone rings (instanced) + a flame (`MeshBasicMaterial`, `fog: false`) when lit; A routes to the fogata; the HUD prompt shows the label; the Menú adds "Ir a la fogata N" buttons at the Heart; a toast shows "Viajando… N s" from `self.travel`. A Llamarada at an unlit fogata needs no client code.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): fogatas en el cliente`.

### Task 4: Ship

- [ ] Handoff: the S3-G section and a **"Slice 3 — resumen"** block at the top of the Slice 3 area (S3-A…G, "Decidido por Claude — revisar", balance to review, test order).
- [ ] Push; one short comment on PR #3.
