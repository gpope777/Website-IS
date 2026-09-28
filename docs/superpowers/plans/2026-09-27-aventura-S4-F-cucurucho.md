# Aventura — Slice 4 · S4-F: El Cucurucho, la atalaya y la Escalera del Umbral — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The mountain boss fills the quiet room S4-E left behind gate 3 ("Algo con gorro duerme bajo el hielo"). **El Cucurucho** (`public/enemies/enemy13.png`, a paper cutout like the other bosses) has **420 PV**. Its **cone hat is armour**: hits from its front half do **25 %**. **Embestida:** it lowers the cone (1.0 s telegraph, the hat glows red), then charges straight at **14 m/s** (25 damage, roll dodges). A **Piedra pillar in its path** → it rams it: **stuck 5 s** (hat stuck, full damage from any side). **Alud:** every 15 s it stamps; 4 boulders fall on marked circles (1.0 s shadows, 15 damage; a pillar within the circle blocks that boulder). A parry exposes it 3 s. An empty room resets it. Beating it: `SavedWorld.purified4 = true`, **zone 14 (Raíz-madre de la Montaña) is cleansed** (so El Triángulo stops: `triLeads` already reads zone 14), and a **vision** names the players present. From then on a **white Cucurucho raises an atalaya by the Heart**: at night, **every 6 s**, it throws a stone at the **nearest raider within 20 m**: **8 damage** (no HP, can't die; Heart HP and raid size untouched). Separately, the **Umbral block** at the foot of los Peldaños (`x = 0`) takes **3 Piedra casts** within 5 m ("La roca cruje (1/3)") → `SavedWorld.escalera = true`: a 4 m band `|x| < 2` of the Peldaños becomes a **31° ramp for everyone**, forever (like the Zarzal knot).

**Architecture:** A new pure module `src/shared/sim/cucurucho.ts` (`CUCURUCHO`, `createCucurucho`, `stepCucurucho`, `hatFront`, `stickCucurucho`, `ATALAYA`, `createAtalaya`, `stepAtalaya`), like `zancudo.ts`. The Umbral and the ramp live in `src/shared/mountains.ts` (`UMBRAL`, `ESCALERA`, `escaleraRamp(d)`, `withEscalera(base, on)`: a terrain wrapper whose `heightAt` returns the ramp in the band while `on()`). `WorldSim` gets `boss4` (live-only), `purified4` (saved), `ally4` (live-only, rebuilt from `purified4`), `escalera` (saved) and `umbralCasts` (live-only), mirroring `boss3`/`purified3`/`ally3`/`zarzalBurnt`/`knotBurns`. Both the server and the client wrap their terrain with `withEscalera(…, () => escalera)`.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-4-montanas-design.md` §3.2 (Escalera del Umbral), §4 (a charging enemy that hits a pillar is stunned 5 s), §6 (beating El Cucurucho cleans 14), §7 (El Triángulo stops), §11.3 (the boss and the atalaya), §15.3, §16 (row S4-F). Names: `NAMES.bossMountain`, `mountainRoot`, `mountainGate`, `stairs`, `powerStone`, `heart`, `lieutenant2`.

**Also resolves the `// S4-F` markers:** `mountain-dungeon.ts` header, `world-sim.ts` (`onShrine` roots comment, `stepRockFight` doc), `lieutenant.ts` (`triLeads` doc).

## Asset check (done while planning)

