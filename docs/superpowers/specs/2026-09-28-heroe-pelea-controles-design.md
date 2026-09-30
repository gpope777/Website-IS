# Bosque — Héroe, pelea y controles móviles

**Date:** 2026-09-28
**Status:** Aprobado por Gabriel en chat (2026-09-28). Pieza 1 de 3 del pedido "que se sienta como un Zelda" (referencia: Wildbrush, https://wildbrush.vercel.app).
**Builds on:** `2026-09-27-visuales-design.md` (presupuestos por gama §3), `2026-09-28-pulido-design.md` (impacto P7-A, sonido P7-B, controles P7-C), `HANDOFF-aventura.md`.
**Siguientes piezas (fuera de este spec):** 2) monturas: todas disponibles al inicio (modo prueba) y 3–5 por tipo con ventajas propias; 3) rediseño del mapa para explorar.

Las decisiones marcadas **[D]** son de Claude dentro de lo aprobado; revisar si algo no convence.

## 0. Problema

1. **Bug de ataque:** pulsar atacar varias veces solo muestra el primer golpe. `game.act()` alarga `attackUntil` 450 ms en cada toque; la animación sigue siendo `'attack'` y `Actor.play()` sale en `if (anim === this.currentName) return;` (`src/client/actors/actor.ts:171`), así que el clip `Punch` (LoopOnce, clamp) se queda congelado en su último cuadro. Además: la ventana de 450 ms corta el clip de 0,83 s; el servidor solo acepta un golpe cada 0,6 s (`PUNCH`, `world-sim.ts:75`) y descarta en silencio los toques entre 0,45 y 0,6 s → golpes "de mentira"; los demás jugadores ven el mismo congelado.
2. **El robot no puede mostrar la pelea.** Solo tiene `Punch`; rodar, bloquear, arco, trepar, planear y deslizar son poses fingidas (`poses.ts`); los poderes no tienen animación. El sistema de impacto (P7-A: hit-stop, sacudida, vibración, parada, fijar) ya existe pero no se nota.
3. **Pantalla del móvil saturada:** A, B, stick, 10 pastillas, MENÚ y 🎒 = 14 controles fijos.
4. **Apariencia:** cada jugador quiere su propio personaje y ajustarlo; hoy solo hay color (tinte del robot) y sombrero.

## 1. Héroe KayKit

- **Fuente:** KayKit Character Pack: Adventurers 1.0 (Kay Lousberg, **CC0**), https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0. Cuatro personajes: **Caballero, Bárbaro, Maga, Pícaro**. Mismo esqueleto (`root, hips, spine, chest, upperarm.l …, handslot.l/r, head …`), ~5,7–7 k triángulos cada uno, una textura atlas de franjas de 14–16 KB (1024², se baja a 128²).
- **Empaquetado [D]:** los `.glb` originales pesan ~3,6 MB cada uno porque cada uno repite las 76 animaciones. Se generan con un script de preparación (no dependencia del proyecto; `@gltf-transform/core` instalado solo en la carpeta temporal):
  - `public/models/heroe-anims.glb`: esqueleto + solo los clips de la tabla §1.1.
  - `public/models/heroe-{caballero,barbaro,maga,picaro}.glb`: malla + esqueleto + textura (128²), sin animaciones.
  - Objetivo: **≤ 1,5 MB en total** (medido y anotado en el HANDOFF). `robot.glb` se queda en el repo como respaldo hasta que Gabriel pruebe en teléfono; ya no se carga.
- Créditos en `public/models/CREDITS.md`.
- Las piezas de cada personaje son mallas separadas (casco/gorro, capa, escudos, armas de 1 y 2 manos). Se muestran: cuerpo + cabeza + extremidades + capa + **un arma de una mano** + (Caballero y Bárbaro) **un escudo redondo**. El resto se oculta **[D]**.

### 1.1 Clips

| Animación del juego | Clip KayKit | Notas |
|---|---|---|
| idle | `Idle` | |
| walk / run | `Walking_A` / `Running_A` | |
| jump | `Jump_Full_Short` (once) | aterrizaje: `Jump_Land` si la caída > 0,6 s |
| swim | `Walking_B` ×0,5 | no hay clip de nado |
| attack1 / attack2 / attack3 | `1H_Melee_Attack_Chop` / `1H_Melee_Attack_Slice_Horizontal` / `1H_Melee_Attack_Slice_Diagonal` | combo §2 |
| spin | `2H_Melee_Attack_Spin` | giratorio §2 |
| roll | `Dodge_Forward` | la voltereta de `poses.ts` se retira |
| block | `Blocking` (bucle); `Block_Hit` al bloquear, `Block_Attack` al parar | |
| bow | `1H_Ranged_Shoot` | |
| cast | `Spellcast_Shoot` | poderes (nuevo) |
| hurt | `Hit_A` | al recibir daño (nuevo) |
| climb / glide / slide | `Walking_B` ×0,5 / `Jump_Idle` / `Jump_Idle` | se mantienen las poses de hueso encima donde ya existen |
| seat (pasajero, montado) | `Sit_Chair_Idle` | |
| cheer | `Cheer` | subir de Rango, vencer jefe (nuevo) |
| dead | `Death_A` | |

