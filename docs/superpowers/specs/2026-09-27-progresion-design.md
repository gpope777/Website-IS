# Bosque — Subproyecto #4: Progresión y personalización

> **Decidido por Claude — revisar** (Fase 3 del HANDOFF: lo más simple que respete la visión; co-op que no bloquee al que juega solo; no tocar el balance del Corazón; móvil primero, rejilla táctil ≤10, UI no-combate en el Menú; voz seca en español; nombres en `names.ts`):
> - **Qué falta:** los *gear tiers* ya existen (arma 0–6, Capa 0–4, 4 poderes, 5 monturas, orbes de aliento). Faltan **niveles**, **habilidades**, **apariencia** y un sitio donde **ver** todo eso. Este subproyecto añade solo eso.
> - **Nivel del jugador 1–8 ("Rango")** por **Savia** (XP). La Savia sale casi toda de **primeras veces** (santuario, jefe, mazmorra, domar, zona limpia, pilar); matar da poco y tiene **tope diario**. Sin grind: un jugador que juega la historia llega a Rango 8 cerca del final, no antes.
> - **Los niveles no dan daño, vida ni defensa.** Los jefes están afinados para arma 5–6 / Capa 3–4; el arma y la Capa siguen siendo las únicas palancas de combate. **[D]** Así no hay que re-afinar nada.
> - **Cada Rango (2–8) da 1 punto de Oficio → 7 puntos para 12 oficios** en 3 ramas de 4 (Andar, Oficio, Compañía). Todos son **utilidad acotada**. Hay que elegir. **Cambiar los puntos es barato:** A en el Corazón → Menú → "Olvidar oficios" (5 bayas).
> - **Apariencia:** el robot tiene 3 materiales (`Grey`, `Main`, `Black`). Se **clona solo `Main` por jugador** (1 material más por jugador) → **8 colores**. Además **6 sombreros** (mallas simples en el hueso `Head`), que se ganan con hitos de la historia. Se elige en el Menú, en cualquier sitio.
> - **El Libro:** una página nueva del Menú con Rango, Savia, equipo, poderes, monturas, contadores (santuarios x/12, cofres x/6, jefes, días) y las Proezas.
> - **Partidas viejas:** la Savia de hitos se **calcula al cargar** a partir de lo que el guardado ya sabe (santuarios, poderes, monturas, arma, Capa, final). Nadie empieza en Rango 1 con media historia hecha.
> - **Idea de Claude: las Proezas.** 6 retos difíciles y opcionales (p. ej. "Tragón sin que te toque") que **solo dan sombreros y un sello en el Libro**, nunca poder. El reto para el de 12 y para Gabriel; el de 10 no se queda atrás en nada que importe.
> - **Rejilla táctil:** sigue en 10. Todo va por el Menú.

