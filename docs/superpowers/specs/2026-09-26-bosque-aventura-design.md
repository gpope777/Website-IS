# Bosque — Aventura (BotW-style) + Base & Defense Design

**Date:** 2026-09-26
**Status:** Brainstorm approved by Gabriel; awaiting spec review.
**Replaces:** roadmap items #3 (Building, raids, base defense) and #5 (Story, bosses, creature pipeline), now merged into one "Aventura" track built biome by biome.
**Guiding principle (Gabriel):** the game's flow, mechanics and a world that feels fun to be in matter most. Build order is flexible.

---

## 1. Pillars

1. **Half adventure, half defense.** You go out to explore; the corruption advances meanwhile; you come back to defend. That tension is the game.
2. **Exploration and defense are one strategy.** Purifying a region weakens the raids that come from it.
3. **Discovery every 1–2 minutes.** Chests, shrines, elites, rare resources, vistas. Density is what makes the world fun.
4. **Challenging, not frustrating.** Built for Gabriel + nephews (12, 10), mostly on phones.
5. **The nephew's drawings are the world's creatures.** Enemies, lieutenants, bosses and mounts.

## 2. Story and villain

- **El Marchito** (working name): an ancient forest guardian that rotted and wants to absorb every living thing. He lives in a tower in the Corrupted Lands (the last biome), visible on the horizon from the whole map and growing over time.
- **Raíces-madre:** one per biome, feeding the corruption. Each one sits behind that biome's big dungeon.
- **Presence:** he speaks through visions when you purify a root-mother and reacts to the players. Named **lieutenants** (the best drawings, which the nephew names) lead some raids.
- **In-person invasions, only 3 in the whole game:**
  1. When you purify the first root-mother. He wrecks half the defenses, laughs and leaves.
  2. Mid-game. He takes something (a purified creature or a piece of the Heart), which opens a rescue quest.
  3. Right before the final assault on his tower.
  You cannot kill him during an invasion; you survive or drive him off.
- **Purified creatures:** a defeated drawing-boss or creature is purified and joins your base as a defender or pet.

## 3. Core loop

```
explore → find shrines / dungeon → gain power + materials
   ↑                                     ↓
defend the base at night  ←  corruption advances / raids escalate
```

- **Corazón del Bosque:** a heart-tree planted in the base. It is what El Marchito wants to consume.
  - Raids damage the Heart. If it reaches 0 it **withers**: you lose buffs and the corruption moves closer until you heal it. **Structures are not deleted.**
- **Corruption:** each biome's root-mother spreads corruption by zones. Purifying it cleans the region and **weakens raids from that direction**. If you don't advance, corruption grows and raids escalate. It only advances while someone is online (the world sleeps).

## 4. Session rhythm (target 30–40 min on phone)

1. **Log in.** The base reports what happened ("north wall damaged, corruption advanced 2 zones").
2. **Morning.** Repair or upgrade, then choose where to go. The horizon always offers 2–3 lures (glowing shrine, rare beast, purple smoke).
3. **Exploration.** Something every 1–2 minutes.
4. **Dusk.** The sky turns purple toward the raid's origin, with a ~2 minute warning. Getting back (glider or mount) is part of the game.
5. **Night raid.** One defense wave tests the morning's upgrades. Traps and purified creatures defend alone if nobody is home, but worse.
6. **Reward.** Raid drops feed the next upgrade.

- **Natural roles:** one fortifies while two explore. Rewarded, never required.

## 5. Combat (phone-first, "option C")

