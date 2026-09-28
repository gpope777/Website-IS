# Bosque — Aventura Slice 4: las Montañas

> **Decidido por Claude — revisar** (Gabriel no respondió; criterios de la Fase 3 del HANDOFF: lo más simple que respete el spec, co-op que no bloquee al que juega solo salvo cuando es el gancho, no tocar el balance del Corazón, nombres en `names.ts`, dibujos como papel espíritu, rejilla ≤10):
> - **Dónde:** las Montañas se añaden al **norte** del mapa (z < −HALF), a lo ancho del bosque. Es el único lado libre (sur = Costa, oeste = Pantano, este = mazmorras fuera de mapa).
> - **Llave:** **la Rana**. La entrada son **los Peldaños**: una franja de 40 m de escalones de roca lisa de 6 m que no se pueden andar ni trepar; el salto alto de la rana (7 m) los sube.
> - **Amigos sin rana:** tras conseguir la Piedra, alzar la **Escalera del Umbral** (un bloque marcado en los Peldaños) deja una escalera **permanente para todo el mundo**. Mismo patrón que el nudo del Zarzal.
> - **Escalada libre, por fin (en las Montañas):** el terreno de las Montañas sí tiene pendientes de 40–75°. Nueva regla solo dentro de `inMountains`: **>45° no se anda, se trepa** (con aliento). Sigue siendo un heightfield (sin salientes); los peñascos marcados siguen existiendo en todo el mapa.
> - **Poder:** **Piedra**. Alzar un pilar (hasta 3 por jugador): escalón, peso para losas, barricada. Empujar bloques con A.
> - **Frío:** por encima de 30 m de altura el calor baja como de noche (y el doble de noche). Fogatas y hogueras calientan. Reusa `warmth`; no hay medidor nuevo.
> - **Clima (barato):** un clima sembrado por día (`despejado / lluvia / tormenta`) **solo en las Montañas**. Lluvia = roca mojada: no se trepa la roca libre (los peñascos con enredadera sí). Tormenta = el dragón da vueltas a la cumbre.
> - **El dragón SÍ se consigue aquí** (penúltimo bioma, §9 del spec): **el Dragón Marchito**, dibujo `enemy4.png`. Se doma saltando desde el Pico sobre su lomo en plena tormenta + **5 rondas** de anillo (zona mínima, cambia de sentido). Vuelo **simplificado**: techo de 35 m sobre el suelo, B sube / soltar baja, sin combate aéreo. Las Tierras Corruptas quedan cerradas por un muro de niebla hasta el Slice 5.
> - **3 santuarios** (ids 9–11): Cornisa (repisas y pared), Losas gemelas (amigo, pilar o roca), Bloques ("vuelve luego", solo Piedra).
> - **Mazmorra** en `x = HALF + 600` (cuarta de la lista), 5 obstáculos + mini-jefe **bruto de roca** (solo le duele por la espalda o al chocar con un pilar).
> - **Jefe:** `enemy13.png` (cuadrado lila con gorro de cucurucho y antenas; alfa real verificada: 72 % transparente) → **"El Cucurucho"**. Embiste; un pilar en su camino lo tumba 5 s.
> - **Defensor purificado:** el Cucurucho blanco alza una **atalaya** junto al Corazón que de noche tira una piedra cada 6 s (8 de daño) al asaltante más cercano a ≤20 m. No toca PV ni daño del Corazón.
> - **Corrupción:** zonas **14–17** (14 = Raíz-madre de la Montaña, en la boca de la cueva).
> - **Teniente #2:** `enemy7.png` (triángulo negro con dos ojos; alfa verificada: 55 %) → **"El Triángulo"**. Guía los asedios con `raidN % 3 === 1` (nunca coincide con la Gata) mientras la zona 14 esté corrupta. Lanza rocas a **estructuras** (muros/trampas), nunca al Corazón.
> - **Progresión (#4):** nuevo material **cuarzo** (vetas en paredes que solo se alcanzan trepando o en rana) → **arma niveles 4–5** (el siguiente tier del `UPGRADE` de perlas).
> - **Sin Invasión** (la 3ª va antes del asalto final, Slice 5). Sin bestia legendaria aparte: el dragón de la tormenta cumple ese papel.
> - **Idea de Claude:** **Tobogán de nieve**: en nieve con pendiente, B te tira de barriga cuesta abajo a 14 m/s. La bajada de la cumbre al bosque dura ~40 s y es divertida.
> - **Rejilla táctil:** sigue en 10. Piedra es el cuarto poder de la pastilla (🌿→🌬️→🔥→🪨); trepar es contextual; tobogán y vuelo usan B.

**Date:** 2026-09-27
**Status:** Draft, decided autonomously (Fase 3). No code or plans yet.
**Builds on:** `2026-09-26-bosque-aventura-design.md` (§N below refers to it), `2026-09-26-bosque-online-design.md`, the S2 and S3 specs (S3 §N), and the code on `aventura/resto` after Slice 3 (PROTOCOL_VERSION 31, 610 tests).
**Rule:** simplest option that respects the spec. Every choice is marked **[D]** with a one-line reason.

---

## 1. Pillars and goal

1. **Each mount is the key to the next part of the map.** Deer → Costa. Fish → Pantano. **Frog → Montañas** (the Peldaños). **Dragon → Tierras Corruptas** (Slice 5; the dragon is won here).
2. **Vertical biome.** Forest, coast and swamp were flat-ish; the Montañas are the first place where *up* is the goal. Real steep slopes, real climbing, a summit you can see from the Heart.
3. **Expedition biome, same base.** The Heart stays in the forest. **[D]** Same reason as S2/S3. The mountains are the closest new biome (north edge of the forest, ~240 m from spawn) and add 2 fogatas-style **refugios** (§9.2) plus the snow slide home.
4. **Phone first.** 10 pills. New actions through contextual **A**, **B** (mounted, sliding, flying) and the power pill.

**Goal of the slice:** a fourth story cycle of about 3–4 hours: frog up the Peldaños, climb real rock, mine quartz for weapon levels 4–5, 3 shrines, face El Triángulo in a raid, clear the mountain dungeon, gain Piedra, purify El Cucurucho, raise the Escalera for friends, and in a storm leap onto the Dragón Marchito.

## 2. Player-facing loop

```
forest base ──frog──▶ Peldaños ──▶ Faldas (pines, quartz, shrines) ──climb──▶ Cumbre (snow, cold, cave)
     ▲                                                                           │ Piedra, El Cucurucho
     │ snow slide home, refugio → Heart (day only)                               ▼
 night raid (sometimes led by El Triángulo) ◀──── storm day: jump from the Pico onto the dragon ──▶ fly
```

**A 30–40 min phone session (target):**
1. Base report, check the weather line ("Hoy en la montaña: lluvia"), pick a lure: a quartz glint on a cliff, a shrine beam, the summit (0–4 min).
2. Frog north to the Peldaños and up (about 50 s from the Heart). After the first refugio is lit: fast travel, 5 s.
3. Explore (4–28): one shrine, or a climbing route to 2–3 quartz veins, or a corruption root, or the dungeon.
4. Dusk: slide down to the forest (~40 s) or refugio → Heart. Raid.

## 3. World extension: las Montañas

### 3.1 Shape
- The map grows **north**: **`MOUNTAINS = { x0: −HALF, x1: HALF, z0: −HALF − 220, z1: −HALF }`** (480 × 220 m). **[D]** Only free side; touching the whole forest north rim means every player's base is at most ~480 m from it.
- Bounds become a union of 4 rectangles. New `inMountains(x, z)`.

| Band | z (from −HALF going north) | Height | What it is |
|---|---|---|---|
| **Peldaños** (the gate) | 0 … 40 | 4 terraces, each **+6 m** over **1.5 m** run (≈76°) | smooth grey rock; not walkable, not climbable |
| **Faldas** (foothills) | 40 … 120 | +24 … +40, noise | pines, rock, 8–10 **paredes** (steep faces 12–25 m, 50–75°), quartz, shrines |
| **Cumbre** | 120 … 200 | +40 … +80, ridge noise | snow above +55; the **cave** (dungeon) at ~+50; **el Pico** (+80, a flat 12 m top) near x = 0 |
| **Rim** | 200 … 220, and x edges | cliffs to +90 | keeps players in; north of it, in Slice 5, the Tierras Corruptas (a **muro de niebla** for now) |

### 3.2 The frog gate: los Peldaños
- A new rule, **mountains only**: a step whose slope is **> 45°** is refused on foot, on the deer, on the whale's shore… (§3.3). The Peldaños are 76° and flagged `smooth` → **not climbable either**. "Roca lisa. Sin agarre".
- **Frog:** B jumps 7 m up and 9 m forward: one jump per terrace, 4 jumps. Landing on a terrace's flat top (6 m deep) is allowed; the server already caps frog riders at ground + 13.
- **Glider:** the forest rim is ~+4, the first terrace top +6: gliding *up* is impossible, and there are **no crags within 60 m** of the Peldaños (same exclusion as the Zarzal). **[D]** One rule, reused.
- **Escalera del Umbral (after Piedra):** one fixed **Umbral block** (a carved cube) at the foot of the Peldaños, `x = 0`. Piedra at ≤5 m, **3 casts** ("La roca cruje (1/3)") → `SavedWorld.escalera = true`: a 4 m wide band at `|x| < 2` becomes a ramp of 30° **for everyone**, forever. **[D]** Same shape as the Zarzal knot: once anyone has Piedra, walking friends get in.
- Before that, friends without a frog can't enter. **[D]** Acceptable: the frog is personal and every player can tame their own in ~5 min.

### 3.3 Climbing, reconsidered

The S1 spike (Plan D) chose marked surfaces because the terrain had **0 % of slopes over 30°**. The mountains can be built steep on purpose, so free climbing now has something to climb.

- **Technical fact:** the terrain is still `heightAt(x, z)`, a heightfield. It can't have overhangs or truly vertical walls, but with 2 m sampling it can hold **up to ~80°**. That is enough for "cliff faces" that read as walls on a phone camera.
- **Rule (client and server, only where `inMountains`):** `slopeAt(x, z)` = gradient of `heightAt` over 1 m. If a move would go **uphill on a cell steeper than 45°**:
  - on foot: you **grab** (the same climb state as crags) if the cell is **climbable** (not `smooth`, not wet — §8); otherwise the move is refused.
  - riding the frog: refused, except the B jump. The deer: refused ("El ciervo no trepa").
- **Climbing on terrain:** stick up/down = along the slope's gradient, sides = along the contour, at `CLIMB_SPEED` 2.2 m/s. Position stays glued to `heightAt` + 0.4 m, facing the uphill normal. Stamina: the existing 10/s moving, 3/s still. At the top (slope < 35°) you stand up automatically. B jumps off backwards (20).
- **Why free climbing is OK now, and only here:** (1) the client already snaps to `heightAt`, so "climbing a slope" is the same code as walking with a different speed and pose; (2) the server check is height-over-ground, which a slope climber always satisfies; (3) on a phone "push the stick into the wall" needs no button and no normal-guessing (the gradient is exact). **Outside the mountains nothing changes** (old bases, raid paths and the coast/swamp gates stay identical).
- **What stays marked:** `smooth` rock (Peldaños, shrine gates, dungeon walls) and crags (still climbable in rain, their vines give grip).
- **Raiders:** beasts don't enter the mountains (raids come from corrupt zones to the Heart; the mountain zones are ≥40 m past the Peldaños, and a raid from them spawns at the foot of the Peldaños). **[D]** Avoids pathfinding on cliffs.

### 3.4 Cold (altitude)
- Above **y = 30** (terrain height, ~the Faldas' upper half), warmth drains at `RATES.warmthNight` by day and **×2 at night**. Existing rule: warmth 0 → hurt 1 PV/s.
- Warmth comes back near any fire: campfires you build, lit refugios, a hoguera trap, and (new) **2 s of Llamarada** refills 20 warmth to you. **[D]** Uses the `warmth` vital that already exists; no new meter, no new clothes.
- Climbing a 25 m wall from warm takes ~12 s; cold only matters on long summit trips → the refugios matter.

## 4. Power: Piedra

Gained at the mountain dungeon's altar (room 2), same pattern as the other three.

- **Alzar (H / power pill):** a **stone pillar** 2 × 2 m, **3 m tall**, rises in 0.4 s **4 m in front of you** (snapped to a 2 m grid). Cooldown **3 s**. **Max 3 pillars per player**; a 4th removes your oldest. Each lasts **120 s**, or until broken (**80 PV**).
  - **Traversal:** stand on it, climb it (it's a crag: `climbables()` includes live pillars), jump from it. Two pillars side by side + a jump reach a 4 m ledge.
  - **Puzzles:** a pillar **weighs a plate** (any plate: forest dungeon's losa, shrines, the new dungeon).
  - **Defense:** raiders treat it like a wall (they attack it). It's the spec's "instant barricades": free, fast, temporary. **[D]** Temporary + 3 max keeps the Heart's balance where it is.
  - **Enemies:** a pillar raised *under* a beast throws it up 2 m (stun 1 s, 4 damage). A charging enemy that hits a pillar is **stunned 5 s** (bruto de roca, El Cucurucho, the S1 reinforced brute).
- **Empujar (contextual A):** with Piedra owned, A next to a **stone block** (shrine 11, dungeon room 4) pushes it one 2 m cell away from you (0.5 s slide). Without Piedra: "No se mueve".
- **Torre instantánea (defense trap):** a fourth trap in the Menú ("Trampa: … / **torre**"), **needs Piedra**. 6 stone + 2 cuarzo, a 4 m tower, 150 PV. **Standing on it** gives your arrows +50 % range; a raider within 3 m of its base is knocked back 3 m every 4 s. Key **I**. **[D]** The spec's "instant towers"; reuses the trap pill and Menú selector.
- **Switching:** 🌿 → 🌬️ → 🔥 → 🪨 on long-press (J). `power.kind` gains `'piedra'`.

## 5. Mountain content

### 5.1 Shrines: 3 (ids 9–11)
Same rules: beam, gate, orb (+20 max stamina), one clear per player, shared puzzle state. Mountain orbs also give **1 cuarzo**.
1. **Cornisa** (a pared in the Faldas): the orb sits on a ledge 22 m up a face. Route A: climb (2 resting ledges on the way; with base stamina it's 2 legs). Route B: 3 frog jumps between ledges. In rain the face is wet → only the frog route. **[D]** Teaches terrain climbing and weather in one place.
2. **Losas gemelas**: two plates 14 m apart; both pressed opens the gate for 20 s. Holders: a friend, a **Piedra pillar**, or a **loose boulder** uphill that a **Viento gust** rolls onto plate 2. Solo without Piedra = Viento + run. **[D]** "Always solvable solo", co-op is the shortcut.
3. **Bloques** (the cave's neighbour): 3 stone blocks on a 6 × 6 grid must sit on 3 marked cells. Only **Empujar** moves them → "vuelve luego" shrine, like Turba. A reset lever puts them back. Layout: a fixed 8-move solution (handmade, one layout, not seeded).

### 5.2 Quartz (the material)
- **10 quartz veins** seeded on paredes, each **8–20 m up the face** (you must climb, or frog-jump to it). White glint visible from 80 m.
- **A** while climbing next to a vein (≤1.5 m): **2 cuarzo**, regrows after **2 in-game days**, per player (`SavedPlayer.quartz?` timestamps). Mountain orbs +1; El Triángulo +2 to each player present.
- `ItemId` gains `'quartz'` (label from `NAMES.quartz`).

### 5.3 Weapon levels 4–5 (progression #4)
- At the Heart, the weapon upgrade continues: **levels 4 and 5**, cost **3 cuarzo + 10 stone + 5 wood** each, **+15 %** per level (same step). Levels 1–3 still cost pearls. Max +75 %.
- Blade glints white from level 4 (a material swap). **[D]** The next gear tier as one number on an existing table; Heart balance untouched.

## 6. Mountain corruption

- **4 zones, ids 14–17** (fixed, like 6–9 and 10–13).
  - **14 = Raíz-madre de la Montaña** at the cave mouth (r 18). 15–17: a Faldas meadow, a pared foot, a snowfield (r 16).
  - Same visuals and night rule (+2 beasts per player standing in one; in the mountains they spawn at the Peldaños' foot, §3.3).
- **Cleansing:** a mountain orb cleans the nearest 15–17; **Piedra: a pillar raised on the withered root** (≤2 m) crushes it; beating El Cucurucho cleans 14.
- While **zone 14** is corrupt (and `mountainsSeen`), El Triángulo leads raids (§7).

## 7. Lieutenant #2: El Triángulo

- **Drawing:** `public/enemies/enemy7.png` (black triangle frame, two eyes on top, grey scribbles inside, two black feet). **Unused**; real alpha verified by decoding the PNG (RGBA, **55 %** fully transparent). Paper cutout, **2.8 m**. Reads well in snow and at dusk (black).
- **When:** mountains seen **and** zone 14 corrupt → raids with **`raidN % 3 === 1`** (from raid 4 on). Warning: "El Triángulo guía el asedio esta noche". **[D]** The Gata uses multiples of 3; an offset keeps them apart if both are active.
- **Stats:** **340 PV**, wolf speed, kicks 12 every 2 s. **Rock throw:** every **6 s** he throws a boulder at the **nearest player structure** within 25 m (wall, trap, tower, pillar): **40 damage** to it. Never targets the Heart. Stays 12 m behind his pack.
- **Beating him:** rest of the raid flees (as the Gata); **2 cuarzo** to each player within 40 m; vision: «Mis rocas… <nombres>, sube a por mí, a ver».
- Stops once El Cucurucho is purified. `EnemyKind` gains `'lieut2'`.

## 8. Weather (cheap version)

- `weatherAt(seed, day)` → `'clear' | 'rain' | 'storm'`, deterministic (client and server agree, no network). Distribution per in-game day: **60 / 25 / 15 %**, with a guarantee: **at least one storm every 4 days** (day `d` is forced to storm if the previous 3 weren't). **[D]** A pure function, like crags; kids never wait more than ~4 days for the dragon.
- **Only inside `inMountains`** (client: rain/snow particles + darker sky there; everywhere else unchanged). HUD line at dawn at the Heart: "Hoy en la montaña: lluvia".
- **Rain:** terrain rock is **wet** → slopes > 45° can't be grabbed ("Roca mojada. Resbala"). Crags, pillars and ladders still work. Climbing when rain starts: you slide down to the next < 45° cell (no damage).
- **Storm:** as rain, plus the **dragon circles the Pico** (§10). Lightning is cosmetic.
- The spec's "storms summon legendary beasts" = the dragon. **No other legendary beast** in this slice.

## 9. Mountain traversal extras

### 9.1 Idea de Claude: Tobogán de nieve
**Problem:** the summit is ~80 m up and ~200 m from the forest; walking down is dull and gliding needs stamina. **Idea:** belly-slide on snow.
- On **snow** (terrain height > +55, or the snow chute band down the Faldas' centre) with slope **> 15°**, **B while running** → **tobogán**: you slide downhill along the gradient, steer with the stick ±30°, speed ramps to **14 m/s**. Ends when slope < 8° for 1 s, on B, on hitting a tree/rock (stop, no damage) or off snow.
- A seeded **snow chute** (8 m wide, packed snow) runs from the Cumbre down to the Faldas' foot and ends at the Peldaños' **ramp side**, so a slide from the Pico drops you at the Umbral in ~40 s. The Peldaños still stop *upward* travel.
- Server: speed cap for sliders **16** (+1 s grace), only when the start and end cells are snow and downhill. **[D]** One more movement state with the glider's shape; no new pill; very fun on a phone.

### 9.2 Refugios
- **2 refugios** (stone huts with a fire ring): one in the Faldas, one below the cave. They join the **fogatas list** (`FOGATA` ids 4–5): lit by Fuego or torch, travel to/from the Heart by day, and they **warm** (§3.4). **[D]** Reuses S3-G wholesale.

## 10. Mount: el Dragón Marchito

The spec's flying mount: "a corrupted dragon purified in the second-to-last biome" and "jump from a cliff onto its back mid-flight, then several ring rounds; 5 rounds, tiny zone, reverses direction".

- **Drawing:** `public/enemies/enemy4.png` (yellow square head with teeth, big red-pink wings, grey trailing legs). **Unused**; real alpha verified (RGBA, **72 %** transparent). It's the only unused drawing with wings. Paper cutout **8 m** wide, purple tint while corrupt, colours restored when tamed. Placeholder name **"el Dragón Marchito"** (tamed: **"el Dragón"**).
- **When it appears:** on **storm** days, **after El Cucurucho is purified** (`purified4`), it circles the Pico: radius 14 m, **8 m below** the Pico's top, one lap every 10 s. **[D]** Ties the three hooks (boss, weather, summit) into one moment.
- **Taming, part 1 (the leap):** stand on the Pico's edge; when the dragon passes under (a golden ring marks the window, ~1.5 s per lap), **A** → you jump onto it. Server: A accepted if the dragon's position (a pure function of time) is ≤4 m horizontally from you and below you. Miss = you fall → glider (you're 80 m up; no damage if you open it).
- **Taming, part 2:** timing ring **5 rounds**, 3.4 → 5.4 rad/s, zone 0.9 → 0.5 rad, **reverses direction** on rounds 3 and 5. Fail = thrown off → glider. Co-op: a friend on the Pico calms it (×1.5 zone), as always.
- **Personal** (each player tames their copy, like deer/fish/frog). **Carries 2** (you + one passenger via the usual "subir detrás" A). **[D]** Personal = solo-friendly; the passenger seat lets a friend without one reach anything the dragon reaches.
- **Flying (simplified):**
  - Stick steers, speed **15 m/s** (no sprint). **Hold B = climb 4 m/s**, release = descend 2 m/s. No stamina.
  - **Ceiling: ground + 35 m** (and absolute y ≤ 120). Server cap for dragon riders: horizontal **17**, height ≤ ground + 36.
  - Lands automatically when it touches ground/water; A dismounts (only on ground). Call it with A near where you left it.
  - **Can't enter:** dungeons, the Tierras Corruptas' **muro de niebla** (north of the rim: "La niebla te devuelve. Aún no", Slice 5 opens it), and **night flight is allowed but can't land within 30 m of the Heart during a raid** (keeps raids a ground fight).
  - **No aerial combat, no air defense in this slice.** **[D]** Flight as *traversal* is small: a height band over `heightAt`, which the server already validates. Air defense of the base, fire-breathing and the tower belong to Slice 5 where they have a target.
- **Why not skip flight:** without it, Slice 5 would need to add a mount *and* a biome *and* the finale. With the simplified band, the dragon costs about one mount plan (like the whale) and gives the kids the big payoff one slice early.
- `PlayerView.ride` gains `'dragon'`. `SavedPlayer.dragon?`.

## 11. Mountain dungeon

### 11.1 Access
The **cave** in the Cumbre's south face at ~+50 (the Raíz-madre de la Montaña grows out of it: zone 14). Reached by climbing, frog, slide-up… any way up. A at the mouth enters.

### 11.2 Layout
Fourth entry in `DUNGEONS`: off-map rectangle at **`x = HALF + 600`**, 24 × 190 m, cold blue light.
1. **Levers** (reused).
2. **Altar: Piedra.**
3. **High plate:** a plate on a 3 m shelf opens the gate while weighted. Raise a pillar on it (or a friend climbs a crag and stands on it).
4. **Block room:** push 2 blocks into 2 slots (a 5 × 5 grid, fixed 5-move solution). Reset lever.
5. **Rockfall corridor** (no gate, like the sinking boardwalk): 40 m; boulders roll down 3 lanes every 2 s (15 damage, knockback). Raise pillars as shields, or time the gaps.
6. **Mini-boss: bruto de roca** (the S1 elite, grey, a stone slab on its front). **500 PV.** Front hits do **10 %**. It charges (the reinforced brute's charge); if it hits a **pillar** or the arena wall it's **stunned 5 s** with its back exposed (full damage). Parry also works (3 s).
7. **Boss:** §11.3.

### 11.3 El Cucurucho
- **Drawing:** **`public/enemies/enemy13.png`**: lilac square body, cream cone hat, two long antennae, two little fangs, two legs. **Unused** (used: enemy1 Tragón, enemy12 Marchito, enemy3 Antenón, enemy9 Zancudo, enemy2 Gata; enemy15 has no transparency). **Alpha checked** by decoding the PNG: RGBA, **72 %** fully transparent. The cone reads as a snowy peak. Placeholder name **"El Cucurucho"**.
- **Fight:** **420 PV**, 5 m tall cutout on the ground, arena 24 × 30 m.
  - **Hat = armour:** from the front, hits do **25 %**.
  - **Embestida:** it lowers the cone (1.0 s telegraph: the hat glows red), then charges in a straight line at 14 m/s: 25 damage. A **pillar in its path** → it rams it: **stunned 5 s**, hat stuck, full damage. Rolling dodges.
  - **Alud:** every 15 s it stamps; 4 boulders fall on marked circles (1.0 s shadows, 15 damage). Pillars under a shadow block that boulder.
  - Balance target: ~35 s to lose 100 PV standing next to it.
  - Resets if the room empties.
- **Purified:** `SavedWorld.purified4 = true`, zone 14 cleaned (El Triángulo stops), vision naming the players present, and from then on storms bring the dragon.
- **White Cucurucho defender: la atalaya.** A 5 m stone tower 6 m from the Heart. At night, **every 6 s**, it throws a stone at the nearest raider within **20 m**: **8 damage**. Can't die, no PV. **[D]** Adds a small defender like the others; the Heart's PV and raid size are untouched.

## 12. El Marchito in slice 4

- **No invasion** (3 in the whole game; the 3rd is Slice 5).
- **Visions:** first entering the mountains («Qué alto, <nombre>. Qué frío»), on raising the Escalera, on beating El Triángulo, on purifying El Cucurucho, and on taming the dragon («Mi dragón… Eso sí que no, <nombre>»). Reuse the vision system.

## 13. Names

Add to `NAMES` in `src/shared/names.ts`:

```ts
biomeMountains: 'las Montañas', mountainRoot: 'Raíz-madre de la Montaña', mountainGate: 'los Peldaños', stairs: 'la Escalera del Umbral',
peak: 'el Pico', bossMountain: 'El Cucurucho', eliteMountain: 'bruto de roca', lieutenant2: 'El Triángulo',
powerStone: 'Piedra', dragon: 'el Dragón', dragonWild: 'el Dragón Marchito', quartz: 'cuarzo', refugio: 'refugio', tower: 'torre',
```

(`ITEM_LABELS.stone` is also "Piedra": the power name comes from `NAMES.powerStone`, the item label stays as is. The names test forbids hand-writing "Montañas", "Peldaños", "Cucurucho".)

## 14. Out of scope (Slice 4)

- An invasion; raids reaching the mountains; beasts pathing on cliffs.
- Aerial combat, dragon fire, air defense of the base, the tower, the Tierras Corruptas (Slice 5).
- Other legendary beasts, full-moon beasts, weather outside the mountains, snowstorms that blind.
- Overhangs, caves as terrain (the cave is a doorway), climbing outside the mountains' slope rule.
- New armour (Capa stays the only one), clothes against cold, cooking, NPCs, compendium, shops.
- Seeded block puzzles (both are handmade).

## 15. Technical

### 15.1 World extension
- `terrain.ts`: `MOUNTAINS = { x0: −HALF, x1: HALF, z0: −HALF − 220, z1: −HALF }` and `mountainHeight(x, z)`: Peldaños terraces (a step function in `d = −HALF − z`, smoothed over 1.5 m), Faldas noise + seeded **paredes** (ridged bumps with slope 50–75°), Cumbre ridge, the Pico disc, the snow chute (a smooth valley), rim. 12 m blend at z = −HALF only through the Peldaños' first metre; elsewhere the forest's north rim is the seam.
- New `slopeAt(x, z)` (finite difference) and `smoothAt(x, z)` (Peldaños, shrine gates) in `src/shared/mountains.ts`, plus generators: paredes, quartz veins, shrines 9–11, zones 14–17, refugios, the Umbral block, the Pico, `weatherAt`, `dragonPos(t)`.
- **Movement rule** (`steepBlocked(from, to)`) called by client movement and by the server's `clampStep` **only when `inMountains`**, next to `zarzalAt`/`inCienaga`.
- Crag generator excludes 60 m around the Peldaños.
- Dungeons: `DUNGEONS[3]` at `x = HALF + 600`.
- Enemy ids: next free after the S3 ones (check the unique-ids test, which includes the Gata): **boss4, elite4, lieut2, dragon** (the wild dragon is an actor, not an enemy; it gets an id so the client can draw it). Pillars and blocks use a new 920_000+ range; rescue anchors stay 910_000+.

### 15.2 Altitude and cold
- `survival.ts`: `stepVitals` gains an `altitudeCold` flag (y > 30 and `inMountains`). Rates: `warmthNight` by day, ×2 at night. `nearFire` includes lit refugios and live Llamarada (2 s).
- Server computes the flag from the player's position; client mirrors it for the HUD only.

### 15.3 Protocol and save (31 → 32+, one bump per plan)
All new saved fields optional; old saves load and simply get mountains.
- **Client:** `power.kind` + `'piedra'`; `tame.beast` + `'dragon'`; `act` covers push/quartz/umbral/leap (contextual A); `slide` and `fly` flags on `move`; `trap` kind + `'tower'`; `travel.to` 4–5.
- **Snapshot:** `ride` + `'dragon'`, `'slide'` anim; `snap.pillars` (id, x, z, owner, hp); `snap.blocks`; `snap.escalera`; `snap.weather` (redundant with the seed but cheap: one byte); `EnemyKind` + `'boss4' | 'elite4' | 'lieut2'`; `snap.dragon` (wild or tamed positions).
- **`SavedPlayer`:** `piedra?`, `dragon?`, `quartz?` (vein timestamps), `upgrade` 4–5, inventory `quartz`.
- **`SavedWorld`:** `purified4?`, `escalera?`, `mountainsSeen?`, `fogatas` over 6, `cleansed` over 18 ids.

### 15.4 Performance on phones
- +105 600 m² of terrain (~+25 %). Mountains mesh at **×2 cell size** in the Faldas/Cumbre but **×1 in the Peldaños and paredes** (a steep face at 6 m cells would read as a ramp). Estimate low tier: +2 600 vertices (+8 %).
- The mountains are **visible from the forest** (that's the point), so the far plane can't drop like the swamp's. Instead: a **low-poly silhouette** (64 × 16 cells) is drawn beyond 160 m; the detailed mesh only within 160 m.
- Pines: instanced (one draw call); snow is vertex colour, not a texture. Rain/snow particles: 300 on high, 80 on low, off on the lowest tier; only inside the mountains.
- Pillars: instanced boxes, cap 3 × players ≤ 24. The dragon: one textured quad pair.

### 15.5 Risks
- **Old worlds:** anything built in the forest's northern 15 m might meet the Peldaños seam. Check with the save importer; the Peldaños start at z = −HALF exactly, so structures inside the forest stay put.
- **Steep-slope rule edge cases:** a player standing on a 46° cell after respawn or a teleport must not get stuck: the rule blocks only **uphill** moves, downhill is always accepted. Server tests for the Peldaños seam, the escalera band and the chute.
- **Client/server disagreement on `slopeAt`** near the 45° threshold → rubber-banding. Use the same function and a server tolerance of 50°.
- **Flight exploits:** a dragon rider could hover over a raid. Mitigation: no landing within 30 m of the Heart during raids; beasts ignore riders more than 6 m up (they target the Heart or ground players). Review after playtests.
- **Pillar spam as walls** could trivialise raids. Limits: 3 per player, 120 s, 80 PV; tune after playtests.
- **Weather + climbing** may frustrate: a kid arrives on a rain day and can't climb. Mitigation: the dawn weather line, crags and pillars still climbable, and the Cornisa has the frog route.
- **enemy4 as a dragon:** it reads as a winged creature, but the nephew may want to draw his own dragon (§9 "the nephew can draw his own mounts"). The cutout is a swap of one PNG.

## 16. Plan map (sized like S3 plans)

| Plan | One line |
|---|---|
| **S4-A** Montañas terrain + Peldaños + steep rule + names | Mountains rectangle north (Peldaños, Faldas, paredes, Cumbre, Pico, chute), 4-rect bounds, `slopeAt`/`smoothAt`, steep-uphill rule client + server, crag exclusion, silhouette mesh, `names.ts`, protocol v32. |
| **S4-B** Climbing on terrain + cold + weather | Grab/climb any >45° non-smooth mountain cell with stamina, `altitudeCold` in survival, `weatherAt` (rain = wet rock), rain/snow particles, dawn weather line. |
| **S4-C** Shrines + quartz + weapon 4–5 + refugios | Shrines 9–11 (Cornisa, Losas gemelas with boulder + Viento, Bloques shell "vuelve luego"), 10 quartz veins, `quartz` item, upgrade levels 4–5, refugios as fogatas 4–5. |
| **S4-D** Mountain corruption + El Triángulo | Zones 14–17 and their cleansing, `mountainsSeen`, lieutenant 2 (enemy7, rock throw at structures, raidN % 3 === 1), vision. |
| **S4-E** Mountain dungeon + Piedra | `DUNGEONS[3]`, Piedra (pillars, push, plates, stun on charge), 4-way power switch, high plate, block room, rockfall corridor, bruto de roca, torre trap, Bloques shrine solvable, pillar on roots cleanses. |
| **S4-F** El Cucurucho + atalaya + Escalera | Boss (enemy13, hat armour, charge into pillars, alud), purified4 + zone 14, atalaya defender, Umbral block → permanent Escalera for everyone. |
| **S4-G** El Dragón | Storm-only circling (after purified4), Pico leap, 5-round reversing ring, personal + 1 passenger, simplified flight band, fog wall north, dragon visions. |
| **S4-H** Tobogán de nieve + mountain visions | Snow slide state (client + server cap 16), the chute ending at the Umbral, remaining visions (entry, Escalera). |

Order follows unlocks: frog already exists → terrain first; climbing before quartz and the Cornisa; Piedra before Bloques, the Escalera and the Cucurucho; the dragon last (needs purified4 and storms). S4-H is independent and can move right after S4-B if playtests want the fun early.
