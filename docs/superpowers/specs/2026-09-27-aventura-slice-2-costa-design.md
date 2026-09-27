# Bosque — Aventura Slice 2: la Costa

> **Decisiones de Gabriel (2026-09-27), mandan sobre el resto del documento:**
> - Ciénaga como está, y **el ciervo lleva 2** (jinete + pasajero), para que nadie quede fuera de la Costa.
> - **Ballena: mínimo 2 jugadores para domarla** (no se puede solo). El co-op sigue agrandando la zona.
> - Invasión 2 se lleva al **Tragón purificado**. Jefe = `enemy3.png` ("El Antenón", provisional).
> - Perlas + mejora de arma: sí. Cambio de poder: mantener la pastilla 0,5 s. Costa de 220 m.

**Date:** 2026-09-27
**Status:** Draft for Gabriel's review. No code or plans yet.
**Builds on:** `2026-09-26-bosque-aventura-design.md` (the approved design; section numbers below as §N refer to it), `2026-09-26-bosque-online-design.md` (architecture), and the code on `aventura/slice-1` after the Slice 1 closeout (PROTOCOL_VERSION 12, 285 tests).
**Gabriel's fixed decisions (2026-09-27):** Costa/Lago biome made by extending the same world and reached with the deer; the Viento power; the giant fish (personal, ring race then a timing ring) and the whale (one per world, slow, carries 3–4, tamed in co-op); Invasion 2 in this slice; placeholder names kept in one file.
**Rule for everything else:** pick the simplest option that respects the spec. Every such choice is marked **[D]** with a one-line reason.

---

## 1. Pillars and goal

1. **Each mount is the key to the next part of the map.** Deer → reach the coast. Fish → shallow sea, sunken ruins, islets. Whale → rough water and the dungeon island.
2. **The coast is an expedition biome.** There is one Heart per world, and it stays in the forest. Raids still hit the forest base, so a coast trip has to get back home before dusk. **[D]** One base keeps defense readable, and the long ride home is the §4 tension.
3. **Discovery every 1–2 minutes** still applies. Rings, chests on the seabed, islets, shrines and corruption give the coast something to find at every range.
4. **Phone first.** The touch grid stays at 10 pills. Every new action goes through the contextual **A** button, or through B while riding.

**Goal of the slice:** a second full story cycle of about 3–4 hours: reach the coast, tame the fish, run 3 shrines, lose the Tragón to Invasion 2 and rescue it, tame the whale with friends, clear the coast dungeon, gain Viento and purify the second boss.

## 2. Player-facing loop

```
forest base ──deer gallops the Ciénaga──▶ beach (shrines, corruption, wild fish)
     ▲                                          │ tame the fish
     │ ride home before dusk                    ▼
 night raid at the Heart ◀── islets / sunken ruins / rescue quest ── whale (co-op) ──▶ dungeon island ──▶ Viento + boss
```

**A 30–40 min phone session (target):**
1. Log in and read the base report (0–2 min).
2. Repair the base and choose a lure (2–5): purple smoke on an islet, a shrine beam on the beach, the whale's spout.
3. Ride the deer to the Ciénaga and gallop across (5–8, about 25 s of riding).
4. Explore the coast (8–28): one shrine (5–10 min), or fish-riding plus 2 sunken chests, or 1 rescue anchor. The dungeon takes a whole session (30–45 min, §7 of the base spec).
5. Dusk warning (about 2 min): gallop home (about 40 s from the beach to the Heart). The raid and its reward take 28–38 min.

## 3. World extension: the Costa

### 3.1 Shape
- The playable map grows **south**. The forest stays at |x|, |z| ≤ `HALF` (240). The coast adds the strip `HALF < z ≤ HALF + 220`, over the same x range. **[D]** The dungeons already live off-map on +x (`x = HALF + 150`), so the south side has no overlap and the forest is untouched.
- **Bands, from north to south (starting values):**

| Band | z (from HALF) | Height | What it is |
|---|---|---|---|
| Ciénaga (the gate) | −40 … +20 | flat, WATER_LEVEL + 0.3 | withered mud, 60 m deep, the whole width |
| Beach | +20 … +50 | slopes from +2 down to WATER_LEVEL | shrines 1–2, wild fish, corruption zones |
| Shallows | +50 … +90 | WATER_LEVEL − 1 … −4 | swimming works on foot here |
| Deep sea | +90 … +200 | down to −18, with a seabed noise | fish only; 6 sunken chests; 3 islets |
| Aguas bravas | ring of 30 m around the dungeon island | deep | whale only |
| South rim | +200 … +220 | rim hills | keeps players in, like today's rim |

