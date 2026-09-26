# Bosque Online — Design Spec

**Date:** 2026-09-26
**Status:** Approved in brainstorming, pending written review
**Scope:** (1) Vision and roadmap for the whole revamp. (2) Detailed design for Sub-project #1, the multiplayer foundation.
Sub-projects #2–#7 each get their own spec → plan → build cycle later.

---

## Part 1 — Vision

### Who it's for
Gabriel and his two nephews (12 and 10), each playing from their own home, **mostly on phones**, also on PCs and tablets.
The main goal is playing together online. The game must be challenging and interesting, not a kiddie game.

### What it is
A co-op survival game in a lush, beautiful forest world. You explore, gather, build safe bases to defend against
enemies, level up, follow a story along a ladder of biomes, and set up shops the others can visit.

- **Core loop: biome ladder (Valheim-style) plus escalating base raids (7 Days to Die-style), with some spreading corruption for flavor.**
  Each biome (forest, then coast/lake, then swamp, then mountains, then corrupted lands) has a boss that gates the next story
  chapter and unlocks new materials, which lead to better gear, which leads to stronger bases, which lets you push into the next biome.
  Raids on player bases escalate with progress.
- **Always-on shared world.** The world lives on a server. Anyone can play alone at any time, and the others see the changes later.
- **The world sleeps when nobody is online.** No raids while offline. Shops keep working for their owner while the owner is offline.
- **Co-op only.** No PvP, friendly fire off.
- **Language:** Spanish (as today).
- **Camera:** third-person by default, with a first-person toggle.

### Visual north star
Dan Greenheck's "Tidewater" (x.com/dangreenheck/status/2102878170089169235), a Three.js world with dense wind-swayed grass,
dirt paths, photographic sky and lighting, stylized puffy clouds, golden sunsets, truly dark nights lit by lamps and flashlights,
ambient life (birds, crabs, fish), cloth and signs moving in the wind, a shoreline with foam, and underwater views.
Reached gradually. **Quality tiers from day one:** PC gets the full look, phones get the same art direction and lighting
at lower density, draw distance and resolution.

### Creatures
- The nephews' drawings (15 now at `public/enemies/`, more coming) become **3D creatures through AI image-to-3D**,
  then cleaned up and animated. Fallback for drawings that don't convert well: "paper spirits", the drawing shown as a glowing
  animated paper cutout, explained in the lore.
- "Drawing to in-game creature" is a **repeatable pipeline**, because more drawings are coming.
- **Free animated model packs** (CC0/permissive) fill the dense world: common enemies, wildlife, characters, props.

### Roadmap
| # | Sub-project | Delivers |
|---|---|---|
| 1 | **Multiplayer foundation** | Private always-on world, third-person characters, gathering, basic building, one online enemy (detailed below) |
| 2 | World and visuals | Biomes, the Tidewater look (grass, lighting, water, sky, ambient life), tuned quality tiers |
| 3 | Building, raids, base defense | Base building system, walls, traps, escalating raids |
| 4 | Progression and customization | Levels, skills, gear tiers, character appearance |
| 5 | Story, bosses, creature pipeline | Main questline along the biome ladder, side quests, lore, NPCs, bosses, drawing-to-creature pipeline |
| 6 | Shops and economy | Player shops (work while the owner is offline), trading, merchants |
| 7 | Polish | Game feel, combat impact, sound, UI, onboarding |

The old Bosque stays live at `gpope777.github.io/Website-IS/` until the new version replaces it. Its relics, creatures, boss
and lore return in #5, redesigned rather than ported one to one.

---

## Part 2 — Sub-project #1: Multiplayer foundation

### Goal
A thin but real slice that everything later plugs into. The work goes into the foundations, not content.

### Success test
Gabriel on a PC plus two phones on cellular data play together for 30 minutes. Controls feel responsive, and chopped trees and
built walls match on every screen. Everyone disconnects. The next day, everything is still there.

### Features in scope
1. **Join a private world:** world code + name + 4-digit PIN. Rejoining restores your character, position and inventory. No accounts, no emails.
2. **Third-person character** (from a free animated model pack): idle, walk, run, jump, swim, attack and hit animations. Camera toggle to first-person.
3. **Touch controls redesigned for third-person:** left thumb joystick to move, right side drag to orbit the camera, buttons for
   jump, attack, interact and build. Keyboard and mouse on PC. Existing `src/ui/touch.ts` is the starting point.
4. **Other players:** smooth movement (interpolated) and name tags.
5. **Gathering:** chop trees, mine rocks, pick bushes. The server decides and broadcasts, so the world is the same for everyone. Resources regrow.
6. **Inventory:** basic stacks, server-owned.
7. **Building (minimal):** place a campfire and a wall piece. Placement is checked by the server and saved.
8. **Survival (simplified for co-op):** health, hunger and warmth. Campfires warm you. Death leads to respawning at your campfire
   (or the world spawn if you have none) and keeping your inventory. Death penalties come in #3/#4.
