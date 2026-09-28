# Progresión · P4-A: Savia y Rango — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** the first plan of subproject #4 (spec §3, row P4-A of §11). Every player earns **Savia** (XP) and climbs **Rango 1–8**. Savia comes mostly from first times; most of it is **computed from what the save already knows** (`milestoneXp`), so old saves land on the right Rango. A small saved `xp` holds the sources the save can't reconstruct (kills with a daily cap of 40, lieutenants, cleaned zones, broken pillars, held raids, the whale). On a Rango up: a short HUD card **"Rango 4. Un punto de oficio."** and a green flash on the robot, seen by everyone. Ranks give **no** damage, health or defence.

**Architecture:** new pure module `src/shared/progression.ts` (`PROGRESS`, `rankOf`, `pointsOf`, `milestoneXp`, `totalXp`, `killXp`, `addKillXp`, `nextRankXp`). `WorldSim`: `gainXp(p, n)` for the non-retroactive sources; `Live.rank` (live-only) set on connect; at the end of `step` each active player's `rankOf(totalXp(p))` is compared to `Live.rank` → toast to them + `{ t: 'rankUp', name, rank }` to all. `SelfState` gets `xp` and `rank`. Client: the card (the existing vision card), a 1.2 s green emissive flash on that player's robot, and "Rango N · X/Y Savia" in the mochila line.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-progresion-design.md` §3 (Savia y Rango), §10.1–10.2, §11 (P4-A).

## Global Constraints

- Spanish, dry voice. `NAMES.xp = 'Savia'`, `NAMES.rank = 'Rango'` in `names.ts`; code uses `NAMES`.
- **No new keys or pills.** Rango is shown in the mochila text and the card; nothing to press.
- **Trust boundary:** no new client message. All Savia is granted by the server.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 54 → 55 (`SelfState.xp`, `SelfState.rank`, `ServerMsg rankUp`). New saved fields optional: `SavedPlayer.xp?`, `SavedPlayer.killDay?`. Old saves load and get their Rango from `milestoneXp`.
- **[D] Retroactive milestones (never stored twice):** shrines ×30, chests ×10, mounts (steed, fish, frog, dragon, star) ×40, powers ×60 **plus 50 for the dungeon boss each altar implies** (Tragón, Antenón, Zancudo, Cucurucho), weapon and Capa levels ×10, `ending` → 150. So the four dungeon bosses are not granted live (you get them with the altar). Live `xp` covers: kills (wolf 1, brute 3, rayo 2; cap 40 per game day), lieutenants and La Flecha of the Torre 50 (alive, ≤ 40 m), whale 40 to each crew member, zone cleaned 15 (≤ its radius + 10 m), pillar broken 40 (≤ 40 m), raid held 15 to each connected (the dawn event happens once per night).
- **[D] Kills** count only through `strike` (melee, arrows). Gusts, flames, traps and the ally Heart guards give no Savia. "Bestia de ceniza" is the rayo in code.
- Ranks: `[0, 80, 220, 420, 680, 980, 1300, 1650]` in `PROGRESS.ranks`.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## File Structure

- Create `src/shared/progression.ts` + `.test.ts`, `src/shared/sim/world-sim-p4a.test.ts`.
- Modify `src/shared/names.ts`, `src/shared/protocol.ts` (+ test), `src/shared/sim/world-sim.ts` (+ version test), `src/client/game.ts`, `src/client/hud.ts`, a small pure `src/client/rank-ui.ts` (+ test).

## Tasks

### Task 1: pure rules — Savia, Rango, the daily cap

```ts
export const PROGRESS = { ranks: [0, 80, 220, 420, 680, 980, 1300, 1650], shrine: 30, chest: 10, mount: 40, power: 60, boss: 50, upgrade: 10, ending: 150, zone: 15, pillar: 40, raid: 15, lieut: 50, near: 40, kill: { wolf: 1, brute: 3, rayo: 2 }, killCap: 40 } as const;
export function rankOf(xp: number): number;           // 1–8
export function pointsOf(rank: number): number;       // rank − 1
export function nextRankXp(rank: number): number | null;
export function milestoneXp(p: SavedPlayer-like): number;
export function totalXp(p): number;                   // milestoneXp + (p.xp ?? 0)
export function killXp(kind: string): number;
export function addKillXp(killDay, day, kind): { killDay; gain };
```

- [x] **Step 1: failing tests.** `rankOf(0)=1, 79→1, 80→2, 1650→8, 99999→8`; `pointsOf(8)=7`; `nextRankXp(8)=null`. `milestoneXp` of an empty player 0; of a full-story save (12 shrines, 6 chests, 4 powers, steed+fish+frog+dragon, weapon 6, Capa 4, ending) between 1200 and 1400 (Rango 6–7; the live sources — lieutenants, zones, pillars, raids, kills — carry it to 8 near the end). Kill cap: 45 wolves in one day give 40, the next day gives again. Names: `NAMES.xp`, `NAMES.rank`.
- [x] **Step 2: implement.**
- [x] **Step 3:** green, self-review, commit `feat(progresion): reglas puras de Savia y Rango`.

### Task 2: server — awards, rank-up, snapshot (protocolo v55)

- [x] **Step 1: failing tests** (`world-sim-p4a.test.ts`). A fresh player: `self.rank` 1, `self.xp` 0. A loaded old save with 3 shrines + Enredadera: rank from `milestoneXp` with no rank-up message on connect. Striking a wolf dead gives 1 `xp` (saved); the day's cap holds. A raid dawn with the Heart alive gives 15 to each connected. Breaking a pillar gives 40 to those ≤ 40 m. Crossing 80 → a `rankUp` to all (`name`, `rank: 2`) and "Rango 2. Un punto de oficio." to the player, once. Protocol 55.
- [x] **Step 2: implement** (`gainXp`, calls in `strike`, whale win, `cleanse`, `breakPillar`, raid dawn; `Live.rank`; rank check at the end of `step`; `SelfState.xp/rank`).
- [x] **Step 3:** green, self-review, commit `feat(progresion): Savia y Rango en el servidor (protocolo v55)`.

### Task 3: client — the card, the flash, the mochila line

- [x] **Step 1: failing tests** (`rank-ui.ts`): `rankLine(xp, rank)` → "Rango 3 · 300/420 Savia", at 8 "Rango 8 · 1700 Savia"; `rankUpText(4)` → "Rango 4. Un punto de oficio.".
- [x] **Step 2: implement** (on `rankUp`: if it is you, show the card; flash that player's actor green 1.2 s; mochila line).
- [x] **Step 3:** green, self-review, commit `feat(progresion): tarjeta de Rango y destello`.

### Task 4: Ship

- [x] Full suite green; push; HANDOFF "## Progresión · P4-A — …"; one short comment on PR #3.