- **Islets:** 3 bumps, seeded, rising 4–8 m above water, each 18–25 m across, in the deep sea. One holds shrine 3, and all three hold the rescue anchors (§8).
- **Dungeon island:** 1 bump, 30 m across, near `z = HALF + 170`, circled by aguas bravas. The coast's Raíz-madre (the entrance) stands on it.

### 3.2 The deer gate: the Ciénaga
- **On foot:** mud slows you to 3 m/s and "the withered mud bites" for 8 PV/s. Crossing 60 m takes 20 s, or 160 PV, which is death.
- **On the deer:** the deer is immune and gallops at 12 m/s, so the crossing takes about 5 s. The Ciénaga is dry by `WATER_LEVEL`, so today's "deer stops at the shore" rule does not block it.
- **Gliding does not skip it:** no crags within 60 m of the Ciénaga (the crag generator excludes the band). Glider sink is 1.6 m/s and forward speed 7 m/s, so crossing 60 m needs 14 m of height, and nothing is that tall there.
- **Server-authoritative:** the damage and slowdown are a sim function of position plus `riding`, the same way corruption zones and cold already work. There is no new message.
- **[D]** Why damage instead of a wall: one terrain function and one sim check, no new geometry. It also reads as "corruption".

### 3.3 Water rules (server-validated)
- **Depth** = `WATER_LEVEL − heightAt(x, z)`.
- **On foot:** you can swim where depth ≤ 4 m. Past that, the server accepts only moves that **reduce** depth ("La corriente te devuelve"). A glider can fly over deep water, and if you land there you can only swim back toward the shallows. **[D]** Server-side and one line, with no drowning (as in Plan D).
- **Fish riders:** allowed in all water except aguas bravas, and allowed below the surface down to the seabed + 0.5 m.
- **Whale riders:** allowed everywhere wet, surface only.

## 4. Power: Viento

Gained at the coast dungeon's altar (room 2), the same pattern as Enredadera.

- **Gust (H / power pill):** a cone of 8 m and 70° in front of you. Cooldown 6 s.
  - **Enemies:** pushed 6 m away and stunned 1 s, with 5 damage. A pushed enemy that ends in deep water, off a ledge more than 3 m, or on spikes takes those effects (deep water kills raiders and wolves: "Se los lleva el mar"). The Marchito and bosses are pushed 2 m and are never killed by water.
  - **Objects:** a **pumice block** (the new pushable) slides 6 m. **Fan-gates** open when a gust hits them.
  - **While gliding:** an upward gust gives +6 m of height, once per glide. This is the "glider boost".
- **Defense:** the purified coast boss (§7.3) gusts raiders away from the Heart. The player's gust knocks raiders back into spikes or the root net.
- **Power switching [D]:** one power pill, which shows the current power's icon (🌿 / 🌬️).
  - **Tap** casts. **Long-press 0.5 s** switches. On keyboard, H casts and **J** switches, and the Menú lists both.
  - The choice is client-side and sent with each `power` message (`power: 'enredadera' | 'viento'`). The server checks that you own it.
  - Each power has its own cooldown.
  - Why: this keeps 10 pills, needs no radial menu on a phone, and is instantly readable.

## 5. Mounts

### 5.1 Giant fish (personal)
- **Wild fish:** one per world, circling in the shallows 5–15 m off the beach, with a golden halo on the water. Each player tames "their copy", like the deer. **[D]** This reuses the deer's model with no stealing in co-op.
- **Taming, part 1 (race):** press A when near it and it bolts. **6 water rings** appear, 10–14 m apart, in the shallows. Swim through each within **7 s** of the previous one (fast swim is 4 m/s, so this is doable with stamina). A miss means "Se escapa" and a 3 s retry.
  - **Server:** it knows the ring list (seeded) and the start time. A ring counts when a validated position comes within 2.2 m of its centre, in order, before the deadline.
