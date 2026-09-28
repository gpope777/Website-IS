# Bosque — Subproyecto #2: Mundo y visuales

> **Decidido por Claude — revisar** (Fase 3 del HANDOFF: lo más simple que respete la visión; móvil primero; no tocar jugabilidad, colisiones, protocolo ni balance; los dibujos de los sobrinos siguen siendo papel):
> - **Cero descargas obligatorias.** Desde este contenedor solo llega el registro de npm; kenney.nl, poly.pizza, quaternius.com, opengameart, ambientcg y jsDelivr no responden. Todo #2 se hace **procedural y con shaders** (parches `onBeforeCompile` sobre los materiales Lambert actuales). Los paquetes CC0 quedan en una **lista de "suelta y listo"** (§9) que Gabriel baja cuando quiera; el código carga el `.glb` si existe y si no usa el procedural. **[D]**
> - **Presupuesto por gama, con números, y un arnés que los mide** (§8): baja ≤ **120 draw calls**, ≤ **250 k triángulos**, sin sombras, pixel ratio 1; media ≤ 180 / 500 k; alta ≤ 260 / 1,2 M. Un plan que se pase no se mezcla. **[D]**
> - **Una sola luz de sol + hemisférica, siempre.** Nada de luces puntuales nuevas: las lámparas y fogatas "iluminan" con un término de brillo en el shader del terreno (hasta 8 puntos en un uniform), no con `PointLight`. **[D]** Cada luz real multiplica el coste de todos los materiales en móvil.
> - **Hierba con viento en todos los biomas con suelo** (no solo el bosque), con color por bioma y densidad por gama, en trozos de 32 m que se ocultan por distancia. **[D]**
> - **Agua nueva = un shader, un quad** (como hoy): profundidad por altura del terreno conocida en el vértice, espuma en la orilla, olas por vértice solo en media/alta. Sin reflejos reales (ni en alta): cielo reflejado con un degradado. **[D]**
> - **Monturas y bichos cuadrados → low-poly procedural** con huesos falsos (animación por vértice en el shader, sin esqueleto): ciervo, pez, rana, ballena. Siguen siendo 1–2 draw calls cada uno. **[D]**
> - **Animaciones que faltan → poses procedurales** encima del clip más cercano del robot (rodar = voltereta del grupo raíz; bloquear = brazos cruzados por hueso; arco, trepar, planear, deslizar igual). Sin clips nuevos. **[D]**
> - **Enemigos zorro sin tinte → tinte por tipo** en un material compartido por tipo (no por instancia): bruto, reforzado, escudado, de roca y ceniza con color y escala propios. **[D]**
> - **Gama automática con prueba de FPS** de 4 s en la primera partida (sustituye la adivinanza por GPU que ya marca `ponytail` en `quality.ts`), bajada automática si el juego va a <24 fps durante 10 s. **[D]**
> - **Idea de Claude: el mundo sana a la vista.** Cada Raíz-madre limpia repinta su zona de gris-morado a su color vivo en 20 s con una ola que sale de la raíz (un uniform por zona, 22 zonas, cero mallas nuevas). Al final (El Marchito cae) las Tierras Corruptas florecen igual. Lo que los niños ya hacen se ve.