`public/enemies/enemy13.png` — the spec decoded it (RGBA, 72 % fully transparent). Re-read the header at plan time for the aspect ratio (Task 4 uses `width/height`). No keying: it goes through `PaperActor`, **5 m tall**.

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES`.
- **Phones first. No new keys or pills.** The fight uses attack, bow, parry (🛡️), roll and the power pill (Piedra). The Umbral takes the same Alzar (H / power pill) near it.
- **Trust boundary:** no new client message. The server decides the charge, the pillar crash, the alud, the atalaya and the Umbral (Piedra owned, own cooldown, ≤ 5 m).
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 39 → 40 once for the whole plan: `EnemyKind` + `'boss4'`, `MountainDungeonView.boss`, `snap.ally4`, `snap.escalera`. New saved fields `SavedWorld.purified4?`, `SavedWorld.escalera?` only: old saves load (boss unbeaten, no ramp).
- **[D] Arena:** the existing boss room z 160–190 (24 × 30 m, the spec's size). It waits at (0, 182) facing −z.
- **[D] Hat:** "front" = the half-plane ahead of its yaw (like the bruto de roca's slab), 25 % while not stuck/exposed. Arrows count the same (the hat covers them too).
- **[D] Embestida:** from 5–18 m, cooldown 4 s; windup 1.0 s locks the direction; charge lasts up to 1.3 s (~18 m) or until the room wall (stops, no stun: only pillars stun it, as the spec says). Hits the first player within 1.8 m once (25, through `bite`: roll dodges, parry exposes 3 s). A live pillar within `PIEDRA.chargeR + PIEDRA.half` (3 m) of its body while charging → stuck 5 s ("¡Contra el pilar! El gorro se clava"). The pillar is not hurt.
- **[D] Close range:** it pokes with the cone: **8 every 4 s** at ≤ 2.4 m (it doesn't charge under 5 m).
- **[D] Alud:** first 8 s after waking, then every 15 s, only when not charging/stuck. 4 circles (r 1.5): one on each living fighter (up to 4), the rest on fixed room spots (±6, 168/182). 1.0 s later each circle hits everyone within 1.5 m (15, through `bite`) unless a live pillar's centre is within 2.5 m of it. The boss stands still while stamping.
- **Balance:** a player standing still next to it: poke 8/4 s + alud 15/15 s = 3 PV/s → **~33 s** from 100 PV (target 30–45 s, Cierre S1). The charge only happens from range.
- **[D] Atalaya:** a 5 m stone tower **6 m from the Heart on its −x side** (the others are at +z / Antenón's spot). "At night" = `isNight`; "raider" = `w.raid` (any kind, including El Triángulo); range from the atalaya. The stone is instant (a flash, no projectile), like El Triángulo's rocks.
- **[D] Umbral block:** a carved 2 m cube at `(0, −HALF + 3)` (forest side of the first riser). An Alzar cast with the player ≤ 5 m from it counts a crack instead of raising a pillar (cooldown still applies). The count is live-only (a restart resets partial cracks, like the knot). The Escalera vision is left to S4-H (spec §16 row S4-H): here a `say` line and a `// S4-H` marker.
- **[D] Ramp:** `|x| < 2`, depth `d` 0–40 from the forest rim: height = rim + 24 · d/40 (≈31°; continuous with the forest at d 0 and the Faldas at d 40). The 0.5 m slope probe means the walkable band is `|x| < 1.5`. Terrace tops beside the band stay unreachable from it (smooth, > 45°). The client rebuilds the mountain chunk meshes once when `escalera` turns on and draws stone steps over the band.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## File Structure

- Create `src/shared/sim/cucurucho.ts`, `src/shared/sim/cucurucho.test.ts`, `src/shared/sim/world-sim-s4f.test.ts`.
- Modify `src/shared/mountains.ts` (+ test: `UMBRAL`, `ESCALERA`, `withEscalera`), `src/shared/mountain-dungeon.ts` (`bossZ`), `src/shared/protocol.ts` (+ test), `src/shared/sim/wolves.ts` (`ENEMY.boss4`, label), `src/shared/sim/elite.test.ts` (ids), `src/shared/sim/marchito.ts` (`VISION.purified4`), `src/shared/sim/lieutenant.ts` (doc), `src/shared/sim/world-sim.ts`.
- Modify `src/client/game.ts`, `src/client/dungeon-ui.ts` (+ test), `src/client/scene/mountain-dungeon.ts` (alud shadows), a small `src/client/scene/umbral.ts` (block, steps, atalaya).

## Tasks

### Task 1: The rules (pure)

**Files:** Create `src/shared/sim/cucurucho.ts` + test; Modify `src/shared/mountains.ts` (+ test), `src/shared/protocol.ts` (`EnemyKind`), `src/shared/sim/wolves.ts`, `src/shared/sim/elite.test.ts`.