- **Taming, part 2 (final ring):** the deer's timing ring, reused with **2 rounds**: speed 3.0 → 4.2 rad/s, zone 1.1 → 0.75 rad. A co-op calmer at ≤6 m gives ×1.5 width, as for the deer.
- **Riding:**
  - Speed: surface 9 m/s, sprint 14 m/s (sprint uses no stamina). The server cap for fish riders is **15**, plus a 2 s grace after dismounting.
  - **B held = dive:** sink at 3 m/s to the seabed. Release to float up at 4 m/s. No air limit. **[D]** Kids' game; the ruins should be fun, not a timer.
  - A near the shore (depth < 1 m) dismounts. The fish waits where you left it, and A next to it remounts.
  - On a fish you cannot enter the Ciénaga or aguas bravas, or go into dungeons.
  - The fish is only for water. On land you walk; the deer stays parked at the beach.

### 5.2 Whale (one per world, shared)
- **Wild whale:** spouts in the deep sea at a seeded point, and its spout can be seen from the beach (a lure).
- **Co-op taming:** every player within 10 m of it (on fish) counts.
  - **4 ring rounds**, speed 2.2 → 4.8 rad/s, zone 1.2 → 0.55 rad, **each round's zone ×(1 + 0.4 × extra players), up to 3 extra**.
  - Any player in range may tap. The first tap that lands counts for the round. **[D]** Solo is possible but hard (the "co-op rewarded, never required" pillar). Gabriel said "tamed in co-op"; see Q2.
  - A fail makes the whale dive for 10 s, then retry from round 1.
- **Once tamed it belongs to the world** (`SavedWorld.whale`), not to a player.
- **Seat model:** **4 seats**. Seat 0 is the **pilot**, the first to board; the rest are passengers.
  - A next to the whale (≤5 m) boards the first free seat. A on the whale leaves: you are placed in the water beside it (on your fish if it is nearby, otherwise swimming).
  - If the pilot leaves, seat 1 becomes pilot.
- **Server:** only the pilot's `move` messages move the whale.
  - Speed 5 m/s, sprint 7, surface only. It can enter aguas bravas. It can't go shallower than 3 m ("La ballena no cabe").
  - Passenger `move`s are ignored except for yaw. The server sets their position to the whale's plus a seat offset.
  - `PlayerView.ride` becomes `'deer' | 'fish' | 'whale' | null`, and `snap.whale = {x, z, yaw, seats: (name|null)[4]}`.
- **Parking:** the whale stays where the last rider left it. If nobody rides it for 10 min of online time, it swims back to its home spot. **[D]** This way it is never stuck far away for a friend who logs in later.

## 6. Coast content

### 6.1 Shrines: 3 (ids 3–5 in the same shrine list)
Same rules as Slice 1: a light beam, a gate, an orb (+20 max stamina), one clear per player, and shared puzzle state.
1. **Marea (beach):** a tide plate 12 m from the orb. Push the **pumice block** onto it: with Viento a gust slides it; without Viento the block can be carried with A (slow, 3 m/s). A friend standing on the plate also works.
2. **Hundido (shallows, depth 3 m):** one lever on the beach and one on the seabed (only reachable diving on the fish). Pull both within 8 s. Solo: pull the seabed lever, then surface and sprint back (the fish covers the ~40 m in about 5 s at sprint).
3. **Islote (islet 1):** a fan-gate. A gust opens it, or 3 players pulling 3 wheels. Solo without Viento this needs Viento, so it is a "come back later" shrine, like the smooth rock in Slice 1. **[D]** It keeps the BotW habit of revisiting.

### 6.2 Sunken ruins
- **6 chests** on the seabed, seeded in the deep sea, near 2 ruin clusters (broken columns reused from the crag geometry, lying flat). A soft bubbling glow can be seen from the surface.
- **A on the seabed** opens a chest. Each gives existing materials: 6–10 of wood, stone or berries, plus 1 **pearl**.
- **Pearl:** a new inventory item with one use in this slice. 3 pearls + the forge's current cost buy a **weapon upgrade** (+15 % damage, max +3). This is the first taste of the §13 progression. **[D]** It gives the chests a reason to exist without starting a shop economy. See Q5.
- Chests are one per player, like shrines (`SavedPlayer.chests`).

### 6.3 Islets
- 3 islets. Islet 1 holds shrine 3, and each islet holds one rescue anchor (§8). Two carry a "crow's nest": a crag, so you can glide from it with Viento's boost to the next islet.
- Islets have land, so resources spawn on them (existing worldgen, restricted to dry ground).

