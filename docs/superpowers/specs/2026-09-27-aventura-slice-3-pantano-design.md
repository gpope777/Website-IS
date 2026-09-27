# Bosque — Aventura Slice 3: el Pantano

> **Decidido por Claude — revisar** (Gabriel no respondió; criterios de la Fase 3 del HANDOFF: lo más simple que respete el spec, co-op que no bloquee al que juega solo salvo cuando es el gancho, no tocar el balance del Corazón, nombres en `names.ts`, dibujos como papel espíritu, rejilla ≤10):
> - **Dónde:** el Pantano se añade al **oeste** del mapa (x < −HALF), a lo largo del bosque y la costa; el este queda para las mazmorras fuera de mapa.
> - **Llave:** el **Pez Grande** (y la Ballena). El oeste está cerrado por el **Zarzal** (espinas que muerden a pie y a ciervo); se entra nadando río arriba por la **Boca del Río**, agua honda desde el oeste de la Costa.
> - **Amigos sin pez:** la Ballena cabe por el río (≥3 m) y lleva 4; y tras conseguir el Fuego, quemar el Zarzal abre un **paso a pie permanente** para todo el mundo.
> - **Poder:** **Fuego** (el "Luz/Fuego" del spec). Encaja con niebla, turba y raíces marchitas; Piedra queda para las Montañas (bloques, rocas, torres).
> - **Montura:** **la Rana** (personal, tierra + agua somera). Su **salto alto con B** es la llave de las Montañas (repisas).
> - **3 santuarios** (ids 6–8): Candiles (3 braseros), Nenúfares (hojas que se hunden), Turba (muro de raíz que solo arde: "vuelve luego").
> - **Mazmorra** en `x = HALF + 450` (tercera de la lista), 5 verjas + mini-jefe **bruto de turba** (se regenera en el barro si no arde).
> - **Jefe:** `enemy9.png` (bicho verde de patas largas, alfa real verificada: 81 % transparente) → **"El Zancudo"**. Vuela; cae 5 s al encenderle un respiradero de gas debajo.
> - **Defensor purificado:** el Zancudo blanco pone un **farol** junto al Corazón: los lobos que entran en su luz huyen 3 s (no toca PV ni daño del Corazón).
> - **Corrupción:** zonas **10–13** (10 = Raíz-madre del Pantano). El Fuego a ≤5 m de la raíz la limpia.
> - **Teniente:** `enemy2.png` (cabeza amarilla, patas negras; alfa verificada) → **"La Gata Araña"**. Lidera 1 asedio de cada 3 mientras la zona 10 esté corrupta.
> - **Progresión (#4):** nuevo material **ámbar** (árboles hundidos) → **Capa de corteza**, el primer tier de armadura (−10 % de daño por nivel, máx. 3).
> - **Sin Invasión** en este slice (el spec dice solo 3 en todo el juego; la 3ª va antes del asalto final). El Marchito solo aparece en **visiones**.
> - **Idea de Claude:** **Fogatas del Pantano**, 4 fogatas sembradas que, encendidas con Fuego, sirven de viaje rápido de día desde/hacia el Corazón.
> - **Rejilla táctil:** sigue en 10. El Fuego entra como tercer poder de la pastilla de poder (mantener = cambiar); todo lo demás va por A contextual o B montado.

**Date:** 2026-09-27
**Status:** Draft, decided autonomously (Fase 3). No code or plans yet.
**Builds on:** `2026-09-26-bosque-aventura-design.md` (§N below refers to it), `2026-09-26-bosque-online-design.md`, `2026-09-27-aventura-slice-2-costa-design.md` (S2 §N), and the code on `aventura/resto` after Slice 2 (PROTOCOL_VERSION 22, 456 tests).
**Rule:** simplest option that respects the spec. Every choice is marked **[D]** with a one-line reason.

---

## 1. Pillars and goal

1. **Each mount is the key to the next part of the map.** Deer → Costa. Fish (or whale) → up the river into the Pantano. **Frog → the Montañas** (its high jump climbs ledges no one else can).
2. **The Pantano is an expedition biome**, like the Costa. The single Heart stays in the forest; raids still hit it. **[D]** Same reason as S2: one base keeps defense readable. The Fogatas (§9) keep the trip home from becoming a chore at the third biome.
3. **Fog and fire.** The swamp is the first biome where you *can't see far*. Fuego is what cuts through: it lights braziers, fogatas, gas vents and burns withered things. Discovery every 1–2 min is lights in the fog.
4. **Phone first.** 10 pills. New actions through contextual **A**, **B** while riding, and the power pill.

**Goal of the slice:** a third story cycle of about 3–4 hours: swim up the river, tame the frog, run 3 shrines, collect amber for the first armour, face La Gata Araña in a raid, clear the swamp dungeon, gain Fuego, purify El Zancudo, burn the Zarzal open for friends.

## 2. Player-facing loop

```
forest base ──deer──▶ Costa ──fish/whale up the Boca del Río──▶ Laguna Negra ─▶ Pantano (fog, shrines, amber, frog)
     ▲                                                                           │ tame the frog
     │ gallop home, or Fogata → Heart (day only)                                 ▼
 night raid (sometimes led by La Gata Araña) ◀──────── dungeon (sunken tree) ──▶ Fuego + El Zancudo ──▶ burn the Zarzal
```

**A 30–40 min phone session (target):**
1. Base report, repair, pick a lure: a brazier glow in the fog, a frog croak marker, amber shine (0–5 min).
2. Ride to the coast and swim up the river (5–9 min; about 90 s from Heart to the Laguna). After the first fogata is lit: fast travel, 5 s.
3. Explore (9–28): one shrine, or the frog taming, or 3–4 amber trees, or a corruption root.
4. Dusk warning: fogata → Heart (5 s channel) or ride home. Raid.

## 3. World extension: el Pantano

### 3.1 Shape
- The map grows **west**. The swamp is the rectangle **`−HALF − 180 < x < −HALF`, `40 < z < HALF + 150`** (180 × 350 m). **[D]** East is taken by the off-map dungeons (`x = HALF + 150/300/450`), south by the Costa; west touches both the forest (for the later burnt shortcut) and the coast (for the river).
- Bounds become a union: forest ∪ coast ∪ swamp. `inBounds` / `clampToWorld` in `terrain.ts` get a third rectangle; `inForest` is unchanged, a new `inSwamp(x, z)`.

| Band | Where | Height | What it is |
|---|---|---|---|
| **Zarzal** (the wall) | `−HALF − 12 … −HALF + 4`, all of the swamp's z range | forest rim height | withered thorns; bites (below) |
| **Boca del Río** | x from −HALF − 12 to −HALF + 6, z = HALF + 95 … HALF + 111 (16 m wide) | bed WATER_LEVEL − 5 | deep channel through the Zarzal from the coast's west end |
| **Laguna Negra** | south end, z > HALF + 60 | bed −5 … −8 | deep dark water; fish + whale; the dungeon's sunken tree in its middle |
| **Ciénaga alta** (bog) | most of the rest | WATER_LEVEL − 0.3 … −1.5 with noise | knee-deep water; walkers at 60 % speed; frog at full speed |
| **Montículos** | 10–14 seeded bumps, 12–30 m | +1 … +4 above water | solid ground: shrines, amber trees, fogatas, resources |
| **Rim** | x < −HALF − 165 and z edges | rim hills | keeps players in |

### 3.2 The fish gate: Zarzal + Boca del Río
- **Zarzal on foot or on the deer:** slows to 3 m/s and bites **10 PV/s** (the Ciénaga's rule with a different number; the deer is *not* immune: "las espinas no respetan al ciervo"). It is 16 m thick → ~5 s → 50 PV; but its top is the rim hill, and past it the swamp's first 30 m are thorns too (x −HALF−12 … −HALF−42 counts as Zarzal where not water). Net ~15 s / 150 PV: death. **[D]** Same one-function-one-sim-check trick as the Ciénaga.
- **No gliding over:** no crags within 60 m of the Zarzal (crag generator excludes it, like S2 §3.2).
- **The river:** depth 5 m > `SWIM_MAX_DEPTH` 4, so on foot "la corriente te devuelve" (existing rule). **Fish** swim it in ~5 s. **Whale** fits (≥3 m) and carries 4 → friends without a fish get in as passengers. The river's water is *not* Zarzal (thorns only apply to dry-ish cells).
- **Inside:** fish can use the Laguna and any water ≥1 m deep; below that "el pez no pasa". You get off at a montículo and walk (slow in the bog) until you have the frog.
- **Burnt path (after Fuego):** at one seeded point on the forest's west rim (the closest to spawn, around z = 120), a **Zarzal knot** (withered root, 200 PV). Fuego at ≤5 m for a total of 3 casts burns it: `SavedWorld.zarzalBurnt = true`, a 10 m gap in the Zarzal band becomes plain ground **for everyone in the world**. **[D]** Co-op never blocks: once any player has Fuego, walking friends get in too.

### 3.3 Fog
- Swamp fog: client `scene.fog` density ramps from forest value to **near 35 m / far 70 m** inside `inSwamp` (blend over 20 m). **[D]** Client-only, cheap, and cuts draw distance on phones (helps perf, §12.3).
- Lights ignore fog: braziers, fogatas, amber glow, corruption roots, the frog's throat glow. These are the swamp's lures.

## 4. Power: Fuego

Gained at the swamp dungeon's altar (room 2), same pattern as Enredadera/Viento.

- **Llamarada (H / power pill):** a cone of **6 m, 60°**, instant. Cooldown **5 s**.
  - **Enemies:** 6 damage + **burning 3 PV/s for 4 s** (18 more). Burning wolves **flee for 2 s** (the spec's "scares night enemies"). Bosses and El Marchito take the damage but don't flee.
  - **Objects:** lights **braziers** and **fogatas** (§9), ignites **gas vents** (boss), burns **withered roots**: shrine 3's turba wall, the Zarzal knot, corruption roots (cleanse at ≤5 m, §7), and the swamp dungeon's thorn gate.
  - **Fire trap (defense):** the spec's "fire traps" become a **third trap choice** in the Menú ("Trampa: estacas / red de raíces / **hoguera**"); **needs Fuego owned**. Hoguera: 4 wood + 2 amber, 60 PV; the first beast to step in burns (3 PV/s, 4 s) and every wolf within 4 m flees 2 s; rearms in 8 s. Key **U** on keyboard. **[D]** Reuses the trap pill + Menú selector from the S1 closeout: no new pill.
- **Switching:** the power pill cycles **🌿 → 🌬️ → 🔥** on long-press 0.5 s (J on keyboard), skipping powers you don't own. `power.kind` gains `'fuego'`. Each power keeps its own cooldown.

## 5. Mount: la Rana

- **Wild frog:** one per world, on a montículo near the Laguna's north shore, with a golden halo and a croak marker visible through fog. Each player tames "their copy" (like deer and fish). **[D]** Personal mount: no stealing, solo-friendly.
- **Taming, part 1 (the chase):** A near it → it hops away to **3 lily pads** in sequence (seeded, 8–12 m apart across bog water). Reach each pad (≤2.5 m) within **6 s** of its landing. On foot in the bog (60 %) that's tight but doable with sprint; the fish can't follow (too shallow). Miss = "Se escapa", 3 s retry. Server: same shape as the fish ring race (`race` state reused, 3 targets).
- **Taming, part 2:** the timing ring, **3 rounds**, speed 3.0 → 4.6 rad/s, zone 1.1 → 0.7 rad; co-op calmer at ≤6 m ×1.5 as always.
- **Riding:**
  - Land and water up to **2 m deep**: 8 m/s, sprint 11 (no stamina). Bog doesn't slow it. Server cap for frog riders: **12** (+2 s grace).
  - **B = salto alto:** 7 m up, carries 9 m forward, cooldown 1.2 s. Lands on any surface; no fall damage while riding. This is how you reach high montículos (amber tree 3, shrine 2's shortcut) and, next slice, mountain ledges.
  - Carries 1 (personal). The Zarzal still bites it (so the fish stays the key into the swamp until it burns).
  - A dismount / remount like the deer; it waits where left. Not in dungeons.
- `PlayerView.ride` gains `'frog'`. `SavedPlayer.frog?`.

## 6. Swamp content

### 6.1 Shrines: 3 (ids 6–8)
Same rules: beam, gate, orb (+20 max stamina), one clear per player, shared puzzle state.
1. **Candiles** (montículo): 3 braziers 10–14 m apart around the gate. All 3 lit at once opens it; each stays lit **12 s**. With Fuego: one cast each. Without Fuego: a **torch post** at the gate; A takes a torch (carried like the root block, 4 m/s), A at a brazier lights it. Solo without Fuego is too slow → 2 players with torches, or come back with Fuego. **[D]** Mirrors "come back later" with a co-op path.
2. **Nenúfares** (bog): the orb stands on a montículo 30 m across open water, reached by **7 lily pads** that sink 1.5 s after you step on (resurface in 4 s). Falling in = swim back to the start. The frog's jump crosses it in 3 hops. **[D]** First puzzle that rewards the frog without requiring it.
3. **Turba** (Laguna edge): the gate is a wall of withered peat roots. **Only Fuego** burns it (3 casts). "Vuelve luego" shrine, like S1's smooth rock and S2's fan-gate.

### 6.2 Amber trees (the material)
- **6 sunken trees** seeded on montículos (2 need the frog's jump: top on a +6 m stump). Amber glows orange through fog.
- **A** harvests: **2 ámbar**, regrows after **2 in-game days**, per player (`SavedPlayer.amber?` timestamps by tree id). Also 1 ámbar from each swamp shrine orb.
- `ItemId` gains `'amber'` (label from `NAMES.amber`).

### 6.3 Capa de corteza (progression #4)
- At the Heart, next to the weapon upgrade: **Capa** levels 1–3, cost **3 ámbar + 10 wood + 5 berries** each.
- Each level: **−10 % damage taken** from all sources except the Zarzal/Ciénaga terrain bite (so gates stay gates). Max −30 %.
- `SavedPlayer.capaLvl?`. Shows as a bark-brown tint on the player's torso (colour lerp, no new mesh). **[D]** First armour tier with one number, the same shape as `UPGRADE`; Heart balance untouched.

## 7. Swamp corruption

- **4 zones, ids 10–13** in the same list (fixed ids, like S2's 6–9).
  - **10 = Raíz-madre del Pantano** (the sunken tree in the Laguna, r 18). 11–13: a montículo, open bog, and the Nenúfares shore (r 16).
  - Same visuals and night rule (+2 beasts per player standing in one).
- **Cleansing:** a swamp shrine orb cleans the nearest swamp zone; **Fuego at ≤5 m of the zone's withered root** cleans it; beating El Zancudo cleans zone 10.
- **Raids stay at the Heart**; "nearest corrupt zone to the Heart" works over 14 zones.
- **Swamp pressure:** while **zone 10** is uncleansed, the lieutenant rides with raids (§8). That's the swamp's version of "algo sube de la costa". **[D]** One rule, and it gives the lieutenant a clear story off-switch.

## 8. Lieutenant: La Gata Araña

The spec's §2 "named lieutenants lead some raids", introduced here because it's simple: one enemy, one rule.

- **Drawing:** `public/enemies/enemy2.png` (yellow cat head, red eyes, black spider legs). Real alpha verified (62 % transparent pixels, RGBA). Paper cutout like the Tragón.
- **When:** swamp unlocked for this world (anyone has entered `inSwamp`) **and** zone 10 corrupt → **every 3rd raid** (world raid counter `SavedWorld.raidN`) she leads it. Warning line: "La Gata Araña guía el asedio esta noche".
- **Stats:** **300 PV**, walks at wolf speed, bites 12 every 2 s. **Aura:** raiders within 8 m of her move **+20 %** faster. She stays behind her pack (targets the nearest player, not the Heart).
- **Beating her:** the whole remaining raid **flees** (despawns in 3 s, counts as survived); drops **2 ámbar** to each player present. Vision: El Marchito, annoyed ("Mi gata… Ana, esto no queda así").
- After El Zancudo is purified she stops coming (zone 10 clean). Slice 5 can bring her back for the final assault.
- `EnemyKind` gains `'lieut1'`.

## 9. Idea de Claude: Fogatas del Pantano

**Problem:** the third biome is ~90 s from the Heart; the "ride home before dusk" tension turns into commuting. **Idea:** 4 seeded **fogatas** (stone rings) on montículos, dark until lit.

- **Light one:** Fuego at ≤4 m, or a torch from shrine 1's post (works before the dungeon). Lit fogatas are **per world** (`SavedWorld.fogatas: boolean[4]`) and shine through fog to everyone.
- **Travel:** A at a lit fogata → "Volver al Corazón" (5 s channel, cancelled by damage, **daytime only**). At the Heart, the Menú lists lit fogatas → travel there (same rule). Mounts stay where they are (the frog waits at the fogata; call it with A as usual).
- **Why it fits:** kids get quick returns, co-op friends meet each other fast, the dusk tension survives (no travel at night, and the channel can be interrupted), and the next biomes reuse it (one list). **[D]** Server: teleport = one validated position set; no new geometry.

## 10. Swamp dungeon

### 10.1 Access
The swamp's Raíz-madre is a **sunken hollow tree** in the middle of the Laguna Negra (deep water). Reached by **fish, whale or frog-jump from the nearest montículo** (it sits 10 m off one). A on the trunk enters.

### 10.2 Layout
Third entry in `DUNGEONS`: off-map rectangle at **`x = HALF + 450`**, 24 × 180 m. Floor is a function (like the coast's chasm).
1. **Levers** (reused).
2. **Altar: Fuego.**
3. **Thorn gate:** burn it (3 casts).
4. **Dark gas hall:** 3 gas lamps; light all three within 10 s to open (Fuego). Unlit hall uses the S1 dark-room rules (you see 6 m).
5. **Sinking boardwalk:** 30 m of planks over mud; each plank sinks 1.2 s after being stepped on. Falling = respawn at the gate, −10 PV. With 2+ players a **root block** placed on the plate at the start freezes the planks for 8 s (co-op shortcut, not required).
6. **Mini-boss: bruto de turba** (the S1 elite, green-brown tint). **480 PV.** Standing in the arena's mud pools it **regenerates 10 PV/s** unless burning. Fuego (or a hoguera-less fight: pushing it out with a gust, or luring it onto dry floor) stops it. Charge as the reinforced brute.
7. **Boss:** §10.3.

### 10.3 El Zancudo
- **Drawing:** **`public/enemies/enemy9.png`** — the green, long-legged insect with the purple hexagon body. **Unused** (enemy1 Tragón, enemy12 Marchito, enemy3 Antenón; enemy15 has no transparency). **Alpha checked** by reading the PNG: RGBA, 81 % fully transparent pixels, no keying needed. Mostly green + purple → reads as swamp. Placeholder name **"El Zancudo"**.
- **Fight:** **380 PV**, paper cutout hovering 4 m up. Arena 22 × 22 m with **4 gas vents**.
  - **Airborne:** melee can't reach it; arrows do **50 %**.
  - **Drops:** when it hovers over a vent (it drifts between them every ~6 s), **Fuego on that vent** ignites it: El Zancudo falls, **exposed 5 s** (full damage). A parry of its dive also grounds it 3 s.
  - **Attacks:** **dive** (its shadow circles on the floor for 1.0 s, 14 damage, roll to dodge); **picadura** — if it lands a dive it latches on and drains **5 PV/s** until you roll (max 3 s).
  - Resets if the room empties.
- **Purified:** `SavedWorld.purified3 = true`, zone 10 cleaned, vision naming the players present.
- **White Zancudo defender:** hangs a **farol** over the Heart. At night, every **10 s**, each **wolf** within **12 m** of the Heart **flees 3 s** (brutes, elites and the lieutenant ignore it). No HP, can't die. **[D]** The spec's "lanterns that scare night enemies"; doesn't change the Heart's HP or raid size.

## 11. El Marchito in slice 3

- **No invasion.** The spec caps in-person invasions at **3 for the whole game**; the 3rd is reserved for the eve of the final assault (Slice 5).
- **Visions:** on first entering the swamp ("¿Te gusta mi niebla, Ana?"), on burning the Zarzal, on beating La Gata Araña, and on purifying El Zancudo (names players present). Reuse the vision system.

## 12. Names

Add to `NAMES` in `src/shared/names.ts`:

```ts
biomeSwamp: 'el Pantano', swampRoot: 'Raíz-madre del Pantano', swampGate: 'el Zarzal', river: 'la Boca del Río',
bossSwamp: 'El Zancudo', eliteSwamp: 'bruto de turba', lieutenant1: 'La Gata Araña',
powerFire: 'Fuego', frog: 'la Rana', amber: 'ámbar', capa: 'Capa de corteza', fogata: 'fogata',
```

## 13. Out of scope (Slice 3)

- An invasion, a second base, raids reaching the swamp.
- New swamp enemy species beyond the lieutenant and the tinted brute (wolves at night, as on the coast). Poison/status meters.
- Piedra power, mountain terrain, the frog climbing walls. More lieutenants.
- Real volumetric fog, water currents, weather.
- Armour slots beyond one Capa; appearance/cosmetics (#4 later), shops (#6).

## 14. Technical

### 14.1 World extension
- `terrain.ts`: `SWAMP = { x0: -HALF - 180, x1: -HALF, z0: 40, z1: HALF + 150 }` and `swampHeight(x, z)` (bog noise, montículos, Laguna bowl, river channel). `heightAt` picks forest / coast / swamp by region with a 12 m blend at x = −HALF only inside the river mouth and the burnt gap; elsewhere the Zarzal ridge is the seam (so the forest's west rim barely changes).
- `inBounds`/`clampToWorld`: union of 3 rectangles. `inSwamp`. Seeded forest/coast generators keep their bounds helpers; swamp generators live in a new `src/shared/swamp.ts` (montículos, amber trees, fogatas, frog pads, shrines 6–8, zones 10–13).
- `zarzalAt(x, z, burnt)` is the gate function (mirror of `inCienaga`) with the sim check next to the Ciénaga's.
- Dungeons: `DUNGEONS[2]` at `x = HALF + 450`; helpers already take the id.

### 14.2 Protocol and save (22 → 23+, one bump per plan)
All new saved fields optional; old saves load and simply get a swamp.
- **Client:** `power.kind` + `'fuego'`; `tame.beast` + `'frog'`; `act` covers torch/fogata/amber/lily pads (contextual A); `travel {to: 'heart' | fogataId}`; `trap` kind + `'fire'`.
- **Snapshot:** `ride` + `'frog'`; `snap.frog`; `snap.fogatas`, `snap.braziers`; `snap.zarzalBurnt`; `EnemyKind` + `'boss3' | 'elite3' | 'lieut1'`; `burning` flag on enemies.
- **`SavedPlayer`:** `frog?`, `fuego?`, `amber?` (tree timestamps), `capaLvl?`, inventory `amber`.
- **`SavedWorld`:** `purified3?`, `zarzalBurnt?`, `fogatas?`, `raidN?`, `cleansed` over 14 ids.

### 14.3 Performance on phones
- +63 000 m² of terrain (~18 %). Swamp mesh at ×2 cell size (it's flat bog) → fewer triangles than the coast addition. Fog near 35 m lets the swamp use a **shorter camera far plane** inside `inSwamp` (quality tiers: 90 / 120 / 160 m).
- Lily pads, fogatas, braziers, amber: instanced meshes. Lights are emissive materials + at most **2 real point lights** (nearest lit fire), never one per brazier.
- Burning enemies: tint + a shared sprite, no particles on the low tier.

### 14.4 Risks
- **Old worlds:** anything built within ~15 m of the forest's west rim could end up in the Zarzal band. Check with the save importer; if needed, shrink the thorn band to the rim itself.
- **Players stuck in the swamp without a fish** (e.g. a passenger dropped by the whale): the river mouth is deep → they can't swim out. Mitigation: fogatas once lit; before that, "Volver al Corazón" at the Laguna shore by respawn (dying costs little). Consider allowing swim-out downstream (moves that go *toward the sea* in the river are accepted). **[D]** Take the downstream allowance: one line in the water rule.
- **Fire trap + Viento + white defenders** stacking may trivialise wolves at night. Tune after playtests (hoguera needs amber, a limiter).
- **Fog readability** on low-end phones: telegraphs (Zancudo shadow, Gata's aura) must be bright, unfogged materials.
- **enemy2/enemy9** look: enemy9 is thin lines; at 4 m hover it may read small → scale to 6 m wide.

## 15. Plan map (sized like S2 plans)

| Plan | One line |
|---|---|
| **S3-A** Pantano terrain + Zarzal + river + names | Swamp rectangle west (bog, montículos, Laguna, river channel), Zarzal bite/slow gate, 3-rect bounds, downstream swim rule, fog on the client, `names.ts` additions, protocol v23. |
| **S3-B** La Rana | Wild frog, lily-pad chase (3 pads, 6 s) + 3-round ring, riding (cap 12, bog-immune), B high jump, dismount/remount. |
| **S3-C** Shrines + amber + Capa | Shrines 6–8 (Candiles with torches, Nenúfares sinking pads, Turba wall), 6 amber trees, `amber` item, Capa de corteza levels at the Heart. |
| **S3-D** Swamp corruption + La Gata Araña | Zones 10–13 and their cleansing, raid counter, lieutenant (enemy2, aura, pack flees on death, amber drop), vision. |
| **S3-E** Swamp dungeon + Fuego | `DUNGEONS[2]`, 5 gates (thorn, gas lamps, sinking boardwalk), Fuego power + 3-way switching, burning, bruto de turba, hoguera trap. |
| **S3-F** El Zancudo + defender + Zarzal knot | Boss (enemy9, hover, vents, dive/latch), purified3 + zone 10, white Zancudo farol at the Heart, burning the Zarzal knot to open the walking path. |
| **S3-G** Fogatas + visions | 4 fogatas lit by Fuego/torch, day-only 5 s travel to/from the Heart, Menú list, swamp visions. |

Order follows unlocks: frog before shrine 2 and high amber; Fuego before shrine 3, the knot and fogatas-with-fire (torches cover fogatas earlier, so S3-G can move before S3-E if playtests want faster travel sooner).
