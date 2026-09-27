# Aventura — Slice 5 · S5-H: el Árbol-torre y la Estrella — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the post-game (spec §12–§13, row S5-H of §17), the last plan of the Aventura story. **El Árbol-torre (Idea de Claude):** after the ending the white tower is a lookout. A at its door → **"Subir"**: you appear on a 7 m platform on its top, marked as **fogata 7** (lit by the ending; Heart ↔ cima by day with the existing fogata rules). Stepping off the top with the glider you ride **la corriente**: no glider stamina until you touch ground. **La Estrella** (`public/enemies/enemy14.png`, paper, 65 % alpha): only after the ending, on **full-moon nights** (`day % 8 === 0`, pure), she rolls in a circle in la Ceniza. A near her → **"Domar la Estrella"**: the timing ring, **4 rounds** (friends calm her as usual). Result: she becomes **your land mount** — she replaces your deer (same A/Montar/Bajar, same seat for a friend, same fogata call) and runs **13 m/s** (server cap 14), the fastest on land.

**Architecture:** new pure module `src/shared/estrella.ts` (`ESTRELLA`, `fullMoon`, `estrellaOut`, `estrellaAt`) and the lookout rules in `src/shared/ending.ts` (`LOOKOUT`, `inLookout`, `lookoutTop`, `withLookout`). `generateFogatas` gets id 7 (the cima). `WorldSim`: terrain wrapped with `withLookout(…, () => ending)` (a raised disc: standing on the top is ordinary ground), `towerH` reports `LOOKOUT.h` after the ending, act 26 at the door after the ending lifts you up, `fogatas[7] = ending`; the Estrella is a new tame beast `'star'` (mount act 18) and `SavedPlayer.star?` marks the steed as the Estrella. Client: the terrain wrapper, "Subir" label, fogata 7's Menú label, the free glide, the wild Estrella paper, a star steed drawn as the paper instead of the deer, 13 m/s riding.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-5-corrupcion-design.md` §12 (Árbol-torre), §13 (post-game), §14 (`treeTower`, `legendary`), §17 (S5-H). HANDOFF S5-G ("El Árbol-torre no está").

## Asset check (done while planning)

`public/enemies/enemy14.png` — cream five-pointed star, heart eyes, frown; spec measured RGBA 423 × 430, 65 % alpha. Through `PaperActor`, **2.2 m** tall. No other art.

## Global Constraints