**Date:** 2026-09-27
**Status:** Draft, decided autonomously (Fase 3). No code or plans yet.
**Builds on:** `2026-09-26-bosque-online-design.md` (roadmap #4), `2026-09-26-bosque-aventura-design.md` §13 (#4 plegado en cada slice), the S2–S5 specs, and the code on `aventura/resto` after Slice 5 (PROTOCOL_VERSION 54, 979 tests).
**Rule:** simplest option that respects the vision. Every choice is marked **[D]** with a one-line reason.

---

## 1. Gap analysis (roadmap #4: "levels, skills, gear tiers, character appearance")

| Pieza | Ya existe (Aventura) | Falta |
|---|---|---|
| **Gear tiers** | Arma 0–6 (`UPGRADE`, `weaponMult` ×1,0–1,9; perlas 1–3, cuarzo 4–5, espinas 6). Capa de corteza 0–4 (`CAPA`, −10 %/nivel; ámbar 1–3, espinas 4). Se compra con A en el Corazón. | Nada. **Queda como está.** |
| **Poderes** | Enredadera, Viento, Fuego, Piedra (altares de mazmorra), pastilla 🌿 con pulsación larga. | Nada. |
| **Monturas** | Ciervo/Estrella, pez, ballena, rana, dragón; llamar en la Ceniza. | Nada. |
| **Aliento** | +20 por orbe de santuario (12 santuarios, uno por jugador). | Nada. |
| **Niveles** | — | **Rango + Savia.** |
| **Habilidades** | Los poderes hacen de "habilidades activas". | **Oficios** (pasivas, elegibles). |
| **Apariencia** | La Capa se ve a la espalda. Los demás son todos el mismo robot. | **Color y sombrero.** |
| **Ver tu progreso** | "Arma +N · Capa N" en la mochila. | **El Libro.** |

Lo que el progreso actual hace bien: está atado a explorar (cada material vive en un bioma) y tiene tope. Lo que le falta: una sensación de "subo" continua entre mejoras (las mejoras de arma llegan a saltos, y a veces pasan horas sin ninguna), algo que **elegir**, y algo que **diferencie** a Gabriel de sus sobrinos en pantalla.

## 2. Pillars

1. **Sube por jugar la historia, no por repetir.** La Savia premia primeras veces. Matar lobos ayuda un poco, con tope.
2. **Sin power creep.** Nada de lo nuevo toca daño, vida, defensa ni el Corazón. Los jefes afinados siguen afinados.
3. **Elegir importa, equivocarse no.** 7 puntos para 12 oficios; olvidar cuesta 5 bayas.
4. **Que se vea quién es quién.** Color y sombrero, visibles para todos.
5. **Móvil primero.** Cero pastillas nuevas; +1 material y ≤1 malla pequeña por jugador.

## 3. Savia y Rango

### 3.1 Fuentes de Savia (por jugador; las primeras veces cuentan una vez)

| Fuente | Savia | Notas |
|---|---|---|
| Orbe de santuario | 30 | 12 → 360 |
| Cofre hundido | 10 | 6 → 60 |
| Domar una montura (ciervo, pez, rana, dragón, Estrella) | 40 | La ballena: 40 a cada domador presente |
| Poder de un altar | 60 | 4 → 240 |
| Jefe o teniente (Tragón, Antenón, Zancudo, Cucurucho, Gata, Triángulo, La Flecha, jefes de mazmorra) | 50 | A cada jugador vivo en la pelea o a ≤40 m |
| Zona de corrupción limpiada | 15 | A quien está en ella |
| Pilar-raíz roto | 40 | A quien está a ≤40 m |
| Asedio superado (amanecer con Corazón vivo) | 15 | A cada conectado. **Tope 1 por noche.** |
| El Marchito | 150 | Una vez |
| Mejora de arma / Capa | 10 | Por nivel comprado |
| Matar: lobo 1, bruto 3, rayo 2, bestia de ceniza 2 | — | **Tope 40/día de juego.** Los de asedio sí cuentan (dentro del tope). |

**[D]** Por hitos y no por kills: un chico de 10 años no debe sentir que tiene que farmear lobos, y así el Rango sigue a la historia. El tope diario deja que el que caza vaya algo por delante sin romperlo.

**Co-op no bloquea:** todo se puede ganar solo (la ballena ya es co-op por diseño; sus 40 de Savia son 3 % del total).

### 3.2 Rangos

| Rango | Savia total | Más o menos cuándo |
|---|---|---|
| 1 | 0 | Mundo nuevo |
| 2 | 80 | Primeros santuarios del bosque |
| 3 | 220 | Enredadera + ciervo |
| 4 | 420 | Costa hecha |
| 5 | 680 | Pantano hecho |
| 6 | 980 | Montañas hechas |
| 7 | 1300 | Tierras / Pilares |
| 8 | 1650 | El Marchito (o post-juego con cacería) |

Total de hitos de la historia ≈ 1600–1750 + kills. **[D]** 8 rangos = 7 puntos, suficientes para notar cada subida (≈ una por bioma) sin hacer un árbol enorme. Los umbrales viven en `PROGRESS.ranks` en `src/shared/progression.ts`.

Al subir: tarjeta corta en el HUD **"Rango 4. Un punto de oficio."** y un destello verde en el robot, visible para los demás.

## 4. Oficios (12, en 3 ramas; 7 puntos)

Cada oficio cuesta 1 punto. Dentro de una rama se compran **en orden** (el 2 pide el 1). **[D]** Orden en rama = árbol mínimo que se entiende en un móvil (3 columnas de 4).

**Andar**
1. **Pies ligeros** — correr gasta aliento −20 %.
2. **Planeo largo** — planear se hunde −20 % (`GLIDE.sink` 1,6 → 1,28).
3. **Pulmón** — bucear aguanta +50 %.
4. **Trepador** — trepar gasta aliento −25 %; con lluvia se trepa (a mitad de velocidad).

**Oficio**
1. **Mano buena** — recoger madera/piedra/bayas da +1 (no ámbar, cuarzo, perlas ni espinas).
2. **Fogatero** — viajar desde/hasta una fogata: canal 5 s → 2 s.
3. **Trampero** — estacas y red de raíces +30 % de duración.
4. **Buen ojo** — ámbar y cuarzo vuelven en 1 día en vez de 2 (solo para ti).

**Compañía**
1. **Mano amiga** — revivir a un amigo tarda la mitad.
2. **Silbido** — llamar monturas desde cualquier fogata encendida (no solo la Ceniza).
3. **Mochila honda** — al morir, tu tumba guarda también lo que llevabas en la mano y vuelve a ti a 10 m (en vez de tener que tocarla).
4. **Pastor** — tu montura de tierra corre +10 %.

**Por qué ninguno rompe los jefes:** ninguno cambia daño, vida, defensa, velocidad a pie, i-frames, poderes ni el Corazón. Los que tocan aliento no tocan el combate (el aliento no se usa para pegar). *Mano amiga* ayuda en co-op sin ayudar solo. *Buen ojo* y *Mano buena* aceleran materiales, pero las mejoras siguen con tope 6/4 y los materiales raros (perla, espina) no cambian. **[D]**

**Olvidar oficios:** A en el Corazón → Menú → "Olvidar oficios · 5 bayas" → todos los puntos vuelven. Sin límite de veces. **[D]** Barato para que probar no dé miedo; cuesta algo para que no sea un botón de nada.

**UI:** Menú → "Oficios": 3 columnas × 4 botones grandes (48 px, cabe en 360 px), comprado = verde, disponible = borde, bloqueado = gris. Tocar uno muestra su frase y "Aprender (1 punto)". Arriba: "Puntos: 2".

## 5. Apariencia

### 5.1 Color
- El `robot.glb` tiene 3 materiales: `Grey`, `Main`, `Black`. `SkeletonUtils.clone` los comparte entre copias (por eso la Capa no tiñó nada, S3-C). **Al crear el Actor de un jugador se clona solo `Main`** y se le cambia el color. `Grey` y `Black` siguen compartidos. **[D]** 1 material extra por jugador (≤4) en vez de 3; los enemigos no cambian.
- **8 colores**, todos desde el principio: el original, musgo, ámbar, mar, óxido, lila, nieve, carbón. **[D]** El color es identidad, no premio: el de 10 años elige el suyo el primer día.

### 5.2 Sombreros (6 + ninguno)
Mallas de 1–3 primitivas, material básico compartido, colgadas del hueso `Head`:

| Sombrero | Se gana |
|---|---|
| Hoja | Rango 2 |
| Caracola | Viento |
| Corona de ámbar | Capa 3 |
| Cuernos de cuarzo | Piedra |
| Aureola blanca | El Marchito |
| Estrella | Domar la Estrella |

Más los de las Proezas (§7). La Capa sigue a la espalda y es compatible con todo.

### 5.3 Elegir
Menú → "Aspecto" en cualquier sitio (no en combate: el Menú ya se cierra solo si te pegan). Fila de 8 círculos de color + fila de sombreros (los bloqueados en gris con su pista: "Se gana con Piedra"). Mensaje `{ t: 'look', color, hat }`; el servidor valida que el sombrero esté desbloqueado.

## 6. El Libro

Menú → "Libro". Una página, scroll vertical, solo texto e iconos:
- **Rango 5 · 712 / 980 Savia** con barra.
- **Equipo:** Arma +4 (×1,6) · Capa 2 (−20 %) · Aliento N.
- **Poderes** 🌿🌬️🔥🪨 (grises los que faltan) · **Monturas** (iconos).
- **Contadores:** santuarios 8/12 · cofres 3/6 · jefes 4/11 · zonas 9/21 · días vividos · lobos, brutos, rayos · asedios aguantados.
- **Proezas:** 6 casillas con nombre; hechas con sello.
- Botones abajo: "Oficios" · "Aspecto".

**[D]** Todo sale de datos que ya existen o de contadores nuevos baratos; ninguna consulta nueva al servidor más allá del snapshot propio.

## 7. Idea de Claude: las Proezas

Seis retos difíciles y opcionales, marcados en el Libro. **Solo dan un sombrero o un sello, nunca poder.** Dan reto a Gabriel y al de 12 sin dejar atrás al de 10: nadie necesita una Proeza para nada.

1. **Sin un rasguño** — vencer al Tragón sin recibir daño → sombrero *Papel doblado*.
2. **Pez veloz** — la carrera de anillos del pez en ≤ 80 % del tiempo límite → sello.
3. **Pies secos** — cruzar los Nenúfares a pie, sin rana → sello.
4. **Solo contra el frío** — llegar a la Cumbre de noche sin fogata ni refugio → sombrero *Gorro de nieve*.
5. **Noche entera** — aguantar un asedio sin que el Corazón baje del 50 % → sello.
6. **Corazón quieto** — vencer a El Marchito con arma ≤ +4 → sombrero *Corona marchita*.

Cada una la vigila el servidor en el sitio donde ya pasa lo que mide (flag por pelea/carrera; no hay sistema genérico de retos). **[D]** 6 comprobaciones sueltas son más simples que un motor de logros.

## 8. Out of scope (#4)

- Más niveles de arma o Capa, armaduras nuevas, estadísticas de combate por nivel.
- Oficios activos o que ocupen pastilla.
- Ropa por piezas, caras, tinte de Grey/Black, tinte de enemigos o monturas.
- Tabla de clasificación entre mundos. Recompensas en tienda (eso es #6).
- Tutorial de oficios (va en #7 con el resto del onboarding).

## 9. Names (placeholders, `src/shared/names.ts`)

`xp: 'Savia'`, `rank: 'Rango'`, `skills: 'Oficios'`, `book: 'Libro'`, `feats: 'Proezas'`, los 12 oficios, los 9 sombreros y los 8 colores. Los sobrinos los cambian.

## 10. Technical

### 10.1 Reglas puras
`src/shared/progression.ts`: `PROGRESS` (fuentes, umbrales, tope diario), `rankOf(xp)`, `pointsOf(rank)`, `SKILLS` (id, rama, orden), `canLearn(skills, id, rank)`, `HATS` + `hatUnlocked(p, hat)`, `COLORS`, `milestoneXp(p: SavedPlayer)` (Savia retroactiva). Los oficios se aplican como multiplicadores en los sitios existentes (aliento, `GLIDE`, buceo, cosecha, `FOGATA.channel`, trampas, `AMBER`/`QUARTZ` regrow, revivir, llamar, velocidad de montura), cada uno leyendo `hasSkill(p, id)`.

Movimiento: planeo, correr y trepar se simulan en el cliente. El servidor manda los oficios del jugador en el snapshot propio; el cliente los aplica; la validación de movimiento del servidor usa los mismos valores (`hasSkill`) para no rechazar moves legítimos.

### 10.2 Protocolo y guardado (54 → 55+, uno por plan)
Campos nuevos opcionales en `SavedPlayer`:
- `xp?: number` — Savia de fuentes no retroactivas (kills, asedios, zonas, jefes antes no guardados). La Savia total = `milestoneXp(p) + xp`.
- `killDay?: { day: number; xp: number }` — tope diario.
- `skills?: string[]`, `look?: { color: number; hat: number }`, `feats?: number[]`, `hats?: number[]` (los ganados por hitos sin flag propio), `bosses?: string[]`, `zonesCleared?: number`, `kills?: Record<string, number>`, `raidsHeld?: number`.

Mensajes: `{ t: 'learn', id }`, `{ t: 'forget' }`, `{ t: 'look', color, hat }`. Snapshot propio: `xp`, `rank`, `skills`, contadores del Libro. Snapshot de otros: `look` (2 bytes) y un evento `rankUp` para el destello.

Partidas viejas: sin campos → `milestoneXp` da el Rango correcto desde lo que ya hay (santuarios, cofres, monturas, poderes, arma, Capa, `ending`, `star`); los jefes vencidos antes no se saben por jugador → **[D]** se infieren de los poderes (cada altar implica su jefe de mazmorra) y de flags de mundo.

### 10.3 Rendimiento en móvil
+1 material clonado y ≤1 malla de sombrero (≤3 primitivas) por jugador: ≤4 draw calls más con 4 jugadores. El Libro y los Oficios son HTML del Menú. Cero luces nuevas. Contadores: enteros en el guardado.

### 10.4 Riesgos
- **Savia mal calibrada** (Rango 8 demasiado pronto o nunca): umbrales en una constante; probar la curva con el orden de historia del HANDOFF.
- **Validación de movimiento** con oficios de aliento/planeo: el servidor debe usar los mismos multiplicadores; test de que un planeo con *Planeo largo* no se rechaza.
- **Clonar `Main`** puede no cubrir el cuerpo entero si el color vive en `Grey`: verificar en navegador; si hace falta, clonar también `Grey` (1 material más).
- **Hueso `Head`:** el nodo existe (`Head`); el sombrero se ata al nodo, no al root, para que siga la animación.
- *Buen ojo* + *Mano buena* aceleran el arma 4–5. Aceptado: el tope 6 y las espinas no cambian.

## 11. Plan map (sized like slice plans)

- **P4-A — Savia y Rango:** `progression.ts` (fuentes, umbrales, `milestoneXp`, tope), premios en el servidor en cada sitio de hito, campos guardados, snapshot propio, tarjeta "Rango N" y destello. (v55)
- **P4-B — Oficios:** `SKILLS`, `learn`/`forget` (5 bayas en el Corazón), los 12 efectos en sus sitios (cliente + validación del servidor), pantalla Oficios en el Menú. (v56)
- **P4-C — Aspecto:** `Main` clonado por jugador, 8 colores, 6 sombreros en `Head`, desbloqueos, `look` en guardado y snapshot, pantalla Aspecto. (v57)
- **P4-D — Libro y Proezas:** contadores (jefes, zonas, kills, asedios), página Libro, las 6 comprobaciones de Proezas y sus 3 sombreros, nombres en `names.ts`, HANDOFF. (v58)