- Attack, dodge roll, **bow with soft auto-aim**, **simple block with parry** on precise timing, and one active **power**.
- Soft lock-on to the nearest target.
- **Weapons do not break.** They get upgraded (ties into #4 progression).
- **Bosses are puzzles:** they are weakened by parry and by that dungeon's power (for example, the Wind boss drops its shield only when pushed into something with wind).

## 6. Powers (one per big dungeon)

| Power | Exploration / puzzle | Defense |
|---|---|---|
| Enredadera | Root bridges; creates climbable spots | Living walls that regenerate |
| Viento | Glider boost; push objects | Knock enemies off cliffs |
| Luz/Fuego | Burn corruption, open paths | Fire traps; lanterns that scare night enemies |
| Piedra | Move blocks, weigh down plates | Instant towers and barricades |

## 7. Dungeons and shrines

- **One big dungeon per biome.** Handcrafted, **instanced** (the entrance is a giant root-mother in the world; the inside is its own space). 30–45 min, 4–6 puzzles, a mini-boss, the power and the boss.
- **6–10 small shrines per biome**, **inside the open world** (ruins, caves, hollow trees). 5–10 min, one puzzle, reward = an upgrade orb. Built from reusable pieces and templates.
- **Co-op puzzles that don't require 3 players:** plates held by a friend *or* a block, doors with 2 distant levers, a lantern someone has to carry. Always solvable solo.

## 8. Traversal

- **Goal: BotW-style free climbing** with stamina, a glider and swimming.
- **Early technical spike:** prototype free climbing on a phone before building levels on it.
  - **Fallback:** climbing only on marked surfaces (vines and rocks), plus the Enredadera power to create climbable spots.
  - "Climbable" is a flag on terrain and objects, so switching costs nothing.

## 9. Mounts

| Mount | How to get it | What it unlocks |
|---|---|---|
| Land (horse, giant deer, forest wolf) | Tame it in the forest | Fast travel; hauling materials |
| Water (whale, giant fish, light ray) | Coast/Lake dungeon reward + taming | Long swims, dives to sunken ruins, islands |
| Flying (dragon and other mythical beasts) | A corrupted dragon purified in the second-to-last biome | Flight, reaching the tower, air defense of the base |

- **Each mount is the key to the next biome.**
- **Taming minigames:**
  - **Timing ring** (core). A ring spins and you tap when it passes the marked zone. 3 rounds, each faster with a smaller zone. Failing throws you off; retry.
  - **Difficulty scales by beast.** A common horse has a big, slow zone. A dragon has 5 rounds, a tiny zone and reverses direction.
  - **Land:** the ring while the beast bucks and the camera shakes.
  - **Water:** a **race** chasing it through water rings, then a final ring.
  - **Flying:** jump from a cliff onto its back mid-flight, then several ring rounds.
  - **Co-op:** friends can **calm the beast** (feed or distract it), which widens the zone.
- **Legendary beasts:** one unique, named beast per biome, appearing only under conditions (full moon, storm).
- The nephew can draw his own mounts (the creature pipeline applies).

## 10. Death

- You drop the materials you were carrying in a **grave** and must go back for them. What's in the base is safe.
- **Co-op revive:** a teammate can revive you if they arrive within ~30 s.

## 11. Extras (approved, later slices)

- **Cooking** with buffs, BotW-style (ties into existing hunger).
- **Rescued NPCs / refugee village** that moves into your base (side quests, a living base).
- **Gameplay weather:** rain blocks climbing; storms summon legendary beasts.
- **Compendium:** creatures you've met, with the nephew's original drawing beside the 3D model.

## 12. Slice 1 — Forest vertical slice (first build)

A full story cycle in about 3–5 hours of play:

- Corazón del Bosque in the base, walls and 2–3 traps.
- Escalating night raids with the dusk warning; corruption by zones in the forest.
- Full combat (section 5).
- Free-climbing spike (A or fallback B), glider, swimming.
- 3 shrines.
- 1 big dungeon: **Enredadera** power + a boss made from one of the nephew's drawings, purified into a base defender.
- **Invasion 1** of El Marchito.
- Death with grave + co-op revive.
- 1 land mount with the timing-ring minigame.

**Out of slice 1:** other biomes, water/flying mounts, invasions 2–3, cooking, NPCs, weather, compendium, shops.

## 13. Roadmap impact

| New # | Track | Notes |
|---|---|---|
| 1 | Multiplayer foundation | DONE, live |
| 3+5 | **Aventura**, one slice per biome | Slice 1 = Forest (section 12). Each later slice adds a biome, its dungeon, power, mount and invasion beat |
| 4 | Progression | Folded into each Aventura slice (upgrade orbs, weapon upgrades) |
| 6 | Shops and economy | Unchanged |
| 2 | World and visuals | Unchanged; the biome art can merge into Aventura slices when convenient |
| 7 | Polish | Unchanged |

## 14. Open questions for the spec/plan phase

- Real names: villain, powers, biomes (the nephews can name them).
- Which drawing becomes the Slice 1 boss, and which become lieutenants.
- Raid scaling formula (players online, corruption level, story progress).
- How the server simulates instanced dungeons (a separate DO, or a sub-simulation inside the World DO).