### 6.4 Coast corruption
- **4 coast zones**, added to the same list as the forest's 6 (ids 6–9).
  - Zone 6 is the **coast Raíz-madre** (on the dungeon island). Zones 7–9 are on the beach, the shallows and an islet.
  - Same visuals and same night rule (+2 beasts per player standing in one).
- **Cleansing:** a coast shrine orb cleans the nearest coast zone. Viento gusting the zone's withered root (≤5 m) also cleans it. **[D]** It is the mirror of Enredadera. Beating the coast boss cleans zone 6.
- **Raids stay at the Heart.** The existing rule, "raids come from the corrupt zone nearest the Heart", keeps working over all 10 zones. Coast zones are far away and rarely nearest.
- **New coast pressure:** while zone 6 is uncleansed, every raid gets **+1 brute per 2 corrupt coast zones**. The warning says "algo sube de la costa". Beating the coast boss removes it. This is how §3 "purifying weakens the raids" reaches the coast. **[D]** One number and no second base.
- **At night on the coast:** the existing wolf spawn applies, with no new beasts. See §10.

## 7. Coast dungeon

### 7.1 Access
The coast Raíz-madre stands on the dungeon island, so reaching it needs the **whale**. A on the trunk enters (riders are dropped off; the whale stays).

### 7.2 Layout
The layout is instanced like Slice 1: an off-map rectangle in the same room at **`x = HALF + 300`**, 24 × 180 m, flat floor, with the same `withDungeon`/`clampStep` approach generalised to a list of dungeons. Five gates, then two fights:
1. **Levers** (reused), with the wet floor as decoration only.
2. **Altar: Viento.**
3. **Fan-gate:** gust the fan.
4. **Pumice block onto a plate across a 10 m channel:** gust it over, because carrying it through water is not allowed.
5. **Updraft chasm:** glide plus the Viento boost over a 20 m pit. Falling respawns you at the gate with −10 PV. **[D]** This is the one "real gap" in the game, and it is possible because the interior floor can be any function.
6. **Mini-boss: the shielded brute.** The Slice 1 elite with a front shield. Hits from the front are blocked; a gust spins it around (3 s exposed). Rolling or parrying still works. 420 PV.
7. **Boss:** see §7.3.

### 7.3 The boss
- **Drawing:** **`public/enemies/enemy3.png`** (the blue creature with pink antennae and a star). Placeholder name: **"El Antenón"**.
- **Why this one:** it is unused (enemy1 is the Tragón, enemy12 the Marchito, enemy15 has no transparency), and it is blue and big-bodied, which reads as water.
- **Before the plan:** check it has real transparency, as Plan H had to with enemy15.
- **Fight:** 360 PV, a paper cutout like the Tragón. Arena: 20 × 20 m with **4 coral pillars**.
  - **Armour:** "Cáscara de marea". Hits do nothing until it is exposed.
  - **Exposed 5 s:** when **pushed by a gust into a pillar** (the §5 rule "the Wind boss drops its shield only when pushed into something"), or **3 s after a parry**.
  - **Attacks:** a telegraphed charge (1.0 s windup, 14 damage), and an antenna sweep (0.8 s windup, 10 damage, 4 m radius, dodge by rolling).
  - As with the Tragón, it resets if the room empties.
- **Purified:** `SavedWorld.purified2 = true`. A small white Antenón waits by the Heart. **In raids, every 8 s it gusts the raiders within 12 m of the Heart 6 m away**, which also pushes them into spikes and nets. It has no HP and cannot die.
- **Vision** on the win, naming the players present.

## 8. Invasion 2: the stolen Tragón

**[D] He takes the purified Tragón, not a piece of the Heart.** A piece of the Heart would touch the raid/wither balance of the whole game. The Tragón is a character the kids already know, and its absence is felt at night (no defender).

- **Trigger:** at the first dusk after **any player tames the fish**, if `invasion === 'done'`, `purified === true` and a Heart exists.
  - **[D]** This way the rescue is immediately doable, since the fish reaches the islets.
  - If the conditions are not met, it waits.