Total ~22 clips. Las poses de `poses.ts` que sobren (bloquear, arco, rodar) se eliminan; las de trepar/planear/deslizar se re-ajustan a los nombres de hueso de KayKit (`upperarm.l` etc.).

## 2. Pelea

### 2.1 Máquina del combo (cliente, pura, testeada: `src/client/combo.ts`)
- Estado: `step` (0–3), `lastSwingAt`, `buffered`, `holdStart`.
- **Toque** de atacar:
  - Si puede golpear (han pasado `PUNCH.cooldown` = 0,6 s desde el último golpe aceptado): golpe inmediato; `step = step < 3 && now - lastSwingAt ≤ 0,6 + 0,5 ? step + 1 : 1` (la ventana del combo son 0,5 s **después** de que termina la espera de 0,6 s).
  - Si no: se **guarda un golpe** (solo uno) que sale en cuanto se cumple el cooldown. **Ningún toque golpea "de mentira".**
- Cada golpe reproduce `attack{step}` **desde el principio** (arreglo del bug: `Actor.play(anim, { restart: true })` para clips de una vez) y la animación dura lo que dura el clip (no 450 ms fijos).
- **Mantener** atacar ≥ 0,8 s y soltar → giratorio (§2.3). Mientras carga, brillo que crece en el arma. Soltar antes de 0,8 s = golpe normal.
- Al atacar **sin fijar**, el personaje **encara** al enemigo más cercano en alcance (hoy solo encara si hay fijado).

### 2.2 Servidor
- `{t:'attack', id, n?}`: `n` = paso del combo (1–3, opcional). El servidor **no confía** en `n` para daño: lleva su propio contador por jugador (`comboStep`, `comboAt`) con la misma regla y cooldown. **Daño igual en los 3** (20 × arma) **[D]** para no tocar balance; el **3.º empuja 1,5 m y aturde 0,4 s** a lobos y brutos (jefes y élites: solo el empuje visual, sin aturdir).
- `{t:'spin'}` nuevo: golpea a **todos** los enemigos a ≤ 3 m con daño de golpe normal, **espera de 4 s** (`SPIN = { reach: 3, cooldown: 4 }`), resetea el combo. Validado (vivo, no montado, no en el aire sobre el dragón).
- `l.anim` sigue viniendo del mensaje de movimiento; se añaden a `ANIMS`: `attack1, attack2, attack3, spin, cast, hurt, cheer`. `'attack'` se mantiene como alias válido (clientes viejos) y se dibuja como `attack1`.
- **`PROTOCOL_VERSION` 65 → 66.** Ningún campo guardado nuevo en esta sección.

### 2.3 Sensación (solo cliente, sobre P7-A)
- **Estela del arma:** cinta de 12 segmentos que sigue `handslot.r` durante el golpe y se desvanece en 0,2 s; color por golpe (blanco, blanco, dorado en el 3.º y en el giro). 1 draw call, reutilizada.
- **Chispas al impactar:** 8–12 partículas (un `Points` compartido) en el punto del golpe; en la parada, anillo breve.
- **Tambaleo del enemigo:** los lobos/brutos (Actor) retroceden 0,3 m y se inclinan 0,15 s en cada golpe (hoy solo parpadean); el papel ya se aplasta.
- **Recibir daño:** `hurt` (`Hit_A`) si no estás bloqueando ni rodando.
- **Poderes:** `cast` al lanzar Enredadera, Viento, Fuego o Piedra.
- **Sonido:** reutiliza `golpe-aire`, `golpe`, `golpe-final`; el giro suena como `golpe-aire` ×2 más grave **[D]** (sin sonidos nuevos obligatorios).
- Presupuesto: estela + chispas ≤ **+2 draw calls** y ≤ 1 k triángulos en baja.

## 3. Apariencia