- Spanish, dry voice. Names via `NAMES` (`treeTower`, `legendary`, `ash`, `fogata`). No hand-written "Estrella" (names test).
- **No new keys or pills:** "Subir", "Domar la Estrella" and the star's Montar/Bajar are the contextual A / E; fogata 7 is a Menú trip button.
- **Trust boundary:** no new message type. `mount` accepts act **18** (tame the Estrella) through `decodeClient`; the server checks ending, full-moon night, reach, not already owning a star, not busy. Door act 26 after the ending needs the door reach and no mount.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 53 → 54 (`TameView.beast` + `'star'`, `snap.estrella`, `SteedView.star?`, `PlayerView.star?`, `SelfState.star`, mount act 18). New saved field optional: `SavedPlayer.star?`. Old saves load; an old `ending: true` save gets fogata 7 lit on load.
- **[D] Full moon:** `fullMoon(day) = day % 8 === 0` with `day = floor(time / DAY_LENGTH)`; she is out while `ending && fullMoon(day) && night`. At dusk of a full-moon day after the ending, one toast to all: "Luna llena. Algo rueda por la Ceniza". No moon art.
- **[D] Her path:** a 20 m circle around `(−30, foot − 50)` in la Ceniza (foot = the rim's foot), 0.12 rad/s (~2.4 m/s), yaw along the path; she keeps rolling while you tame (the ring's leash is on the start spot, 6 m, like the deer).
- **[D] One land mount:** taming her turns your steed into the Estrella (`star: true`); if you had a deer, it stays in the forest as a wild-looking memory — gone from you. She uses every deer rule (seat for a friend, fogata call, can't enter dungeons). Server cap 14 (`MOUNT.maxSpeed` 13 for deer), client run 13 / walk 7.
- **[D] Árbol-torre:** platform = disc `r ≤ 7` at the tower's centre, height `terrain + LOOKOUT.h` (140, `TOWER.max`); after the ending the tower is drawn at full height. Door A after the ending = "Subir" (the Torre dungeon is done and is not re-entered; noted). Arrival 2 m east of the top fogata ring, like any fogata. **La corriente:** a body that leaves the top disc gliding or falling doesn't spend stamina until it lands (client; the server already accepts any descending move). The spec's 230 m / updraft ring are simplified to this.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## File Structure

- Create `src/shared/estrella.ts` + `.test.ts`, `src/shared/sim/world-sim-s5h.test.ts`.
- Modify `src/shared/ending.ts` (+ test), `src/shared/fogatas.ts` (+ test), `src/shared/protocol.ts` (+ test), `src/shared/sim/world-sim.ts` (+ version test), `src/client/mount-ui.ts` (+ test), `src/client/ending-ui.ts` (+ test), `src/client/movement.ts`, `src/client/game.ts`, `src/client/hud.ts`, `src/client/scene/steeds.ts`.

## Tasks

### Task 1: pure rules — full moon, her path, the lookout, fogata 7

```ts
// estrella.ts
export const ESTRELLA = { moonEvery: 8, reach: 4, h: 2.2, walk: 7, run: 13, maxSpeed: 14, path: { dx: -30, dn: 50, r: 20, w: 0.12 }, rounds: [4 rounds] } as const;
export function fullMoon(day: number): boolean;
export function estrellaOut(day: number, night: boolean, ending: boolean): boolean;
export function estrellaAt(time: number): { x: number; z: number; yaw: number };
// ending.ts
export const LOOKOUT = { r: 7, h: TOWER.max } as const;
export function inLookout(x: number, z: number): boolean;
export function lookoutTop(t: Terrain): { x: number; y: number; z: number };
export function withLookout(base: Terrain, open: () => boolean): Terrain;
```

- [x] **Step 1: failing tests.** `fullMoon(0|8|16)` true, `fullMoon(3)` false; `estrellaOut` needs all three. `estrellaAt` stays 20 m from its centre, north of `RIM_LINE`, moves ~2.4 m/s. 4 rounds, harder than the deer's last. `withLookout` closed = base; open: inside the disc base + 140, outside base. `lookoutTop` y = base + 140. `generateFogatas` has 8, id 7 `lookout: true` at the tower with `y` = top. Names test: no "Estrella".
- [x] **Step 2: implement.** `FOGATA.count` 8, `FOGATA.lookout` 7.
- [x] **Step 3:** green, self-review, commit `feat(aventura): reglas puras de la Estrella y el mirador`.

### Task 2: server — the lookout and the Estrella (protocolo v54)

- [x] **Step 1: failing tests** (`world-sim-s5h.test.ts`). Before the ending act 26 at the door does what it did; after, it puts you on the top (y ≈ top) with "Subes a …"; fogata 7 lit on the ending and on loading an ending save; from the top A (fogata) channels home; `towerH` = 140 after the ending. Estrella: `snap.estrella` null by day, before the ending, or on a non-full-moon night; set on a full-moon night after the ending; act 18 away → nothing; near → a 4-round `tame` with `beast: 'star'`; winning → `self.star`, `self.steed`, `riding`, saved `star`; riding moves up to 13.9 m/s accepted, 16 refused; act 18 again → "Ya tienes…". Dusk toast on a full-moon day. `decodeClient` mount act 18 ok, 19 refused. Protocol 54.
- [x] **Step 2: implement.**
- [x] **Step 3:** green, self-review, commit `feat(aventura): el Árbol-torre y la Estrella en el servidor (protocolo v54)`.

### Task 3: client — Subir, la corriente, the Estrella

- [x] **Step 1: failing tests.** `mountAction`: near a wild estrella without a star → act 18 "Domar la Estrella"; riding a star → "Bajar de la Estrella". `towerDoorLabel(ending)` → "Subir" / existing. Movement: a star rider runs 13 m/s; a body leaving the lookout disc gliding keeps its stamina until it lands.
- [x] **Step 2: implement** (terrain `withLookout` next to `withGrieta`; the door's contextual label; hud `where(7)` "a la cima de el Árbol-torre"; `SteedMeshes` draws `star` poses as a spinning `PaperActor` of `enemy14.png`; wild estrella from the snapshot; body `star` flag; `corriente` flag).
- [x] **Step 3:** green, self-review, commit `feat(aventura): cliente del Árbol-torre y la Estrella`.

### Task 4: Ship

- [x] Full suite green; push; HANDOFF: "Aventura completa — estado" at the top, "Slice 5 — resumen" before S5-A, "## Slice 5 · S5-H — …"; one short comment on PR #3.