- **The invasion:** Invasion 1's entry code and will bar are reused. He enters from the **south** (toward the coast), walks to the white Tragón, and wraps it in roots for 6 s (a "grab" bar). Then he leaves south with it.
  - **Will:** with Invasion 1's formula ×1.2. **Driving him off before the grab ends does not stop the theft** (§2 of the base spec: you only survive or drive him off). It does mean he breaks **no** defenses. If he is not driven off, he breaks a quarter of them as he leaves.
  - Vision: "Me llevo al perrito de papel. Venid a por él al mar, Ana."
- **Rescue quest (coast):**
  1. The Tragón hangs in a **root cage** on the seabed next to the dungeon island's shallows, which can be seen from the fish.
  2. The cage is held by **3 anchors**, one per islet: a withered root with 150 PV. Hits work, and a Viento gust does ×3 damage.
  3. Each broken anchor shows a purple chain snapping, and the cage sinks lower as a readable progress bar.
  4. Each anchor spawns **2 corrupt wolves** on its islet the first time someone arrives there (a guard fight).
  5. After 3 anchors, A on the cage frees it. The Tragón returns to the Heart and gains **+10 bite damage** ("vuelve con rabia"). Vision from the Marchito, sulking.
- **Meanwhile:** raids happen without the Tragón defender. That is the pressure.
- **Save:** `SavedWorld.invasion2: 'pending' | 'taken' | 'rescued'` and `anchors: boolean[3]`. Mid-invasion saves resume like Invasion 1.

## 9. Names: one place

All player-facing proper names move to **`src/shared/names.ts`**:

```ts
export const NAMES = {
  villain: 'El Marchito', heart: 'Corazón del Bosque', forestRoot: 'Raíz-madre', coastRoot: 'Raíz-madre de la Costa',
  bossForest: 'Tragón de Papel', bossCoast: 'El Antenón', eliteForest: 'bruto reforzado', eliteCoast: 'bruto escudado',
  powerVine: 'Enredadera', powerWind: 'Viento', biomeForest: 'el Bosque', biomeCoast: 'la Costa', gate: 'la Ciénaga',
  deer: 'el Ciervo', fish: 'el Pez Grande', whale: 'la Ballena', pearl: 'perla',
} as const;
```

- UI strings and visions use `${NAMES.x}`. Plan S2-A migrates the existing names. **[D]** This is one flat object with no i18n machinery. Grammatical gender and articles are kept inside each string, so a renamed item may need its sentence fixed.

## 10. Out of scope (Slice 2)

- A second base or Heart on the coast, and raids that reach the coast.
- New coast enemy species: wolves and brutes are reused (a tint at most). Drowning or an air meter.
- The light-ray mount, legendary beasts, weather and tides, fishing, cooking, NPCs, compendium, shops.
- Whale hauling of materials. The fish or whale following or answering a whistle.
- Rescuing a piece of the Heart. Invasion 3.
- Real underwater visuals beyond a blue fog plus a caustic tint. Dungeon ceilings.

## 11. Technical

### 11.1 World extension (heightmap + water)
- `terrain.ts`: add the constants `COAST_Z0 = HALF - 40` and `SOUTH = HALF + 220`. `heightAt` keeps today's function for `z < COAST_Z0` and blends over 20 m into a `coastHeight(x, z)`, built from the bands in §3.1, the islet bumps and the seabed noise. The rim formula uses `max(|x|/HALF, z < 0 ? |z|/HALF : 0)` on the north, east and west sides, and the new south rim at `SOUTH`.
  - `WATER_LEVEL` stays **one global constant**. The sea is just terrain below it, so the existing swim logic works.
- Everything seeded that assumes `|z| ≤ HALF` (crags, shrines, corruption, the deer, the entrance, resources) gets a bounds helper `inForest(x, z)` so it keeps spawning in the forest. Coast generators are new functions in `src/shared/coast.ts`.
- **Client:** the terrain mesh grows from 480 × 480 to 480 × 700 m. Use a coarser grid (×2 cell size) for z > HALF + 90, where it is mostly underwater, and extend the water plane.
- **Dungeons:** `DUNGEON` becomes `DUNGEONS[0..1]` with its own x offset. The helpers (`inDungeon`, `clampStep`, `withDungeon`) take the dungeon id.