**Date:** 2026-09-27
**Status:** Draft, decidido autónomamente (Fase 3). Sin código ni planes todavía.
**Builds on:** `2026-09-26-bosque-online-design.md` (visión: "lush, beautiful forest"; estrella polar Tidewater; roadmap #2; gamas desde el día uno; mayoría en móvil), `HANDOFF-aventura.md` (todos los placeholders visuales), y el código en `aventura/resto` tras #6 Tiendas.
**Rule:** simplest option that respects the vision. Every choice is marked **[D]** with a one-line reason. **Nada de #2 cambia el protocolo, el servidor, las colisiones ni la jugabilidad.** `PROTOCOL_VERSION` no sube.

---

## 1. Qué hay hoy (inventario)

| Pieza | Estado | Dónde |
|---|---|---|
| Gamas | `low/medium/high`: pixel ratio 1/1,5/2, sombras no/1024/2048, hierba 2 500/6 000/12 000, distancia 120/180/260, segmentos 160/200/240. Detección por táctil + memoria + nombre de GPU (`ponytail`). | `src/client/quality.ts` |
| Render | `WebGLRenderer`, antialias salvo baja, ACES, `shadowMap` si la gama lo dice. | `src/client/game.ts:413` |
| Cielo | Color de fondo liso (noche → día → atardecer; tinte de asedio y tormenta). Sol + luna direccionales + hemisférica. `THREE.Fog` lineal, cerrada en el Pantano. Sin nubes, sin estrellas, sin sol visible. | `scene/sky.ts` (67 líneas) |
| Terreno | Mallas con color por vértice (bosque, Costa, Pantano, 4+4 trozos de Montañas y Tierras en detalle/silueta). Lambert. | `scene/terrain-mesh.ts` |
| Agua | Un quad Lambert azul, opacidad 0,78. El Lago Negro, un disco. Tinte del mar lejano. | `terrain-mesh.ts:197` |
| Vegetación | Árboles = cilindro + 2 conos; rocas dodecaedro; arbustos icosaedro + bayas. `InstancedMesh`, `frustumCulled = false` en todo el mapa. Hierba = conos de 3 caras, **solo bosque**, sin viento. Pinos (150) y espinas (220) instanciados. | `scene/vegetation.ts`, `terrain-mesh.ts` |
| Tiempo | Lluvia/nieve en las Montañas: nube de 600 puntos. | `scene/weather.ts` |
| Modelos | `robot.glb` (Quaternius, CC0) jugador; `fox.glb` (CC0 + CC-BY 4.0) para lobos **y** brutos (escala 1,8/2,4 + tabla/losa delante, sin tinte). | `public/models/`, `actors/models.ts` |
| Monturas/bichos | Ciervo, pez, rana, ballena = **cajas**. | `scene/steeds.ts`, `fish.ts`, `frog.ts`, `whale.ts` |
| Dibujos | 15 PNG en `public/enemies/`, por `PaperActor` (tarjeta que mira a cámara, bota, respira, se tiñe). | `actors/paper.ts` |
| Anims | `roll`, `block`, `bow`, `climb`, `glide`, `slide` = clips del robot reciclados (`WalkJump`, `Idle` lento, `Punch`, `Jump` congelado + cono verde). | `actors/actor.ts:20` |
| Mazmorras, torre, fogatas | Mallas sueltas pequeñas, llamas `MeshBasic` sin niebla, 3 luces fijas en una sala. | `scene/*-dungeon.ts`, `fogatas.ts` |
| Rendimiento conocido (HANDOFF) | Terreno gama baja ~32 600 vértices + Pantano 1 829 + Montañas 8 528 detalle + Tierras 8 856; mazmorras ~20–45 mallas pequeñas; "nunca probado en móvil real"; Chromium headless a ~2 fps (SwiftShader). | HANDOFF |

**Red desde el contenedor (2026-09-27):** `registry.npmjs.org` 200; `raw.githubusercontent.com` 301 (responde); `github.com` 400 por el proxy; `kenney.nl`, `poly.pizza`, `quaternius.com`, `opengameart.org`, `ambientcg.com`, `cdn.jsdelivr.net` sin respuesta. Chromium de Playwright en `/opt/pw-browsers/chromium-1194` (y `chromium_headless_shell-1194`).

## 2. Pilares

1. **Móvil primero, medido.** Cada cambio llega con su coste por gama y el arnés lo comprueba. La gama baja es la que juegan los sobrinos.
2. **Misma dirección de arte en todas las gamas.** Baja = menos densidad, menos distancia, sin sombras; nunca otro estilo.
3. **El papel es un pilar.** Los dibujos no se convierten en 3D en #2. Se les da mejor luz (reciben el color de la hora y del bioma), sombra en disco y un borde de papel, nada más.
4. **Leer el juego primero.** Enemigos, recursos, zonas marchitas y peligros (Zarzal, aguas bravas, Borde) deben leerse igual o mejor que hoy. Ningún efecto tapa un aviso.
5. **Shader antes que malla, malla antes que luz.** Un uniform es gratis; un draw call no; una luz real es lo más caro.

## 3. Presupuestos por gama

| | Baja (móvil) | Media | Alta (PC) |
|---|---|---|---|
| Pixel ratio | 1 (0,85 si la prueba de FPS lo pide) | 1,5 | min(dpr, 2) |
| Draw calls máx. (peor bioma, de día) | **120** | 180 | 260 |
| Triángulos máx. en vista | **250 k** | 500 k | 1,2 M |
| Sombras | no (disco bajo actores) | sí 1024, radio 40 m | sí 2048, radio 60 m |
| Hierba (briznas en vista) | 8 k en trozos de 32 m, radio 35 m | 30 k, radio 60 m | 90 k, radio 90 m |
| Viento | vértice, 1 onda | 2 ondas + ráfagas | 2 ondas + ráfagas + aplastado por jugador |
| Agua | color por profundidad + espuma, plana | + olas en vértice (quad 64×64) | + olas 128×128 + cáusticas en el fondo |
| Cielo | cúpula degradada + sol/luna | + nubes (1 capa, textura procedural 256²) | + 2 capas + estrellas titilantes |
| Niebla | lineal (como hoy) | exponencial con altura | exponencial con altura + dispersión al sol |
| Vida ambiente (instancias) | 1 bandada (12) + 40 luciérnagas | 2 bandadas + 120 | 3 bandadas + 250 + peces bajo el agua |
| Posproceso | ninguno | ninguno | FXAA opcional + viñeta (1 pase) |
| Coste de shader extra por píxel | ≤ +6 ALU en terreno | ≤ +15 | sin tope fijo, ≤ 16 ms en GPU integrada |
| Memoria de texturas nueva | ≤ 2 MB | ≤ 6 MB | ≤ 12 MB |

Las cifras de "hoy" se miden con el arnés en V2-A antes de tocar nada; si hoy ya se pasa en algún bioma, el plan que toque ese bioma lo baja.

## 4. Look por bioma

Cada bioma es un **`BiomeLook`** (datos puros en `src/client/scene/looks.ts`): paleta de suelo (3 colores: bajo, medio, alto/pendiente), color de hierba (raíz/punta), cielo (cenit/horizonte por hora), niebla (color, densidad), intensidad y color del sol y la hemisférica, agua (poco/muy hondo, espuma), vida ambiente. El jugador mezcla entre el look de su bioma y el vecino en 30 m (la función `biomeAt` ya existe en `shared`). **[D]** Una tabla de datos permite retocar colores sin tocar shaders.

Horas: `noche` (0–0,2), `alba` (0,2–0,3), `día`, `ocaso` (0,7–0,8), `noche`. Cada look da 4 claves y se interpolan.

| Bioma | Suelo | Hierba | Cielo día / ocaso | Niebla | Luz | Agua | Vida |
|---|---|---|---|---|---|---|---|
| **Bosque** | verde musgo, tierra en senderos (por densidad de árboles), roca gris cálida en pendiente | verde amarillo → verde intenso, flores sueltas (blanco/amarillo 3 %) | azul claro con nubes / oro y rosa | verde azulada, suave | sol cálido 2,4, hemi cielo/hierba | arroyos claros, verde azulado | pájaros, mariposas de día, **luciérnagas de noche** |
| **Costa** | arena crema, arena mojada más oscura bajo +0,4 m, hierba de duna | pasto de duna pálido, alto y ralo | cian limpio / naranja sobre el mar | casi nula de día, bruma baja al alba | sol blanco fuerte 2,7 | turquesa en bajíos → azul hondo, **espuma** en la orilla | gaviotas, cangrejos (quads), peces bajo el agua (alta) |
| **Pantano** | oliva oscuro, barro negro, montículos verde oscuro | juncos oscuros, altos, poco movimiento | verde grisáceo / ámbar sucio | **espesa**, verde amarilla, cerca (35–70 como hoy) | sol débil 1,4, hemi verde | marrón verdoso opaco, sin espuma, lenteja de agua (manchas) | luciérnagas día y noche, mosquitos (partículas), burbujas |
| **Montañas** | hierba alpina baja → roca azulada → **nieve por altura y pendiente** (>55 m, <35°) | corta, verde frío, desaparece sobre 50 m | azul profundo / rosa en la nieve | clara, azul, lejana; nubes bajo el Pico | sol frío 2,6, sombras largas | lagos helados (color claro, sin olas) | águilas (bandada de 3 alta), nieve suelta con viento |
| **Tierras Corruptas** | ceniza gris, grietas moradas (emisivas débiles, fog off), espinas negras | ninguna; ceniza que vuela | violeta y granate / rojo | morada, densa en el Lago Negro | sol rojizo 1,6 | Lago Negro: casi negro, brillo morado en la orilla | ceniza cayendo, chispas |
| **Purificado (tras el final)** | las Tierras con paleta de pradera pálida y flores blancas; grietas → vetas doradas | hierba nueva clara, flores blancas 8 % | como el bosque pero más dorado | limpia | sol cálido 2,4 | Lago Negro → azul limpio | luciérnagas doradas, pájaros |

**Zonas marchitas** (las 22 de `corruption.ts`): hoy tinte morado. Pasan a ser un uniform `corrupt[i]` (0..1) que el terreno, la hierba y los árboles leen por distancia a la raíz → mezcla con la paleta de las Tierras. Base de la Idea de Claude (§11).

**Noche de verdad** (Tidewater: "truly dark nights"): de noche el fondo va a azul casi negro (0x05080f), la hemisférica a 0,08 y la luna a 0,35 azulada. Lo que se ve de noche lo dan los **puntos de brillo** (§5.5), las luciérnagas, la luna, y la emisión de lo que ya es `MeshBasic` (llamas, cuarzo). **[D]** Los niños juegan de noche los asedios: el Corazón, los muros y los enemigos llevan borde de luz de luna (rim en el shader de actores) para que la pelea se siga leyendo.

## 5. Sistemas

### 5.1 Cielo (`scene/sky.ts` → `sky-dome.ts`)
- Cúpula (esfera 16×12, `side: BackSide`, `fog: false`, `depthWrite: false`) con shader: degradado cenit/horizonte del look, disco de sol con halo (tamaño mayor al ocaso), luna. 1 draw call.
- Nubes (media/alta): ruido FBM calculado **una vez** a una textura 256² (512² en alta) en un canvas al cargar; el shader la muestra en la cúpula desplazándola con el viento. Luz de nube = color del sol del look. 0 draw calls extra (misma cúpula).
- Estrellas (alta): puntos hash en el shader de la cúpula, visibles con `1 - daylight`.
- Tormenta, asedio y Pantano siguen existiendo: tiñen el look como hoy.
- **Coste:** +1 draw call, 192 triángulos; baja ~8 ALU/píxel en el cielo (la mayoría de píxeles del cielo no tapan otra cosa).

### 5.2 Niebla y luz
- Media/alta: niebla **exponencial por altura** (densa en valles, clara en cumbres) inyectada en `fog_fragment` por `onBeforeCompile` en un helper compartido (`patchFog(material)`). Baja mantiene `THREE.Fog` lineal. **[D]** La exponencial cuesta ~4 ALU; en baja la distancia corta ya es la niebla.
- Color de la niebla = horizonte del cielo en esa dirección (media/alta: mezcla con el color del sol si miras hacia él → "dispersión" barata).
- Sombras: la cámara de sombra sigue al jugador (como hoy, ±50) pero su radio pasa a 40/60 según gama y se ajusta al texel para que no tiemble.
- Baja: **disco de sombra** (quad radial, ya usado en jefes) bajo cada actor y montura.

### 5.3 Hierba y follaje con viento (`scene/grass.ts`)
- Brizna = 1 quad doblado de 3 vértices por lado (5 triángulos), geometría de **un trozo de 32×32 m** con N briznas pre-sembradas (N según gama). Instancias = trozos colocados en la rejilla; se muestran los trozos cercanos que estén sobre tierra del bioma y dentro del radio. **[D]** Un `InstancedMesh` de trozos (1 draw call) en lugar de 12 000 instancias sueltas que hoy se dibujan por todo el mapa.
- La altura del suelo se lee en el vértice de una **textura de alturas** (float 256², generada del `Terrain` compartido al cargar; 256 KB), igual que el color del bioma (textura 128²). Nada se calcula en CPU por fotograma.
- Viento: uniform `wind(dir, fuerza, t)`; desplazamiento por vértice proporcional a la altura de la brizna² con 1–2 ondas + ráfagas (ruido de valor en el vértice). En alta, aplastado alrededor de los jugadores (uniform de 4 posiciones).
- Densidad por bioma: bosque 1, Costa 0,4 (duna, más alta), Pantano 0,5 (juncos), Montañas 0,7 bajo 50 m, Tierras 0 (purificadas: 0,8), zonas marchitas → color de ceniza y 0,3 de alto.
- Nada de hierba sobre caminos/estructuras: una textura de máscara 256² pintada al cargar con las estructuras y senderos (`density` alta de árboles = sendero de tierra).
- **Árboles, arbustos y pinos:** el mismo parche de viento (solo copas, amplitud pequeña). Copas con 2 tonos por instancia (`instanceColor`). Se parten los `InstancedMesh` de recursos en **4×4 regiones** con su caja para que el frustum culling funcione (quita el `ponytail` de `vegetation.ts:37`): +draw calls posibles, −triángulos; el arnés decide si compensa (umbral: si en baja no bajan los triángulos ≥ 30 %, se deja como está).
- **Coste baja:** +1 draw call (hierba), ~8 k briznas × 5 tri = 40 k triángulos, +6 ALU vértice.

### 5.4 Agua (`scene/water.ts`)
- Mismo quad (o 64×64/128×128 en media/alta para olas). `ShaderMaterial` con fog incluida.
- **Profundidad sin depth texture:** la textura de alturas (§5.3) da el fondo en cada punto → color poco hondo/hondo del look, transparencia mayor en bajíos. **[D]** Leer el depth buffer obliga a otro pase; la altura ya la tenemos.
- **Espuma:** franja donde profundidad < 0,4 m con ruido animado; en las aguas bravas (ya marcadas en `shared`) espuma extra, para que el peligro se vea mejor que hoy.
- Reflejo: fresnel hacia el color del cielo del look + brillo especular del sol (Blinn, 1 potencia). Sin reflexión real.
- Olas (media/alta): 2 ondas Gerstner pequeñas (amplitud 0,15 m, **solo visual**; el nivel del agua de la física no cambia).
- Bajo el agua: tinte de pantalla (div HTML con color del look y opacidad) + niebla corta azul verdosa. Alta: cáusticas en el terreno bajo el agua (patrón en el shader del terreno, 5 ALU, solo si y < nivel).
- Lago Negro y lagos helados: el mismo shader con otros colores y sin olas.
- **Coste baja:** 0 draw calls nuevos, ~10 ALU en píxeles de agua.

### 5.5 Puntos de brillo (luz sin luces)
- Uniform `glow[8]` (posición, radio, color) con las 8 fuentes más cercanas: fogatas, farol, braseros, lámparas de los puestos, llama de la cima, el Corazón. El terreno, la hierba y los actores suman `color * (1 - d/r)²`. 8 iteraciones en píxel: ~10 ALU en baja → en baja solo 4. **[D]** Da noches oscuras con islas de luz sin coste de luces reales.
- La linterna/farol del jugador (si existe más adelante) usa la misma ranura 0.

### 5.6 Vida ambiente (`scene/ambient.ts`)
Todo decorativo, sin red, sin colisión, sembrado por posición + hora.
- **Pájaros:** bandadas de 12 quads con ala batiendo en el vértice, siguiendo una curva de Lissajous sobre el bosque/Costa; 1 `InstancedMesh`. De noche no hay.
- **Luciérnagas:** puntos (`Points`, tamaño en pantalla fijo, aditivo, `fog: false`) cerca del jugador en bosque/Pantano de noche; flotan en el vértice. 1 draw call.
- **Peces bajo el agua** (alta): 20 quads nadando en círculos en la Costa, visibles al bucear.
- **Cangrejos:** 10 quads en la arena de la Costa, corren de lado si el jugador se acerca a <4 m (en CPU, 10 posiciones).
- **Partículas por bioma:** hojas (bosque, otoño no), ceniza (Tierras), mosquitos (Pantano), nieve suelta (Montañas): el sistema de `weather.ts` generalizado (una nube de puntos que sigue al jugador; baja 200, media 400, alta 600).
- **Tela y letreros al viento:** el toldo de los Puestos y la tela del planeador usan el mismo parche de viento.
- **Coste baja:** +3 draw calls (pájaros, luciérnagas, partículas), <2 k triángulos.

### 5.7 Terreno
- Color por vértice actual → **triplanar barato** solo en media/alta: 2 texturas procedurales (ruido de detalle en escala de grises, 256², generadas en canvas) multiplicadas sobre el color de vértice para ruptura a corta distancia. Baja: color de vértice + ruido en el vértice (0 texturas). **[D]**
- Nieve por altura y pendiente, arena mojada, barro y senderos: reglas en el shader leyendo altura, normal y la máscara. Los colores vienen del `BiomeLook`.
- Mismas mallas y segmentos que hoy. **No cambia la geometría** (la física se calcula en `shared` y no se toca).

## 6. Criaturas y monturas

### 6.1 Procedurales (sin descarga)
Cada una: **1 malla low-poly** construida en código (lathe + extrusiones fusionadas, `mergeGeometries`), colores por vértice, **"huesos falsos" en el shader**: cada vértice lleva un atributo `part` (0 cuerpo, 1–4 patas, 5 cola, 6 cabeza, 7 aleta) y el shader lo rota por un ángulo del uniform `pose[8]` según el paso. 1 draw call por criatura, sin `SkinnedMesh`.

| Criatura | Hoy | Nuevo | Triángulos | Movimiento |
|---|---|---|---|---|
| Ciervo | cajas | cuello largo, astas ramificadas, 4 patas finas | ≤ 900 | trote/galope (fase de patas), cabeza que sube y baja, corcoveo al domar |
| Pez gigante | cajas | cuerpo en lathe, aletas planas, boca | ≤ 500 | ondulación en S por la cola |
| Rana | cajas | cuerpo ancho, ojos saltones, patas traseras plegadas | ≤ 700 | pliegue/extensión de patas en el salto, garganta que late |
| Ballena | cajas | lathe grande, aleta caudal, lomo con percebes (color) | ≤ 1 200 | ondulación lenta, chorro (partículas del sistema de clima) |
| Estrella, dragón | papel/lo que haya | **sin cambio** (papel = pilar; el dragón ya es malla propia) | — | — |

El Tragón, la Estrella y cualquier montura que sea un dibujo siguen siendo `PaperActor`.

### 6.2 Enemigos que hoy son el zorro
- **Material por tipo** (compartido por todos los de ese tipo, no clonado por instancia): lobo = zorro gris frío; bruto marchito = marrón morado + escala 1,8; reforzado = negro con vetas moradas (emisivo débil) 2,4; escudado = + tabla azul; de roca = gris piedra + losa; bestia de ceniza = gris ceniza + chispas. +1 material por tipo visible (sin draw calls extra: cada zorro ya es su draw call).
- **Aviso de carga** del bruto reforzado: marca en el suelo (anillo rojo, ya existe el patrón del Zancudo). No cambia tiempos.
- Reemplazo real por modelos → §9 (drop-in).

### 6.3 Papel (los dibujos)
- El shader del papel recibe el color del sol/hemisférica del look (hoy es plano), sombra en disco y un **borde blanco de papel** de 2 px (dilatación del alfa en el shader) que se lee en cualquier fondo. En baja, sin borde. Nada más: no se vuelven 3D en #2.
- El Buhonero deja de ser el Tragón teñido: ninguno nuevo en #2 (es un dibujo pendiente de los sobrinos; cartel "dibujo pendiente" en el HANDOFF).

### 6.4 Animaciones que faltan (poses procedurales)
Sin clips nuevos. `actor.ts` mezcla el clip base con **ajustes de hueso por código** después de `mixer.update` (el robot tiene huesos con nombre: `Torso`, `Head`, `UpperArm.L/R`, `LowerArm`, `UpperLeg`, `LowerLeg`, `Hand`). **[D]** Reutiliza el rig; si Gabriel suelta clips reales (§9) se usan esos.

| Anim | Base | Ajuste procedural |
|---|---|---|
| roll | `Jump` pausado a mitad | el grupo raíz gira 360° en X en la duración del rodar (0,45 s), rodillas y brazos pegados; polvo al empezar |
| block | `Idle` | brazos cruzados delante del pecho (rotaciones fijas), torso inclinado 10°, tabla/escudo si lo hay |
| bow | `Idle` | brazo izq. extendido al frente, der. atrás a la altura de la cara; al soltar, der. se abre 0,15 s |
| climb | `Walking` lento | torso inclinado 25° hacia la pared, brazos alternando arriba (seno de la fase de paso) |
| glide | `Jump` pausado | brazos en cruz, piernas juntas atrás, tela = malla de 2×4 segmentos con el parche de viento (no un cono) |
| slide | `Jump` pausado | cuerpo tumbado (raíz −80° en X), brazos adelante, chispas de nieve detrás |

Coste: ~12 rotaciones de hueso por jugador por fotograma en CPU. Nada en GPU.

## 7. Gamas: detección y ajuste
- **Primera partida:** gama por pistas (como hoy) → en los primeros 4 s tras entrar al mundo, medir el tiempo de fotograma medio (sin contar los 20 primeros fotogramas). Si > 33 ms en media/alta → bajar un escalón y guardar; si < 12 ms en baja con táctil → proponer "¿Probar gráficos Media?" una vez (no cambia solo hacia arriba). **[D]** Bajar solo es seguro; subir solo puede calentar el teléfono.
- **Durante el juego:** si la media de 10 s está bajo 24 fps, primero `pixelRatio × 0,85` (hasta 0,7 en baja), luego avisar "Bajé los gráficos" y bajar gama. Nunca más de un cambio por minuto.
- Elección manual en el Menú sigue mandando y desactiva lo automático.
- `TierSettings` gana campos: `grassRadius`, `grassPerChunk`, `waterGrid`, `clouds`, `stars`, `heightFog`, `glowPoints`, `ambient`, `particles`, `triplanar`, `shadowRadius`. Todo en `quality.ts`, con test de que baja ≤ media ≤ alta.

## 8. Arnés de rendimiento (regresión)
- `scripts/perf/run.mjs` (fuera del bundle). Arranca `vite preview` + el worker local (`wrangler dev`, como el bot test), abre **Chromium headless** de Playwright (instalado en un dir de trabajo aparte: `npm i playwright` en `scratch/perf`, `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`), entra al mundo `test` con un jugador de pruebas y, con un **hook de depuración** (`?perf=1` expone `window.__perf` solo en builds de desarrollo), coloca la cámara en un **recorrido fijo**: 6 paradas por bioma (bosque, Costa, bajo el agua, Pantano, Montañas, Tierras, Tierras purificadas simuladas, una mazmorra), a mediodía y a medianoche, en las 3 gamas.
- En cada parada, tras 30 fotogramas: `renderer.info.render.calls`, `.triangles`, `.points`, `renderer.info.memory.{geometries,textures}`, programas compilados. **No mide FPS** (SwiftShader no es un móvil); mide lo que sí es determinista.
- Salida: `perf-report.json` + tabla en consola; compara con `scripts/perf/baseline.json` y **falla si alguna cifra pasa el presupuesto de §3 o sube > 10 % sobre la base** sin actualizarla con `--update`.
- Captura PNG por parada en `scratch/perf/shots/` (para mirar el look, no se sube al repo).
- No entra en `npm test` (tarda y necesita navegador): script `npm run perf`. Cada plan de #2 lo corre antes de terminar y pega la tabla en el HANDOFF.
- Móvil real: Gabriel prueba con `?fps=1` (contador en pantalla, ya útil sin arnés) en su teléfono y los de los sobrinos; la lista de qué mirar va al HANDOFF de cada plan.

## 9. "Suelta y listo": paquetes para bajar después
No bloquean nada. El cargador (`actors/models.ts`) prueba `public/models/<nombre>.glb`; si no está, usa el procedural/el zorro. Cada archivo nuevo se anota en `public/models/CREDITS.md`.

| Para | Paquete | Licencia | Dónde va | Notas |
|---|---|---|---|---|
| Ciervo, lobo, zorro, animales | **Quaternius — "Ultimate Animated Animals"** (quaternius.com) | CC0 | `public/models/deer.glb`, `wolf.glb` | trae Idle/Walk/Gallop/Attack/Death; exportar a glb, ≤ 3 k tri |
| Enemigos comunes (brutos) | **Quaternius — "Ultimate Monsters"** | CC0 | `public/models/brute.glb`, `brute-rock.glb`, `brute-ash.glb` | mismo esqueleto por monstruo; elegir 3 |
| Peces, ballena | **Quaternius — "Fish Pack"** / "Ultimate Animated Animals" (ballena si la trae) | CC0 | `fish.glb`, `whale.glb` | si no hay ballena, se queda el procedural |
| Rana | **Quaternius — "Ultimate Animated Animals"** (Frog) | CC0 | `frog.glb` | |
| Jugador con más animaciones | **Quaternius — "Universal Animation Library"** / "Ultimate Modular Characters" | CC0 | `player.glb` (sustituye `robot.glb`) | trae Roll, Block, Bow, Climb… → quita §6.4; rehacer tintes y sombreros sobre la nueva malla (plan aparte, no #2) |
| Plantas, rocas, flores | **Kenney — "Nature Kit"** (kenney.nl) o **Quaternius — "Ultimate Nature Pack"** | CC0 | `public/models/nature/*.glb` | fusionar a 1 geometría por especie; ≤ 300 tri por árbol en baja |
| Aves | **Quaternius — "Animated Birds"** / Kenney | CC0 | `bird.glb` | solo alta; baja sigue con quads |
| Texturas de detalle | **ambientCG** (ground, rock, sand; 1K) | CC0 | `public/textures/` | solo alta; baja/media siguen procedurales |

Reglas: nada con licencia NC ni "solo uso personal"; CC-BY solo con crédito en `CREDITS.md` y en la pantalla de créditos; cada `.glb` ≤ 1 MB tras `gltf-transform optimize` (npm, disponible aquí).

## 10. Lo que no se cambia
- Geometría de colisión, alturas, nivel del agua de la física, zonas, protocolo, servidor, balance, tiempos de ataque/aviso.
- Los dibujos siguen de papel. El dragón y la torre mantienen su forma.
- La interfaz HTML y los controles (eso es #7).

## 11. Idea de Claude: el mundo sana a la vista
- Hoy limpiar una Raíz-madre cambia un estado pero el suelo sigue igual casi siempre. Con `corrupt[i]` (§4) cada zona tiene un valor 0..1 en el shader de terreno, hierba, árboles y agua.
- Al limpiar una zona (evento que el cliente ya recibe), el valor baja de 1 a 0 en 20 s **como una ola** desde la raíz (el shader compara la distancia a la raíz con un radio que crece), con un anillo de flores blancas (hierba con punta blanca) en el frente de la ola y un golpe de luciérnagas.
- Al caer El Marchito ("todas las raíces se secan a la vez") las 22 zonas y las Tierras hacen la ola a la vez, y las Tierras pasan al look **Purificado** en 60 s.
- Coste: un `uniform vec4 zones[22]` (x, z, radio, valor) + un bucle de 22 en el vértice (no en el píxel). 0 draw calls, 0 mallas nuevas, 0 red.

## 12. Fuera de alcance
- Convertir dibujos a 3D (pipeline IA, #5), nuevos personajes jugables, ropa/tinte sobre un modelo nuevo.
- Reflejos reales, SSAO, bloom, postproceso de color en baja/media, WebGPU.
- Ciclo de estaciones, clima nuevo fuera de las Montañas (salvo partículas de ambiente).
- Sonido ambiente (va con #7), audio de pájaros.
- Interiores de mazmorra: solo heredan niebla/brillos; no se rediseñan.
- Pruebas en dispositivos reales automatizadas.

## 13. Riesgos
| Riesgo | Mitigación |
|---|---|
| `onBeforeCompile` se rompe al actualizar three.js (0.185) | Un solo módulo `patches.ts` con los trozos de shader; test que compila cada material en un contexto headless del arnés; fijar la versión menor de three. |
| Móviles viejos sin texturas float en el vértice | Detectar `MAX_VERTEX_TEXTURE_IMAGE_UNITS`/float; si falta, hierba con altura por instancia de trozo (menos precisa) y agua sin profundidad (color fijo). |
| Noches demasiado oscuras para niños de 10 | Rim de luna en actores, brillo mínimo de 0,08, deslizador "brillo nocturno" en el Menú. |
| La hierba tapa recursos o avisos | Máscara bajo estructuras y recursos; los avisos del suelo se dibujan encima (`depthTest` off como hoy). |
| El arnés no refleja el móvil | Mide llamadas/triángulos (deterministas), no FPS; FPS lo da `?fps=1` en teléfono real con Gabriel. |
| Frustum culling por regiones sube draw calls | El arnés decide con el umbral de §5.3. |
| Poses procedurales se ven raras | Cada una con parámetros en una tabla; captura PNG del arnés por pose para revisión. |
| Muchas mezclas de look por bioma = saltos | Mezcla en 30 m y en el tiempo (1 s) al teletransportar. |

## 14. Mapa de planes
| Plan | Contenido | Sale con |
|---|---|---|
| **V2-A** Arnés y gamas | `npm run perf`, hook `?perf=1`, `?fps=1`, baseline de hoy; nuevos campos de `TierSettings`; prueba de FPS y bajada automática. | Tabla "hoy" por bioma y gama; sin cambio visual. |
| **V2-B** Cielo, luz y niebla | `BiomeLook` + tabla por bioma/hora, cúpula con sol/nubes/estrellas, niebla por altura, noches oscuras, puntos de brillo, discos de sombra en baja. | El ciclo día/noche y cada bioma con su luz. |
| **V2-C** Terreno, hierba y viento | Textura de alturas/biomas/máscara, hierba por trozos en todos los biomas, viento en hierba/copas/toldos, colores de suelo, nieve/arena/barro/senderos, culling por regiones, `corrupt[i]` + la ola (Idea de Claude) + look Purificado. | El mundo "vivo" y la sanación visible. |
| **V2-D** Agua y vida ambiente | Shader de agua (profundidad, espuma, olas, fresnel, bajo el agua, cáusticas), pájaros, luciérnagas, cangrejos, peces, partículas por bioma. | Costa y Pantano con su agua; vida en todos los biomas. |
| **V2-E** Criaturas y animaciones | Ciervo, pez, rana y ballena procedurales con huesos falsos; material por tipo de enemigo; marca de carga; poses de roll/block/bow/climb/glide/slide; luz en el papel; cargador "suelta y listo" con fallback. | Adiós a las cajas y los clips reciclados. |

Cada plan: TDD en lo puro (looks, gamas, poses, sembrado), arnés al final con la tabla en el HANDOFF, y "Qué probar" para Gabriel en teléfono.
