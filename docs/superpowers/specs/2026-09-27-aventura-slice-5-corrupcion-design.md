# Bosque — Aventura Slice 5: las Tierras Corruptas (final)

> **Decidido por Claude — revisar** (Gabriel no respondió; criterios de la Fase 3 del HANDOFF: lo más simple que respete el spec, co-op que no bloquee al que juega solo salvo cuando es el gancho, no tocar el balance del Corazón salvo donde el final lo pide, nombres en `names.ts`, dibujos como papel espíritu, rejilla ≤10):
> - **Dónde:** las Tierras Corruptas se añaden **al norte de las Montañas** (z < −HALF − 220), a lo ancho del mapa, 480 × 200 m. El muro de niebla del S4-G se mueve a su borde norte (sigue siendo el fin del mundo).
> - **Llave:** **el Dragón**. El borde de las Montañas (acantilados de +90) y la niebla solo se cruzan volando. La niebla **se aparta** la primera vez que un jinete de dragón la toca **con las 4 Raíces-madre purificadas**; si falta alguna, dice cuál. **Amigos sin dragón:** van de pasajero; tras el final, una **Grieta** abierta en el borde deja entrar andando.
> - **La torre de El Marchito, visible desde todo el mapa:** una sola malla de silueta (un cono torcido negro-morado) dibujada **sin niebla y más allá del plano lejano** en una capa de "cielo". Crece **+1 m por día de juego** (60 → 140 m). Coste: 1 draw call.
> - **Sin poder nuevo.** El final es un examen de los 4 (🌿🌬️🔥🪨): la torre está protegida por **4 Pilares-raíz**, uno por poder, en el mundo abierto.
> - **Invasión 3:** al romper el 4.º Pilar-raíz, en el siguiente atardecer. El Marchito va **por primera vez a por el Corazón** (canaliza sobre él) con un asedio grande del norte y **rayos marchitos voladores** (`enemy11`). **Aquí entra la defensa aérea del dragón** (la forma más simple: el dragón pega en vuelo; los dragones aparcados junto al Corazón muerden a los voladores). Pase lo que pase, al amanecer la puerta de la torre se abre.
> - **Único toque al Corazón:** si la Invasión 3 no echa al Marchito en 90 s, el Corazón **baja a 1 PV** (no se marchita). **[D]** Es el único momento en que el villano amenaza lo que quiere; un susto sin castigo.
> - **Teniente #3 (el último):** `enemy10.png` (flecha negra con aureola naranja; alfa verificada 75 %) → **"La Flecha"**. Guía asedios con `raidN % 3 === 2` y es el mini-jefe de la torre.
> - **Torre** = la quinta mazmorra instanciada en `x = HALF + 750`: 4 pisos (uno por poder, con un aliado purificado que ayuda en cada uno), La Flecha, y la **Copa** con El Marchito.
> - **Jefe final: El Marchito**, por fin con vida. **3 fases**: raíces (Fuego las quema), 4 brotes que piden los 4 poderes, y su **Corazón Negro** (`enemy8.png`, alfa 61 %) que huye por la arena. PV ×(1 + 0,35·(jugadores − 1)). Solo se puede; con amigos es más corto.
> - **Final:** visión larga + créditos en tarjeta con los nombres de quienes estaban; la torre se vuelve blanca; **todas las zonas limpias**; El Marchito purificado vuelve a ser **el Guardián** (`enemy6.png`, alfa 64 %). **Los asedios paran** por defecto; un interruptor "Noches de desafío" los devuelve.
> - **Post-juego pequeño:** una bestia legendaria, **la Estrella** (`enemy14.png`, alfa 65 %) en luna llena, y el Corazón sigue creciendo con las visitas. Nada más.
> - **Progresión (#4):** último material **espina negra** (bestias de las Tierras) → **arma nivel 6** (+90 % total) y **Capa nivel 4**. Tope final.
> - **Idea de Claude:** **El Árbol-torre**: tras el final, la torre blanca se vuelve un mirador: A en su base te sube a la cima (fogata 6) y desde ahí planeas sobre todo el mapa. Lo que era miedo en el horizonte pasa a ser casa.
> - **Rejilla táctil:** sigue en 10. Pegar desde el dragón = la pastilla de ataque; todo lo demás, A contextual y la pastilla de poder.

**Date:** 2026-09-27
**Status:** Draft, decided autonomously (Fase 3). No code or plans yet.
**Builds on:** `2026-09-26-bosque-aventura-design.md` (§N below refers to it), `2026-09-26-bosque-online-design.md`, the S2/S3/S4 specs (S4 §N), and the code on `aventura/resto` after Slice 4 (PROTOCOL_VERSION 43, 789 tests).
**Rule:** simplest option that respects the spec. Every choice is marked **[D]** with a one-line reason.

---

## 1. Pillars and goal

1. **The last key.** Deer → Costa, fish → Pantano, frog → Montañas, **dragon → Tierras Corruptas**. The dragon's big moment is crossing the rim.
2. **An exam, not a new subject.** No new power, no new mount to tame for the story. Every piece of the finale asks for something the players already own: 4 powers, 4 mounts, 4 purified allies. **[D]** A final slice that adds systems ships late; one that combines them ships and feels like a payoff.
3. **The villain finally loses.** Invasion 3 → tower → El Marchito with real HP → an ending with credits and a changed world.
4. **After the end, still a home.** Raids optional, the world clean, one legendary beast, the tower as a lookout. Small on purpose.
5. **Phone first.** 10 pills, 1 extra draw call for the horizon tower, low-tier flier cap.

**Goal of the slice:** a last story cycle of about 3–4 hours: open the fog with the dragon, break the 4 Pilares-raíz with the 4 powers, face La Flecha in raids, survive Invasion 3 at the Heart, climb the tower with the purified allies, beat El Marchito in 3 phases, watch the ending, and find the Estrella under a full moon.

## 2. Player-facing loop

```
forest base ──dragon──▶ rim + fog ──▶ Tierras Corruptas (ash, thorns, 4 Pilares-raíz)
     ▲                                         │ 🌿 🌬️ 🔥 🪨  (one pillar each)
     │ fogata 6 "la Ceniza" → Heart (day)      ▼
 night raids (La Flecha) ◀── 4th pillar ──▶ Invasión 3 at the Heart (dusk) ──▶ dawn: tower door opens
                                                                                  ▼
                                   4 floors + La Flecha + la Copa: El Marchito ──▶ ending ──▶ post-game
```

**A 30–40 min phone session (target):**
1. Base report; the tower on the horizon is a little taller than yesterday. Pick a lure: a pillar's glow, a black lake, the tower (0–3 min).
2. Dragon north, over the Pico and the rim (~60 s). After la Ceniza fogata is lit: 5 s by day.
3. One Pilar-raíz (8–12 min each, §5), or thorn-hunting for espinas (§7), or the tower (35–45 min, co-op evening).
4. Dusk: back home. Raid.

## 3. World extension: las Tierras Corruptas

### 3.1 Shape
- **`CORRUPT_LANDS = { x0: −HALF, x1: HALF, z0: −HALF − 420, z1: −HALF − 220 }`** (480 × 200 m), north of `MOUNTAINS`. **[D]** The only free side left; keeps the map a stack of rectangles (bounds = union of 5).
- New `inCorrupt(x, z)` and `corruptHeight(x, z)`.

| Band | d = (−HALF − 220) − z | Height | What it is |
|---|---|---|---|
| **Borde** (the mountains' rim, north face) | 0 … 20 | +90 → +20 | cliffs, `smooth`: not climbable. Only flying crosses it. After the ending: **la Grieta**, a 6 m gap at `x = 0` sloped at 30° |
| **la Ceniza** | 20 … 80 | +15 … +25, gentle noise | grey ash plain, dead trees, the landing zone, fogata 6 |
| **Espinar** | 80 … 170 | +10 … +40 | thorn thickets (the Zarzal rule reused: 10 PV/s), the **Lago Negro** (west), the **Escalones rotos** (east), the 4 Pilares-raíz |
| **la Torre** | 170 … 200, `|x| < 30` | +30 plateau | the tower foot, the door (dungeon entrance); zone 18 |

- **The fog wall** moves from `z = −HALF − 200` (S4-G) to the north edge `z = −HALF − 420`. The old wall stays in place, **only as a gate** (§3.2).
- **Raiders never path here** (like the mountains): a raid "from" a corrupt zone up here spawns at the forest's north rim (the Umbral side). **[D]** No pathfinding over a 90 m cliff.

### 3.2 The dragon gate
- The rim is `smooth` and +90: walking, frog and glider can't cross (glider can't gain height; no crags within 60 m, the S4 rule).
- **Fog at `z = −HALF − 200`:** a flying rider touching it:
  - if `purified && purified2 && purified3 && purified4` → **`SavedWorld.fogOpen = true`**, the plane fades for everyone, vision «Ya vienes. Bien. Te espero arriba, <nombre>.».
  - else: "La niebla aguanta. Falta la Raíz-madre de <bioma>" (the first missing, from `NAMES`). **[D]** One check, no quest log.
- Before `fogOpen`, the S4 text stays. After, flying is allowed up to the new north fog.
- **Friends without a dragon:** passenger seat (exists). Each player can still tame their own in a storm. After the ending **la Grieta** opens for walkers (§10). **[D]** Same pattern as the Escalera and the Zarzal knot, but at the end: the finale *is* about flying in.

### 3.3 The horizon tower (base spec §2: "visible from the whole map, growing")
- Position: `(0, −HALF − 400)`. Real mesh: a twisted cone of 12 segments, base r 14 m, dark purple, violet emissive tip.
- **Visible from everywhere, cheaply:** a second copy, the **silhouette**, lives in a "sky" pass: rendered first, `depthWrite: false`, `fog: false`, placed each frame at a fixed 900 m along the real direction to the tower, scaled so its angular size matches. So it sits on the horizon behind the mountains from the Heart, the coast and the swamp, and never needs the far plane moved. When the player is within 300 m, the sky copy hides and the real mesh shows.
- **Growth:** height `60 + min(80, day − firstDay)` m where `firstDay` = the world's first day with a Heart (`SavedWorld.towerDay0?`, set once). **[D]** "Growing over time" as one pure function; the sky copy scales with it.
- **Cracks:** each broken Pilar-raíz (§5) lights one violet crack dark. After the ending the tower turns white (material swap) and the tip grows leaves (§10).
- Performance: 1 draw call (sky copy), 1 more within 300 m.

## 4. Mounts in the finale (each has one job)

| Mount | Job in Slice 5 |
|---|---|
| **Dragon** | Crosses the rim and fog; air defense in Invasion 3 (§8.3); reaches the Escalones rotos' top ledge |
| **Frog** | The Escalones rotos: 4 smooth 6 m steps to the Pilar de Piedra (the Peldaños rule, reused) |
| **Fish** | The Lago Negro: dive to the Pilar de Viento's chain (8 m down, the fish's dive) |
| **Deer** | The **Carrera de ceniza** to the Pilar de Fuego: a 120 m ash strip that hurts 4 PV/s on foot, 0 on a mount; the deer is the only land mount that can be brought up (a dragon passenger can't carry a deer, so the deer **is called** at la Ceniza fogata: A → "Silbar al ciervo") |
| **Whale** | none. **[D]** One per world, slow, can't fly in; forcing it would be a bad trick |

- Mounts flying in: only the dragon. The fish and frog are **called at la Ceniza fogata**, like the deer (they appear parked there after your first call). **[D]** Otherwise nobody could bring them; "calling" is a teleport of your own parked mount, one rule for three animals.

## 5. The 4 Pilares-raíz (the tower's shields)

Each is a 12 m black root spike wrapped around a violet core, one per power, placed by the seed in its sub-area of the Espinar. **Open-world**, shared state, one-time per world (`SavedWorld.pillars?: number[]`, ids 0–3). A broken pillar cleans its corruption zone (§6) and darkens a tower crack. **All 4 broken** → the tower's barrier drops and **Invasion 3 is armed** (§8).

1. **Pilar de Enredadera (thorns):** the core sits in a Zarzal-style thicket 30 m wide. Cast Enredadera on **3 bare roots** around it (each makes a 2 m root bridge over the thorns, S1 bridge code) to reach the core; then A on the core (hold 3 s). Co-op: two friends can cast from two sides; solo just walks the bridges.
2. **Pilar de Viento (lake):** in the **Lago Negro** (r 40, 10 m deep); a chain runs from the core down to an anchor at the bottom. Dive with the fish, break the anchor (150 PV, like S2-H anchors, a Viento gust ×3), surface: the core lies on its side on the shore; **3 Viento gusts** blow the miasma cloud off it, then A. Reuses `rescue.ts` anchor logic.
3. **Pilar de Fuego (ash):** at the end of the **Carrera de ceniza** (deer). The core is inside a thorn **cocoon** (the swamp's Zarzal knot, re-skinned): Llamarada 3 s → it burns. Guards: 3 rayos marchitos (§7.2).
4. **Pilar de Piedra (steps):** on top of the **Escalones rotos** (4 terraces of 6 m, `smooth`: frog or dragon). The core is under a **plate lid**: raise a Piedra pillar on the plate (2 m away) to lift it, or a friend stands on the plate. Then A.

Rules shared by all four:
- Core: A held 3 s within 2 m → broken. Break message: "El Pilar-raíz de <poder> se parte (2/4)".
- Every break: vision «Eso me dolió, <nombres>» (varies per pillar).
- **[D]** One pillar per power is the most literal reading of "the final assault uses everything", and each is a small handmade setpiece (like shrines) instead of a new system.

## 6. Corruption of the Tierras

- **4 zones, ids 18–21** (fixed): **18 = la Torre** (tower foot, r 30), 19–21 around three of the Pilares (r 18). Standard visuals and night rule.
- **Cleansing:** 19–21 when their pillar breaks (the fourth pillar, Piedra, sits in zone 18's shadow and doesn't have a zone of its own); **18** only when El Marchito falls.
- **`SavedWorld.corruptSeen?`:** set when anyone first enters `inCorrupt`. Vision «Mi casa. Limpien los pies, <nombre>.» once per world.
- While zone 18 is corrupt and `corruptSeen`: **La Flecha** leads raids (§9).
- **The ending cleans everything:** all remaining zones in every biome, 0–21 (§10).

## 7. Tierras content

### 7.1 Fogata 6: la Ceniza
A stone ring on the ash plain (fogatas list, id 6), lit by Fuego or torch. Heart ↔ fogata by day (S3-G). Here A also **calls** your deer, fish (to the Lago's shore) or frog (§4).

### 7.2 Rayos marchitos (the flying enemy)
- **Drawing:** `public/enemies/enemy11.png` (yellow lightning bolt with two eyes and two veined wings). **Unused**; real alpha verified by decoding the PNG (RGBA 460 × 485, **72 %** fully transparent). Paper cutout 2 m, purple tint.
- A common enemy kind (`EnemyKind` `'rayo'`), not unique: normal wolf ids. **60 PV**, flies at ground + 6 m, 9 m/s. Every 3 s it dives at the nearest player within 20 m (0.8 s telegraph: flashes white), 10 damage, then climbs back. **Arrows** are the ground answer (soft auto-aim already targets it; 2 hits at weapon 5). A **Viento gust** knocks it to the ground for 3 s (sword hits work).
- **Where:** 2–4 over the Espinar by day (respawn each dawn, cap 8 alive); 3 guard the Pilar de Fuego; **Invasion 3 brings flocks** (§8).
- Drop: 1 **espina negra** (§7.4) 50 %.

### 7.3 Ash beasts
Wolves and brutes up here are the usual kinds with an ash tint; they drop **1 espina negra** each (100 %). Day spawns: 6 in the Espinar.

### 7.4 Final gear tier (progression #4)
- New item **espina negra** (`ItemId` `'thorn'`, label from `NAMES.thorn`).
- At the Heart: **weapon level 6**: 6 espinas + 3 cuarzo + 10 stone → **+15 %** (total +90 %, the cap). Blade turns black-and-white.
- **Capa de corteza level 4**: 4 espinas + 2 ámbar → another −10 % damage taken (same step as S3).
- **[D]** One more row on each existing upgrade table; no new stat, no armour set. Heart untouched. Anything bigger (skills, looks) belongs to roadmap #4.

## 8. Invasión 3 (base spec §2: "right before the final assault")

### 8.1 Trigger
- When the 4th Pilar-raíz breaks: `SavedWorld.invasion3 = 'pending'`. Vision «Ah. Ahora voy yo.».
- At the next **dusk warning** with a live Heart and someone outside dungeons → it starts. Same freezing/resume rules as S2-H: saving mid-invasion leaves 'pending'.

### 8.2 What he does
- **El Marchito** (`enemy12`, 7 m, will bar) walks in from the **north** (the tower's side, 28 m out) with the night's raid **×1.5** plus **6 rayos marchitos**. Warning: "El Marchito viene a por el Corazón".
- For the first time he goes **at the Heart itself**: reaches it and **channels 90 s** (bar "El Marchito envuelve el Corazón · 40 %"). He swipes 14 at anyone within 3 m, as before.
- **Driving him off:** will to 0 (the S1 formula 300/420/540/660 by players, **×1.3**: 390…858). Result: he leaves, the Heart is untouched. «Mañana, en mi casa. Traigan a sus bichos blancos.»
- **Not driven off:** at 100 % the Heart **drops to 1 PV** (never withers), he laughs and leaves. Same vision, meaner.
- **Either way:** the raid carries on to dawn; at dawn `invasion3 = 'done'` and the **tower door opens** (`SavedWorld.towerOpen`). **[D]** The finale must never be locked behind winning a defense; losing costs a scare and a repair.
- **Heart balance:** the 1 PV drop is the only Heart rule in this slice. **[D]** Justified: the villain's last invasion should threaten the thing he wants; not withering keeps it from punishing a kid who played solo.

### 8.3 Air defense (base spec §9: "air defense of the base") — simplest form
- **Riding the dragon, the attack pill = "zarpazo":** hits a rayo within 5 m (3D) for **40** (kills in 2), cooldown 1 s. Also works on the rayos over the Espinar. Nothing else can be hit from the air (no fire breath, no ground attacks). **[D]** One contextual action on an existing pill.
- **Parked dragons guard the sky:** each tamed dragon parked within 30 m of the Heart at night bites the nearest **rayo** within 12 m every 3 s (40). They never touch ground beasts or El Marchito. **[D]** Uses the parked dragons that already exist; "air defense of the base" for players who aren't flying.
- The S4 rule stays: no landing within 30 m of the Heart during a raid.
- Rayos in raids: they target players and **structures** (10 to a wall/trap per dive), never the Heart. **[D]** Heart balance unchanged.

## 9. Lieutenant #3: La Flecha

- **Drawing:** `public/enemies/enemy10.png` (a black arrow pointing down, orange halo on top, an orange face in its point, four thin black legs). **Unused**; real alpha verified (RGBA 463 × 437, **75 %** transparent). Paper cutout **3 m**. Reads from far away (black on ash, arrow shape).
- **Raids:** while `corruptSeen` and zone 18 is corrupt, raids with **`raidN % 3 === 2`** (Gata = 0, Triángulo = 1; all three can coexist). Warning: "La Flecha guía el asedio esta noche".
- **Stats:** **360 PV**, wolf speed, kicks 12 / 2 s. **Clavada:** every **7 s** it picks the nearest player within 20 m, draws a red line on the ground for **1.0 s**, then dashes along it at 20 m/s: **20 damage**. If the line crosses a wall, pillar or tower it **sticks** in it for **4 s** (full damage, can't act). Roll dodges.
- **Beating it in a raid:** raid flees; **2 espinas** to each player within 40 m; vision «Mi flecha… Suban, <nombres>. Arriba se acaba.». It comes back next time (as the Gata) until zone 18 is clean.
- **In the tower** it is the mini-boss (§11.2, floor 5), same rules plus 1.3× PV. `EnemyKind` gains `'lieut3'`.

## 10. The ending

### 10.1 On El Marchito's defeat (in the Copa)
1. Everyone in the tower gets a **long vision** (4 cards, each 5 s, skippable): the Marchito shrinks, the Corazón Negro cracks, «Yo también era un bosque… <nombres>». Then the purified form appears: **el Guardián** (`enemy6.png`, a brown pentagon with a leaf crown and a smile; alfa 64 %).
2. **Credits card:** scrolling, 25 s, skippable: "Bosque" · the names of the players present at the kill · "Dibujos: el sobrino" (from `NAMES.credits`, placeholder) · "Hecho por Gabriel". Shown once per player (`SavedPlayer.credits?`), and to anyone who wasn't there **the first time they log in after** ("Mientras dormías, <nombres> vencieron a El Marchito").
3. Everyone is placed back at the Heart.

### 10.2 World state after (`SavedWorld.ending = true`)
- **All corruption zones** (0–21) clean; root-mothers become white stumps; the Tierras' ash tint lightens to grey-green (vertex colour lerp, no new mesh).
- **The tower turns white** with leaves on the tip (material swap) → the **Árbol-torre** (§12).
- **Raids stop** by default. At the Heart's Menú: **"Noches de desafío: apagadas / encendidas"** (world setting, anyone at the Heart can flip it). On: raids as before but with a random lieutenant (Gata/Triángulo/Flecha) every 3rd night and ×1.2 drops. **[D]** The spec's point is to *win*; kids who want the fight turn it on. Structures stay useful for the toggle.
- **La Grieta** opens in the rim: walkers enter the Tierras.
- **El Guardián** stands 8 m east of the Heart (paper, 3 m). A near it: one of 6 lines about the world (hints for the post-game). No combat role.
- The white allies stay; at night with raids off they just idle.
- **Invasions:** none ever again.

## 11. The tower (fifth dungeon)

### 11.1 Access
The **door** at the tower foot (zone 18). Before `towerOpen`: "Una raíz cierra la puerta. Rompan los Pilares" / "…Él vendrá antes" (after the 4th pillar). A enters.

### 11.2 Layout
Fifth entry in `DUNGEONS`: off-map rectangle at **`x = HALF + 750`**, 24 × 230 m, violet light. Floors are rooms along the corridor with a short stair between (the view: going up). Each floor is **a power + a purified ally** as a helper (the white ally's paper appears in the room and does its thing there).

1. **Floor 1 — Enredadera + Tragón:** a thorn pit; 2 root bridges. The white Tragón bites any beast within 4 m of you (reuses `ally.ts` with the room as anchor).
2. **Floor 2 — Viento + Antenón:** 3 miasma vents close the gate; a gust into each clears it for 15 s; all three clear = gate opens. The white Antenón gusts beasts off the ledge.
3. **Floor 3 — Fuego + Zancudo:** a dark room with 4 braziers (light them all, torch or Llamarada); the white Zancudo's farol lights your path.
4. **Floor 4 — Piedra + Cucurucho:** a plate on a shelf + a rockfall lane (S4 reuse); the white Cucurucho throws stones at the beasts.
5. **La Flecha** (360 × 1.3 = **470 PV**), arena 24 × 24 with 4 stone columns (it sticks in them).
6. **Stair to the Copa** (a save point: dying after here respawns you at the stair, not the Heart). **[D]** A 45-minute dungeon shouldn't be replayed on one death; this is the one place in the game with a checkpoint.
7. **La Copa:** §11.3.

- **Solo:** each floor's puzzle is solvable alone (like every S2–S4 room). The ally helps; nothing needs a friend.
- Allies only appear if that boss was purified (all four are, since pillars need all four root-mothers). **[D]** "Purified allies in the final assault" in the simplest form: the existing defenders do their night move in a room.

### 11.3 Final boss: El Marchito
- **Drawing:** `enemy12.png` (already his), 9 m in the Copa. Phase 3 core: **`public/enemies/enemy8.png`** (lilac sphere with a red six-pointed star and red spider legs). **Unused**; real alpha verified (RGBA 638 × 536, **61 %** transparent). Paper 2.5 m. Name **"el Corazón Negro"**.
- **Arena:** the Copa, round, r 22 m, open to the sky (the client shows the real world below: a painted backdrop of the whole map, one quad).
- **HP:** base **1 200**, × **(1 + 0.35 × (players in the room − 1))**, fixed when the fight starts. Split: phase 1 = 40 %, phase 2 = 35 %, phase 3 = the Corazón Negro's own **300 × same factor**.
- **Phase 1 — Raíces (100 → 60 %).** Wrapped in roots: all damage ×0.2. **Llamarada** on him (≤5 m, 2 s) burns the roots off for **8 s** (full damage). Attacks: swipe 18 (1 s telegraph, parry → 3 s stagger), and **root lines**: 3 purple lines on the floor, 1.2 s later roots burst (15, roll to dodge).
- **Phase 2 — Los cuatro brotes (60 → 25 %).** He sinks, invulnerable, and 4 brotes rise at the edge, one per power, each a small version of its pillar: Enredadera bridge over a thorn ring / Viento gust off its miasma / Fuego cocoon / Piedra pillar on its plate. Breaking a brote (A 1.5 s after its power step) costs him **8.75 %** of his HP; the 4th brings him back up at 25 %. Meanwhile **2 rayos** at a time harass (respawn 10 s). Co-op: 4 players take 4 brotes; solo: one at a time (~20 s each).
- **Phase 3 — El Corazón Negro (25 → 0 %).** His body freezes, the core **falls out and runs** (7 m/s, spider legs), leaves violet trails (4 PV/s), and every 10 s runs back to him to heal 5 %/s until hit. It's weak to **Piedra** (a pillar in its path stuns it 3 s) and **arrows** (x1.5). At 0 → ending.
- **Balance target:** solo with weapon 5–6, Capa 3–4: **~8 min**. Standing still next to him: ~40 s to lose 100 PV.
- **Death:** respawn at the stair checkpoint; phase progress kept if anyone is still in the Copa, reset if it empties.
- **[D]** Three phases = the three things the game taught: parry/Fuego, all four powers, chase + Piedra/arrows.

## 12. Idea de Claude: El Árbol-torre

**Problem:** after the ending, the most visible thing on the map is a finished villain's house. **Idea:** it becomes the best spot in the game.
- After `ending`, A at the tower door → **"Subir"**: a 3 s fade and you're on the **top platform** (y = 200 over the plateau, a 14 m disc), marked as **fogata 7** (Heart ↔ top by day).
- From there, **gliding covers the whole map**: the glider loses 1 m per 3 m forward, so from 230 m up you reach the Heart (~400 m away) with height to spare. Stamina drain on the glider stays; a 4 s updraft ring at the platform edge refills it once.
- The sky copy (§3.3) turns white: from anywhere, "home" is on the horizon.
- **[D]** Reuses fogatas, the glider and the tower mesh; costs a platform and one fade.

## 13. Post-game (small)

- **La Estrella** (legendary beast, base spec §9): `public/enemies/enemy14.png` (cream five-pointed star, heart eyes, frown). **Unused**; real alpha verified (RGBA 423 × 430, **65 %**). Only after `ending`, on **full-moon nights** (`day % 8 === 0`, a pure function), it rolls across la Ceniza. Tame: timing ring **4 rounds** while it spins (co-op calms as usual). Result: a personal land mount, **13 m/s** (the fastest), can enter the Tierras and every land biome; no special ability. **[D]** One legendary beast gives the kids a reason to log in after the end.
- **Noches de desafío** (§10.2).
- **Weapon 6 / Capa 4** if not finished.
- **Everything else stays:** shrines, dungeons (bosses no longer respawn; rooms stay open), fishing, building.
- **Not in the post-game:** new game+, bosses rematch, more legendary beasts (one per biome in the base spec is a later polish task).

## 14. Names

Add to `NAMES` in `src/shared/names.ts`:

```ts
biomeCorrupt: 'las Tierras Corruptas', rim: 'el Borde', ash: 'la Ceniza', thornland: 'el Espinar', blackLake: 'el Lago Negro', brokenSteps: 'los Escalones rotos',
villainTower: 'la Torre', treeTower: 'el Árbol-torre', rootPillar: 'Pilar-raíz', lieutenant3: 'La Flecha', flier: 'rayo marchito',
blackHeart: 'el Corazón Negro', guardian: 'el Guardián', legendary: 'la Estrella', thorn: 'espina negra', crack: 'la Grieta',
challengeNights: 'Noches de desafío', credits: 'el sobrino',
```

(`NAMES.tower` already exists as the Piedra trap "torre": the villain's tower is **`villainTower`** to avoid the clash. The names test forbids hand-writing "Corruptas", "Flecha", "Guardián", "Estrella".)

## 15. Out of scope (Slice 5)

- A fifth power; fire-breath, aerial combat against anything but rayos; flying bosses.
- Beasts pathing in the Tierras; raids reaching the Tierras.
- New game+, boss rematches, a second legendary beast, the full compendium, NPCs, cooking, shops.
- Cutscenes beyond vision cards; voice; music changes (a later #7 polish item).
- A new armour set, skills, looks (roadmap #4).
- The Heart losing more than "to 1 PV" in Invasion 3.

## 16. Technical

### 16.1 World extension
- `terrain.ts`: `CORRUPT_LANDS` and `corruptHeight(x, z)`: the rim (smooth north face; `withGrieta` wrapper after the ending, like `withEscalera`), ash plain noise, Espinar, Lago Negro (a bowl below water level: reuse the coast's water plane at a local level), Escalones rotos (the Peldaños step function), tower plateau. 20 m seam blend only inside the rim band.
- New `src/shared/corrupt-lands.ts`: generators for pillars, the lake, the steps, the cocoon, fogatas 6–7, zones 18–21, rayos spawns, `towerHeight(day, day0)`, `fullMoon(day)`, the fog gate check.
- Bounds: union of 5 rectangles. `steepBlocked` and `smoothAt` apply in `inCorrupt` too (the rim, the Escalones).
- Dungeons: `DUNGEONS[4]` at `x = HALF + 750`.
- **Enemy ids:** next free after 900_007 (the Cucurucho), checked by the unique-ids test: **lieut3 900_008, boss5 (El Marchito final) 900_009, core 900_010**, brotes 900_011–014. Rayos use normal wolf ids. Pillars/cores are world objects in a new 930_000+ range (920_000 = Piedra crags, 910_000 = anchors).

### 16.2 Protocol and save (43 → 44+, one bump per plan)
All new saved fields optional; old saves load and get the Tierras behind the fog.
- **Client:** `act` covers core/call-mount/climb-tower/brote (contextual A); `attack` while flying = zarpazo; `menu` gains `challenge` toggle; `travel.to` 6–7; `tame.beast` + `'estrella'`.
- **Snapshot:** `snap.fogOpen`, `snap.pillars` (4 bools), `snap.tower` (height, open, white), `snap.invasion3` (channel %), `EnemyKind` + `'rayo' | 'lieut3' | 'boss5' | 'core' | 'brote'`, `snap.guardian`, `ride` + `'estrella'`, `snap.ending`.
- **`SavedPlayer`:** `credits?`, `estrella?`, `upgrade` 6, `capa` 4, inventory `thorn`.
- **`SavedWorld`:** `fogOpen?`, `pillars?`, `towerDay0?`, `invasion3?` ('pending' | 'done'), `towerOpen?`, `corruptSeen?`, `ending?`, `challenge?`, `fogatas` over 8, `cleansed` over 22 ids.

### 16.3 Performance on phones
- +96 000 m² (~+18 %). Far mesh at ×2 cell size; only the rim and Escalones at ×1. The Tierras sit behind the mountains' silhouette, so from the forest only the **sky tower** draws (1 call).
- Low tier: detailed Tierras mesh only within 160 m (like the mountains). Est. +2 000 vertices.
- Rayos: one instanced quad set, cap **8 alive** outside raids, **12** in Invasion 3 (6 on the lowest tier).
- Copa backdrop: one textured quad (a pre-rendered top view at build time is out of scope; use a tinted map texture from the minimap if one exists, else a gradient).
- Ending: the white swap and zone lerp run once; no particles on low tier.

### 16.4 Risks
- **The sky tower** fighting with the mountains' silhouette depth: it's drawn first with no depth write, so mountains correctly cover its base. Check at dusk colours.
- **Mount calling** could become fast travel abuse: only at fogata 6, only your own animal, only to fixed spots (Ceniza, lake shore).
- **Invasion 3 feels unfair** (Heart to 1 PV). Mitigation: it never withers; the vision promises the tower either way; a 90 s channel with a big will bar.
- **Final boss too long solo.** Phase 2 is the risk (4 brotes). Tune brote steps after playtest; target 8 min total.
- **Checkpoint at the stair** is new: keep it one flag in the dungeon's live state (no save field); a server restart sends you to the Heart.
- **Old worlds that already beat everything:** the fog check reads existing flags; nothing retroactive fires except `towerDay0` (set on load to today, so the tower starts at 60 m).
- **Raids off after the ending** might make structures pointless: the toggle exists; review with Gabriel.
- **Drawings:** enemy6 as the purified villain and enemy14 as the legendary are guesses; each is a one-line PNG swap. enemy5 stays spare.

## 17. Plan map (sized like S4 plans)

| Plan | One line |
|---|---|
| **S5-A** Tierras terrain + fog gate + sky tower + names | `CORRUPT_LANDS` rectangle (rim, Ceniza, Espinar, Lago Negro, Escalones, plateau), 5-rect bounds, fog moved north + `fogOpen` check on 4 purified, sky-pass tower that grows by day, `names.ts`, protocol v44. |
| **S5-B** Rayos + ash beasts + espinas + weapon 6 / Capa 4 + fogata 6 | Flying `rayo` enemy (enemy11, dive, arrows/Viento), ash tint and espina drops, upgrade rows, Ceniza fogata with mount calling (deer/fish/frog). |
| **S5-C** Pilares-raíz + zones 18–21 + La Flecha | The 4 pillar setpieces (bridges, lake anchor, deer ash run + cocoon, steps + plate), `pillars` save, tower cracks, zones and `corruptSeen`, lieutenant 3 (enemy10, clavada, raidN % 3 === 2), visions. |
| **S5-D** Invasión 3 + air defense | Trigger on 4th pillar, north entry, Heart channel 90 s → 1 PV, will ×1.3, rayo flocks, dragon zarpazo on the attack pill, parked dragons biting rayos, dawn → `towerOpen`. |
| **S5-E** The tower dungeon | `DUNGEONS[4]`, 4 floors with a power + a white ally each, La Flecha mini-boss, stair checkpoint. |
| **S5-F** El Marchito final | Copa arena, 3 phases (roots/Fuego, 4 brotes, Corazón Negro enemy8), HP scaling by players, rayo adds. |
| **S5-G** Ending + world after | Vision cards, credits (once per player, late-joiner line), all zones clean, white tower, el Guardián (enemy6), raids off + Noches de desafío toggle, la Grieta. |
| **S5-H** Post-game: Árbol-torre + la Estrella | Tower top as fogata 7 + updraft, full-moon Estrella (enemy14) taming and 13 m/s mount. |

Order follows unlocks: terrain and the gate first; rayos and gear before the pillars (the Fuego pillar has rayo guards); pillars arm Invasion 3; the invasion opens the tower; the boss before the ending; post-game last. S5-H can be dropped without breaking the story.