### 11.2 Protocol and save (PROTOCOL_VERSION 12 → 13+, one bump per plan)
All new saved fields are optional, so old saves load.
- **Client messages:**
  - `power` gains `kind`.
  - `tame` gains `beast: 'deer' | 'fish' | 'whale'`.
  - `board` / `leave` for the whale (or folded into `act` if that stays simpler).
  - `move` may carry y below the surface for fish riders.
- **Snapshot:**
  - `PlayerView.ride` becomes a union.
  - New `snap.fish` / `snap.whale`, `SelfState.powers: string[]`, `SelfState.race` (ring index and deadline), `snap.cage` (anchors).
  - `EnemyKind` gains `'boss2'` and `'elite2'`.
- **`SavedPlayer`:** `fish?`, `viento?`, `chests?`, `pearls?` (in the inventory), `weaponLvl?`.
- **`SavedWorld`:** `whale?`, `purified2?`, `invasion2?`, `anchors?`, and `cleansed` extended to 10 ids.

### 11.3 Risks
- **Phone performance:** about 46 % more terrain, plus water. Mitigate with the coarse far grid, sea fog, and the existing quality tiers.
- **Whale seats and latency:** passengers are positioned by the server and interpolated. Expect slight jitter. The pilot uses client prediction like the deer.
- **The Ciénaga feels unfair** to a friend without a deer. Mitigation: the damage is clearly telegraphed (purple mud, a warning at the edge). See Q1.
- **Old worlds:** the coast appears in every existing world because it is terrain from the seed and nothing overlaps (the forest z range is untouched, apart from the blend at `COAST_Z0`). Any structure a player built within 40 m of the south rim might end up in the mud. Check this with the save importer.
- **Deep-water kills** from Viento can trivialise raids if the Heart is near a lake. Cap this at 3 water kills per gust cooldown window, or just tune it after playtests.
- **enemy3.png transparency:** not verified yet.

## 12. Plan map (sized like Plans A–H)

| Plan | One line |
|---|---|
| **S2-A** Costa terrain + Ciénaga + names | Extend the heightmap south (bands, islets, seabed), the Ciénaga damage/slow gate for walkers, deep-water rules, `names.ts` migration, client mesh/water, protocol v13. |
| **S2-B** Giant fish | Wild fish, ring race + 2-round ring judged by the server, riding (cap 15), dive with B, dismount at the shore. |
| **S2-C** Coast shrines + sunken ruins | 3 shrines (plate/pumice block, dual lever with a seabed lever, fan-gate), 6 seabed chests, pearls, weapon upgrade. |
| **S2-D** Coast corruption | Zones 6–9, cleansing rules, the +brute raid pressure, the "algo sube de la costa" warning. |
| **S2-E** Whale | Co-op taming (4 rounds, zone widening per player), 4-seat model, pilot/passengers, aguas bravas, return home. |
| **S2-F** Coast dungeon + Viento | Dungeon list refactor, the second interior (5 gates incl. the updraft chasm), Viento power + switching (long-press / J), shielded brute. |
| **S2-G** El Antenón + purified defender | Boss (enemy3, pillars, exposed on a gust into a pillar/parry), vision, white Antenón gusting raiders at the Heart. |
| **S2-H** Invasion 2 + rescue | Trigger after the first fish, the grab, the theft, the cage with 3 island anchors and guards, the Tragón's return with +10 damage. |

The order follows unlocks: fish before shrines 2/3 and the rescue; the whale before the dungeon. S2-H could move right after S2-B if playtests want the story beat earlier.

## 13. Open questions for Gabriel

1. **The Ciénaga's rule:** mud that damages walkers (my choice) or a pure distance/speed gate? Should friends without a deer be able to ride along (two on the deer)?
2. **Whale "in co-op":** strictly ≥2 players, or solo-possible-but-hard (my choice, per pillar 4)?
3. **Invasion 2:** is taking the Tragón right, or would the nephews prefer he steal a piece of the Heart?
4. **Boss drawing:** is `enemy3.png` the one, and what do the nephews call it? Same for the fish and the whale (should they draw them?).
5. **Pearls and a weapon upgrade** is a small taste of progression (#4). Keep it, or leave the chests as materials only?
6. **Viento switching:** is long-press on the power pill OK on their phones, or do they want a second pill (dropping, e.g., 🎯 fijar)?
7. **Map size:** is 220 m of coast enough, or should the sea feel bigger (at a phone performance cost)?