9. **One server-driven enemy:** night wolves that pick targets among the online players, chase, attack and can be killed.
   Proves online combat. Server-side hit checks with a range and cooldown.
10. **Day/night cycle** shared by everyone, driven by server time. It only advances while someone is online.
11. **Graphics quality tiers:** Low / Medium / High, auto-picked by device (touch plus GPU hints), changeable in settings and remembered per device.
    Tiers control shadows, pixel ratio, vegetation density and draw distance.

### Out of scope for #1
Biomes, new visuals, raids, levels, customization, quests, bosses, shops, the old creatures and relics. All of these belong to later sub-projects.

### Architecture

One repo (`Website-IS`), one Cloudflare deployment.

```
shared/   pure TS: seeded world gen (terrain, resource placement), items, recipes, combat math,
          wolf AI step, message types + protocol version. Runs on client AND server. No DOM, no Three.js.
client/   Three.js render, input (touch/kb/mouse), cameras, UI, prediction + interpolation, quality tiers.
server/   Cloudflare Worker: serves client build (Workers Static Assets) + routes /ws to the World Durable Object.
          World DO: join/auth, simulation tick, persistence (DO SQLite storage), admin backup export.
```

**Reuse from the current code:** `noise.ts`, `rng.ts`, survival math from `survival.ts`, world-gen pieces of `world.ts`
(terrain/placement move into `shared/`, meshes stay in `client/`), and `touch.ts`. `game.ts` is replaced.

### Data flow
1. The client sends **inputs and intents** over WebSocket: movement input (about 15 Hz), and discrete actions
   (`attack`, `harvest resourceId`, `place kind, pos, rot`, `eat item`).
2. The World DO validates each action (range, materials, cooldown, alive), applies it and runs the simulation at **10 Hz**
   (wolves, survival stats, regrowth, day clock).
3. The server sends **deltas** 10 times a second, **filtered by distance** (players and enemies within about 100 m), plus one-off events (resource
   removed, structure placed, damage).
4. The client moves the local player with **prediction**, reconciled against the server-confirmed position. Other players and
   wolves are **interpolated** about 100 ms behind.
5. **The terrain is never sent.** Everyone generates it from the world seed. Only changes to the world are stored and synced:
   removed resources with regrow time, placed structures.

Movement is client-predicted with a server sanity check (max speed, no teleporting). Full server-side physics isn't needed for co-op.

### Persistence
- DO SQLite tables: `players` (name, pin_hash, position, stats, inventory, spawn point), `structures`, `resource_state`,
  `world_meta` (seed, day clock, protocol version).
- Writes are batched every few seconds, plus a flush when the last player leaves. After that the DO hibernates.
- **Admin backup:** an admin-only endpoint (protected by an admin secret set with `wrangler secret`) that downloads the whole world as JSON,
  plus a matching import. Guards against losing weeks of building to a bug.

### Worlds and identity
- Each world is one Durable Object instance, addressed by world code.
- Two worlds: **`test`** for development and a **family world** for Gabriel and the kids, created with an admin command. Development never touches the family world.
- The PIN is hashed with a per-world salt. Join attempts are rate-limited per name (backoff after 5 failures).
- A world has a player cap of 8 (it's for family, not public).

### Failure handling
- **Disconnect:** the client reconnects automatically with backoff. The server keeps the character idle for 30 s, then removes it
  from the world. Its state is already persisted.
- **Protocol mismatch:** the server rejects the join with a version code, and the client shows "Nueva versión: toca para actualizar".
- **Malformed or invalid messages:** dropped and counted. A client sending too many invalid messages gets disconnected.
- **DO eviction or restart:** state reloads from SQLite. Clients reconnect transparently.

### Testing
- **`shared/`:** Vitest unit tests (world gen determinism: same seed means same resources; recipes; combat; wolf AI step; survival).
- **`server/`:** Vitest with `@cloudflare/vitest-pool-workers` (local simulator): join/PIN, action validation, persistence round-trip,
  hibernation and reload.
- **Bot test:** 3 scripted headless clients join the test world, move, chop, build, leave and rejoin. The test asserts that all clients
  and the stored state agree.
- **Real playtest:** PC plus two phones on cellular data, following the success test above.

### Deployment
- **Everything on Cloudflare:** one Worker serves the client build and hosts the World DO, deployed together.
- **GitHub Actions:** on push to `main`, run tests, then `wrangler deploy` (production). A `test` environment gets its own URL.
- **Rollback:** `wrangler rollback` reverts client and server together.
- **URL:** `*.workers.dev` initially. A custom domain is optional later.
- **Prerequisite (Gabriel):** create a free Cloudflare account and run `wrangler login` once. Add a `CLOUDFLARE_API_TOKEN` repo
  secret for Actions.
- **Free-tier fit:** 3 players for a few hours a day is expected to fit the Workers Free plan (DO SQLite, WebSocket messages, duration).
  **The plan must check current limits** and size message rates to match.