- [ ] **Step 1: failing tests.** `createCucurucho`: 420 PV, kind `boss4`, in the boss room. `hatFront`: a hit from ahead → true, from behind → false, stuck → false. `stepCucurucho`: a target 10 m ahead → windup 1.0 s then a charge at 14 m/s; a target on its path takes 25 once; a pillar on the path → stuck 5 s (no hit past it); the wall stops the charge without sticking. A target at 2 m → poke 8 every 4 s, no charge. The alud: 8 s after creation, circles on each fighter plus fixed spots (4 total); after 1.0 s hits those within 1.5 m (15) and not a circle with a pillar within 2.5 m. **Balance:** a player standing still next to it takes between 66 and 100 in 30 s (≈30–45 s to 100). `stepAtalaya`: at night, the nearest raider within 20 m of the tower takes 8 once per 6 s; a non-raider wolf or one at 25 m is untouched; by day nothing. `withEscalera`: off → same heights as the base; on → in `|x| < 2` the Peldaños are a ramp (height rises 24 over 40 m, `slopeAt` < 35° at `x = 0`, `steepBlocked` false walking up it); outside the band unchanged. Unique ids include `CUCURUCHO.id`.
- [ ] **Step 2: implement.**
- [ ] **Step 3:** green, self-review, commit `feat(aventura): reglas de El Cucurucho, la atalaya y la Escalera`.

### Task 2: The fight on the server (protocol v40)

**Files:** Modify `src/shared/protocol.ts` (+ test), `src/shared/sim/marchito.ts`, `src/shared/sim/world-sim.ts`, `src/shared/mountain-dungeon.ts`, `src/shared/sim/lieutenant.ts`; Test `world-sim-s4f.test.ts`.

- [ ] **Step 1: failing tests.** Someone alive in the mountain boss room → "El Cucurucho despierta"; the old "calma" line is gone (test updated to the new rule if one checks it). A front hit does 25 %, a back hit full. A charge into a pillar → stuck, then a front hit does full. The alud hits a player standing on a circle. Leaving the room resets it. At 0 HP: `purified4`, zone 14 cleansed (`triLeads` false afterwards), a `vision` naming players; it doesn't come back; `save()` writes `purified4`; an old save loads without it. Protocol v40.
- [ ] **Step 2: implement** (`boss4`, `purified4`, `stepCucuruchoFight`, `strike` hat, `bite` parry exposes, `boss4` in `allFoes`/`enemy`, `dungeonView().mountain.boss`, snapshot entry via the foes list, `VISION.purified4`, resolve `// S4-F` markers).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): El Cucurucho en la sala de la Montaña (protocolo v40)`.

### Task 3: The atalaya and the Escalera del Umbral

**Files:** Modify `src/shared/sim/world-sim.ts`; Test `world-sim-s4f.test.ts`.

- [ ] **Step 1: failing tests.** With `purified4` and a Heart at night: `snap.ally4` exists and a raider 10 m from the tower loses 8; without `purified4`, `ally4` null. Umbral: without Piedra → "Aún no tienes ese poder"; two casts → "La roca cruje (2/3)" and no pillar; the third → `escalera`, `snap.escalera`, saved; a walker then climbs the band on foot from the forest to the Faldas (the server accepts the moves); outside the band still refused. Old save loads with `escalera` false.
- [ ] **Step 2: implement** (`stepAlly4`, Umbral branch in `onStone`, `withEscalera(…, () => this.escalera)` around the sim terrain).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): la atalaya del Cucurucho blanco y la Escalera del Umbral`.

### Task 4: Client

**Files:** Modify `src/client/game.ts`, `src/client/dungeon-ui.ts` (+ test), `src/client/scene/mountain-dungeon.ts`; Create `src/client/scene/umbral.ts`.

- [ ] **Step 1: failing tests.** `cucuruchoBarText`: `El Cucurucho 420/420`, `· ¡embiste!` while charging, `· ¡gorro clavado!` while stuck, `· ¡alud!` while shadows are down; null without a boss.
- [ ] **Step 2: implement.** `PaperActor('/enemies/enemy13.png', 5, …)` for `boss4`, red tint while winding up, gold while stuck; alud shadows (dark discs, unfogged) in the boss room; the white Cucurucho (pale, 1.6 m) atop a 5 m stone atalaya by the Heart, a flash when it throws; the Umbral block until `escalera`, then stone steps over the band; client terrain wrapped with `withEscalera` and the mountain chunks rebuilt once when it turns on; the bar.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente de El Cucurucho, la atalaya y la Escalera`.

### Task 5: Ship

- [ ] Append "## Slice 4 · S4-F — …" to `docs/superpowers/HANDOFF-aventura.md` (Spanish, same style). Commit, `git push origin aventura/resto`, one short comment on PR #3.