- `Look` (`src/shared/progression.ts:163`) gana campos **opcionales**: `body?: 0–3` (Caballero, Bárbaro, Maga, Pícaro) y `skin?: 0–4`. Ausentes = Caballero y piel 0 → **las partidas viejas cargan sin cambios**. `{t:'look'}` acepta `body` y `skin` opcionales; `isLook` los valida.
- **Color de ropa:** los 8 `COLORS` existentes. El personaje usa una copia de su textura atlas (128², en un canvas) donde solo se **repintan las franjas de ropa** de ese personaje (tabla de celdas por personaje, en datos) al tono elegido conservando el degradado; la piel usa las franjas de piel con 5 tonos. Texturas cacheadas por `(body, color, skin)`; ≤ 4 × 8 × 5 × 64 KB en el peor caso teórico, en la práctica las de los jugadores presentes. **Color 0 = colores originales del personaje.**
- **Sombrero:** los 9 existentes (`hats.ts`) se enganchan al hueso `head`; con sombrero puesto se oculta el casco/gorro propio del personaje.
- **Panel Aspecto** (`look-ui.ts`): se añade fila **Personaje** (4) y **Piel** (5); vista del personaje girando en el panel **[D]** (un segundo render pequeño solo mientras el panel está abierto).
- Los 4 pelean **igual** (mismo daño y clips); solo cambia el arma visible (espada, hacha, varita, cuchillo) **[D]**: ningún sobrino elige "mal".
- Estela y pose de arco son iguales para los 4.

## 4. Controles móviles

De **14 controles fijos a 6**. El teclado no cambia.

| Control | Toque | Mantener |
|---|---|---|
| **Atacar / usar** (grande, bajo el pulgar derecho) | combo; si hay algo que usar cerca, el icono cambia y lo usa | giratorio |
| **Saltar** | saltar | planear |
| **Rodar** | esquivar | guardia (levantarla justo antes del golpe = parada) |
| **Poder** | usa lo elegido | **rueda**: Arco, Enredadera, Viento, Fuego, Piedra (solo los que tengas) |
| **🎒** | abre la mochila | **rueda**: comer, fogata, muro, corazón, trampa, silbar montura (solo los disponibles) |
| **Menú** | igual que hoy | — |

- **Rodar/guardia en un botón [D]:** al **apoyar** el dedo se levanta la guardia en el acto (la ventana de parada de 0,25 s cuenta desde ahí); si se **suelta antes de 0,2 s**, se baja la guardia y se rueda. Rodar llega ≤ 0,2 s más tarde que hoy; a cambio la parada no pierde precisión.
- **Fijar:** se quita 🎯. **Tocar un enemigo** en pantalla lo fija; tocarlo otra vez (o tocar el cielo/suelo) lo suelta. Teclado: X igual que hoy.
- **Stick flotante:** aparece donde apoyas el pulgar en la mitad izquierda.
- **Varias opciones a la vez (regla de Gabriel):** si al pulsar Atacar/usar hay **≥ 2 acciones de contexto** posibles y ningún enemigo en alcance (p. ej. cofre + montura + fogata), sale una **rueda rápida** con esas opciones (desliza y suelta, o toca). Con una sola opción, se usa directo como hoy. La lista de candidatos sale del mismo orden de `act()` (`game.ts:1886`), extraído a una función pura testeada.
- **Rueda radial** (`src/client/wheel.ts`, un componente para las 3 ruedas): hasta 6 sectores, se abre al mantener 0,3 s o al pedir elección; el sector bajo el dedo se ilumina; soltar fuera del círculo cancela. Texto grande, icono + palabra.
- Lo que no sirve en ese momento se **atenúa** sin moverse (posiciones fijas).
- Márgenes de muesca (`safe-area-inset`) y tamaño mínimo de botón 56 px (Atacar 80 px).
- El tutorial (P7-F) que señala pastillas se re-apunta a los controles nuevos.

## 5. Pruebas

- **Unitarias (TDD):**
  - `combo.ts`: paso 1→2→3→1, reinicio tras 0,5 s, golpe guardado único, mantener → giratorio, soltar antes de 0,8 s = golpe.
  - Servidor: contador de combo propio, 3.º golpe aturde, `spin` golpea a todos en 3 m y respeta 4 s, rechazos (muerto, montado).
  - `decodeClient`: `attack` con `n`, `spin`, `look` con y sin `body`/`skin`, valores fuera de rango.
  - Carga de partidas viejas sin `body`/`skin`.
  - Repintado de paleta: celdas de ropa cambian, piel y resto no.
  - `wheel.ts`: sector por ángulo, cancelar fuera, solo opciones disponibles.
  - Candidatos de contexto de `act()`: 0, 1 y ≥ 2 opciones.
  - `Actor.play` con `restart`.
- **En navegador (local, `npm run dev:server`):** los 4 personajes, combo, giratorio, parada, rueda, tamaño de teléfono (375×812 horizontal), capturas en el PR.
- **Rendimiento:** `npm run perf -- --tier low` dentro del presupuesto de Visuales §3.
- `npm test && npm run test:workers && npm run check && npm run build` en verde antes de cada commit.

## 6. Fuera de alcance

Monturas (pieza 2), mapa (pieza 3), look estilizado/toon, enemigos 3D (los dibujos siguen siendo papel), cambios de balance.
