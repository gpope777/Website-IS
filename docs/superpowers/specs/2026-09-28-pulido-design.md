# Bosque — Subproyecto #7: Pulido (con el tutorial)

> **Decidido por Claude — revisar** (Fase 3 del HANDOFF: lo más simple que respete la visión; móvil primero; rejilla táctil ≤10; voz seca en español; **sin cambios de balance** salvo la lista corta del §10.2):
> - **Sonido 100 % procedural (WebAudio), cero descargas.** Desde el contenedor solo llega `registry.npmjs.org` (200); freesound, kenney, opengameart y jsDelivr no. Un sintetizador de efectos al estilo zzfx (**escrito aquí, ~150 líneas**, sin dependencia: zzfx está en npm pero son 1 KB que conviene poder retocar) + ambiente por bioma con ruido filtrado. La música es una **lista de "suelta y listo"** (§4.6): si existe `/audio/<bioma>.ogg`, suena; si no, silencio. **[D]**
> - **Un único mensaje nuevo de protocolo** (`PROTOCOL_VERSION` 62 → 63): un campo opcional `fx` en el snapshot con los golpes de los últimos 100 ms (`{ id, dmg, crit? }`), para que el impacto (parpadeo, número, hit-stop) salga en el golpe de verdad y no en una adivinanza del cliente. Todo lo demás (sacudida, sonido, rastreador, tutorial) es cliente. **[D]**
> - **Hit-stop solo del lado del cliente y solo en tu golpe** (60 ms normal, 110 ms en parada o golpe final): congela la animación y la cámara, nunca la simulación ni la red. **[D]**
> - **Sacudida de cámara con ajuste** (Normal / Suave / Nada; por defecto Suave en móvil, Normal en PC). **[D]**
> - **Números de daño: no.** En su lugar, la barra del enemigo aparece 3 s sobre él tras el primer golpe y un parpadeo blanco. Números = ruido en pantalla de móvil y el juego no va de optimizar cifras. **[D]**
> - **El Menú se parte en pestañas**: Jugar · Viajes · Libro · Ajustes · Ayuda. La pared de texto actual pasa a **Ayuda**, dividida por tema y **solo con lo ya descubierto** (no destripa lo que falta). **[D]**
> - **Ajustes nuevos, por dispositivo (`localStorage`)**: volumen general / efectos / ambiente / música, silencio, sacudida, tamaño de texto (Normal / Grande), marcas para daltónicos (forma además de color), vibración (móvil), calidad gráfica (ya existía). **[D]**
> - **"Qué sigue" (rastreador de objetivo)**: una línea fija arriba a la izquierda con **el siguiente paso de la historia** y rumbo + distancia ("→ Santuario del Bosque · 120 m NE"). Se calcula en el cliente con una función pura sobre el estado que ya llega. Resuelve lo de que el contenido nuevo "no se ve" en los primeros minutos. **[D]**
> - **Tutorial al final (P7-F), para un jugador nuevo en móvil**: 8 pasos cortos que se enseñan **haciendo** (no pantallas de texto), saltables, por jugador y guardados en el servidor (campo opcional `tut`), que **nunca aparecen a quien ya tiene progreso**. **[D]**
> - **Singular/plural y textos**: una función `qty(n, item)` en `src/shared/names.ts` y un barrido de todos los textos con cantidades ("1 perla", "3 perlas"). **[D]**
> - **Idea de Claude: "El eco del bosque"** (§9) — al entrar, una tarjeta de 3 líneas con lo que **los demás** hicieron mientras no estabas ("Bea limpió 2 zonas del Pantano · Leo domó la rana · Tu puesto vendió 4 veces"). Para un mundo compartido que duerme, es lo que hace notar que algo cambió.

**Date:** 2026-09-28
**Status:** Draft, decidido autónomamente (Fase 3). Sin código ni planes todavía.
**Builds on:** `2026-09-26-bosque-online-design.md` (visión, roadmap #7 "Polish: game feel, combat impact, sound, UI, onboarding"; Gabriel + sobrinos de 12 y 10, **casi siempre en móvil**; "desafiante, no infantil"), `HANDOFF-aventura.md` (todo lo marcado "revisar", "queda para pulido" y "NO verificado"), `2026-09-27-visuales-design.md` (presupuestos por gama, "suelta y listo").
**Rule:** simplest option that respects the vision. Every choice is marked **[D]** with a one-line reason. **Nada de #7 cambia reglas, daño, vida ni tiempos de juego** salvo §10.2. `PROTOCOL_VERSION` sube una vez (63) en P7-A y una vez (64) en P7-F.

---

## 1. Qué hay hoy (inventario del cliente, `aventura/resto` tras #2)

| Pieza | Estado | Dónde |
|---|---|---|
| HUD | 3 barras (❤️ 🍖 🔥) + 🌳 Corazón; una línea de mochila ("Rango 3 · Madera 12 · Perlas 3 · Arma +2"); log de toasts (6 s, se apilan sin tope); banner de red; línea de aviso (prompt "E · Entrar en…"); 3 líneas de asedio / carrera / jefe; anillo de aliento; anillo de doma; tarjeta de visión con ✕. Todo en DOM. | `src/client/hud.ts` (288 l.), `style.css` |
| Menú | **Un panel largo**: ~12 párrafos de ayuda con teclas de PC (E, Q, Z, R, X, H, J, T, Y, U, I…) mezclados con viajes de fogata, llamadas de montura, asedios, Puesto, Puestos, Libro, Oficios, Aspecto, Trampa, Cambiar cámara, Salir, selector de calidad. Todo visible aunque no lo hayas descubierto (destripa la historia). | `hud.ts: showMenu` |
| Pantallas del Menú | Libro, Oficios, Aspecto, Puestos, panel del Puesto, Cambiar, Buhonero: HTML en el mismo `overlay`. | `book-ui.ts`, `skills-ui.ts`, `look-ui.ts`, `stall-ui.ts`, `trade-ui.ts`, `merchant-ui.ts` |
| Táctil | Stick izquierdo, arrastre derecho = cámara, **A** (acción) y **B** (saltar) grandes, **10 pastillas** (🫐 comer, 🔥 fogata, 🧱 muro, 🌳 corazón, 🗡️ trampa, 🌀 rodar, 🛡️ bloquear, 🏹 arco, 🎯 fijar, 🌿 poder — mantener 0,5 s cambia), botón MENÚ. Las 10 salen siempre, desde el minuto 0. | `src/client/touch.ts` (312 l.) |
| Teclado | Teclas por acción (lista arriba); C cámara; ayuda solo en el Menú. | `input.ts` |
| Cámara | Órbita a 4,5 m, primera persona con C / Menú, se aleja ×2,4 volando el dragón, choca solo con el terreno (no con muros ni rocas). Sin sacudida salvo "el ciervo corcovea". Sin suavizado al fijar objetivo. | `camera-rig.ts` (45 l.), `game.ts:2067` |
| Impacto | **Ninguno en los golpes a enemigos**: el protocolo no dice cuándo un golpe acierta (`WolfAnim` no tiene "herido"; `hit` es solo para estructuras). Destellos: rango (esfera verde), rayo (blanco en el aviso), papel azul "expuesto". | `protocol.ts:16`, `game.ts:691` |
| Recibir daño | Solo baja la barra; nada en pantalla. | — |
| Muerte | Panel "Has caído" + cuenta de "Un compañero puede levantarte: N s" + Reaparecer. | `hud.ts: showDeath` |
| Sonido | **No existe.** Ni un `AudioContext`, ni un archivo. | — |
| Ajustes | Solo la calidad gráfica (`localStorage`) y la cámara. | `quality.ts` |
| Textos | En español, repartidos entre `names.ts` (121 nombres), `hud.ts`, los `*-ui.ts` y el servidor (toasts). Plural fijo: `ITEM_LABELS.pearl = "Perlas"` → **"1 perlas"** en estantes, ventas, Buhonero, Encargos. | `src/shared/names.ts`, `items.ts:7` |
| Orientación | Haces de luz de santuario; visiones de entrada por bioma; nada que diga "qué toca ahora". El Libro cuenta, no guía. | — |
| Onboarding | Ninguno. Un jugador nuevo aparece con 10 pastillas, un Menú-muro y ningún objetivo. Observación de playtests anteriores: **en los primeros minutos no se nota que haya nada nuevo** (los sobrinos no vieron que el juego había cambiado). | — |

**Red (2026-09-28):** `registry.npmjs.org` 200 (`zzfx` existe); `freesound.org` rechazado por el proxy; el resto de sitios de recursos, como en #2, sin respuesta.

## 2. Pilares

1. **Se siente en el pulgar.** Cada golpe, bloqueo, parada, daño recibido y muerte tiene respuesta visible **y** audible en < 1 fotograma de red.
2. **El móvil manda.** Texto legible a 360 px de ancho, nada importante bajo los pulgares, ningún efecto que cueste > 1 draw call o > 0,5 ms en gama baja.
3. **Decir qué toca, no cómo hacerlo todo.** Un objetivo a la vista siempre; la ayuda aparece cuando la mecánica aparece.
4. **Nunca frenar al que ya sabe.** El tutorial y los avisos se saltan con un toque y no vuelven.
5. **Seco y claro.** Frases cortas, sin exclamaciones de dibujos animados. "Bloquea justo antes del mordisco." no "¡¡Genial, lo hiciste!!".

## 3. Sensación de juego (P7-A)

### 3.1 Evento de golpe (único cambio de protocolo de P7-A)
- `snap.fx?: { id: number; dmg: number; kind: 'hit' | 'parry' | 'kill' | 'block'; by?: string }[]` con lo que pasó desde el último snapshot, **solo a jugadores a ≤ 40 m**. Opcional: un cliente viejo lo ignora. **[D]** Un evento aparte por golpe duplicaría mensajes; ir en el snap no añade envíos.
- `me.hurt?: number` en el propio jugador: daño recibido en ese tick (0 si nada). **[D]** Hoy el cliente solo ve bajar la barra y no sabe si fue hambre o mordisco.

### 3.2 Qué pasa en pantalla
| Evento | Visual | Hit-stop | Cámara | Vibración |
|---|---|---|---|---|
| Tu golpe acierta | Enemigo parpadea blanco 80 ms (`emissive`, sin material nuevo); papel: se aplasta 10 % | 60 ms | empujón 0,05 m hacia delante | 15 ms |
| Tu golpe final | Parpadeo + el enemigo sale despedido 0,6 m hacia atrás antes de caer (visual, solo cliente) | 110 ms | sacudida 0,12 | 30 ms |
| Parada | Anillo blanco que se expande desde tu escudo (1 plano, 0,25 s) + chispa | 110 ms | sacudida 0,15 | 40 ms |
| Bloqueo normal | Chispa pequeña | — | 0,05 | 10 ms |
| Flecha acierta | Parpadeo + la flecha queda clavada 1 s | — | — | — |
| Recibes daño | Borde rojo de pantalla 250 ms (CSS, proporcional al daño) + tu robot parpadea rojo | — | sacudida por daño (≤ 0,2) | 25 ms |
| Salud < 25 % | Borde rojo que late despacio (CSS) + latido de audio | — | — | — |
| Golpe de amigo (a ≤ 40 m) | Parpadeo del enemigo, sin hit-stop ni sacudida | — | — | — |
- **Barra de vida flotante** sobre un enemigo corriente durante 3 s tras cada golpe (un sprite con dos quads, reutilizado de un pool de 4). La vida sale del `dmg` acumulado sobre `ENEMY[kind].hp` (el cliente ya conoce la tabla). Jefes siguen con su barra de arriba. **[D]** Sin números de daño (ver bloque de arriba).
- **Hit-stop** = `mixer.timeScale = 0` del enemigo tocado y del propio robot + cámara congelada; la interpolación sigue corriendo por debajo y se pone al día. **[D]**
- **Sacudida**: ruido suave (dos senos desfasados) con caída exponencial, sumado **después** de `CameraRig.apply`; escalado por el ajuste (Normal 1, Suave 0,4, Nada 0). La del ciervo corcoveando pasa por lo mismo.
- **Vibración**: `navigator.vibrate` si existe y el ajuste está activo (iOS no la tiene: se ignora).

### 3.3 Cámara
- **Choque con muros, rocas y pilares** (no solo con el terreno): un rayo contra los `colliders` ya cargados, acercando la cámara con suavizado. **[D]** Es la queja más típica en tercera persona dentro de bases y mazmorras.
- **Objetivo fijado (🎯)**: la cámara gira suave (τ 0,15 s) para dejar al enemigo en el tercio superior; soltar devuelve el control al instante.
- **Mazmorras**: distancia 3,5 m en vez de 4,5 (salas pequeñas).
- **Primera persona** sin cambios.
- Sensibilidad de cámara en Ajustes (0,5×–2×). **[D]**

## 4. Sonido (P7-B)

### 4.1 Motor
- `src/client/audio/synth.ts`: un generador de efectos con parámetros al estilo zzfx (forma de onda, ataque/sostén/caída, barrido de frecuencia, ruido, filtro, trémolo). Cada efecto = una fila de números en `audio/sfx.ts`. Se renderiza **una vez** a `AudioBuffer` al arrancar (≈ 40 efectos × ≤ 0,6 s, < 2 MB de memoria) y luego se reproduce con variación aleatoria de tono ±6 %. **[D]**
- `AudioContext` se crea en el **primer toque** (regla de iOS/Chrome). Buses: `master → [sfx, ambient, music, ui]` con `GainNode`. Sonidos posicionados (enemigos, amigos, explosiones) con un `StereoPannerNode` + atenuación por distancia (≤ 40 m), no `PannerNode` HRTF (caro en móvil). **[D]**
- Tope de 12 voces simultáneas; el más viejo de la misma clase se corta.
- Coste medido en el arnés de rendimiento: ≤ 0,3 ms/fotograma en gama baja.

### 4.2 Efectos por acción (≈ 40)
| Grupo | Efectos |
|---|---|
| Jugador | paso (hierba / arena / roca / nieve / agua, por bioma y altura), salto, aterrizaje, rodar, golpe al aire, golpe que acierta, golpe final, flecha (tensar / soltar / clavar), bloquear, **parada** (metálico agudo), recibir daño, caer, levantarse, planeador (viento que sube), trepar (agarre), nadar, tobogán |
| Poderes | Enredadera (crujido que crece), Viento (ráfaga), Fuego (llamarada), Piedra (golpe grave + polvo) |
| Mundo | talar, picar, coger bayas, construir, muro roto, cofre, orbe de santuario (campanilla ascendente), zona limpia (acorde largo), fogata encendida, viaje |
| Enemigos | lobo (gruñido corto, aviso de mordisco = sonido **antes** del golpe, igual que el aviso visual), bruto (carga), rayo (zumbido antes de caer), papel (roce de papel en jefes y dibujos) |
| Monturas | doma (tic por ronda, acierto, fallo), galope |
| UI | toque de botón, abrir/cerrar Menú, toast, rango nuevo, Proeza, venta, "no puedes" (sordo, corto) |
| Avisos | atardecer / asedio (cuerno), El Marchito aparece (risa = acorde disonante), latido de vida baja |
- **Los avisos de ataque suenan siempre**, aunque el enemigo esté fuera de cámara: es jugabilidad, no adorno (pilar 4 de #2: nada tapa un aviso).

### 4.3 Ambiente por bioma
Ruido rosa filtrado + pequeños sucesos aleatorios, **mezclado por distancia al borde del bioma** (fundido de 20 m):
Bosque (hojas + pájaros de día, grillos de noche) · Costa (olas en bucle con la marea) · Pantano (ranas, burbujas, zumbido) · Montañas (viento que sube con la altura y la tormenta) · Tierras Corruptas (grave que late; se vuelve bosque tras el final) · Mazmorras (reverberación con un `ConvolverNode` de impulso sintético, una por partida) · Lluvia/tormenta (ruido + truenos con el rayo del cielo).

### 4.4 Música
Sin música por defecto. **"Suelta y listo"**: si existen `/audio/musica-<bioma>.ogg`, `/audio/musica-asedio.ogg` o `/audio/musica-jefe.ogg` (HEAD como en `loadDropIns`), suenan en bucle con fundido de 3 s. **[D]** Música procedural mediocre cansa en 10 minutos; silencio + ambiente es mejor que eso.

### 4.5 Ajustes de sonido
General, Efectos, Ambiente, Música (0–100), **Silencio** (tecla `.` —la M ya es montar— y un botón 🔇 en el Menú). Se silencia solo al ocultar la pestaña (`visibilitychange`).

### 4.6 Lista "suelta y listo" (música, CC0/CC-BY, que Gabriel baja cuando quiera)
Pistas en bucle de OpenGameArt / Kevin MacLeod (incompetech, CC-BY) / Tallbeard Studios "Music Loop Bundle" (CC0) — una tranquila por bioma, una de asedio, una de jefe. Formato `.ogg` 96 kbps, ≤ 1,5 MB cada una (≤ 11 MB en total). Créditos en la pantalla final si son CC-BY.

## 5. UI / UX (P7-C)

### 5.1 HUD en móvil
- **Arriba izquierda**: barras en columna con icono **y** forma (❤️ corazón, 🍖 muslo, 🔥 llama) — ya lo son; se añade el número solo cuando < 50. El 🌳 del Corazón solo durante un asedio o si está dañado.
- **Arriba centro**: la línea de "Qué sigue" (§7) — una línea, 14 px, se atenúa al 40 % tras 8 s sin cambios y vuelve al tocarla.
- **Arriba derecha**: jefe / asedio / carrera (una sola línea a la vez, prioridad jefe > asedio > carrera).
- **Mochila**: fuera de la pantalla fija. Pasa a un botón 🎒 junto a MENÚ que abre la mochila (rejilla de 7 materiales con icono y número, arma, Capa, Rango). La línea de texto de hoy se come media pantalla en móvil. **[D]**
- **Toasts**: máximo 3 visibles, el más nuevo arriba, 4 s, repetidos se agrupan ("Madera +1 ×3"). Los de recoger recursos van a un contador flotante pequeño junto al robot en vez de al log. **[D]**
- **Zona segura**: `env(safe-area-inset-*)` en todo el HUD (muescas de iPhone).
- **Pastillas**: **se muestran según lo que tienes** — 🌿 poder solo con un poder, 🌳 corazón solo si no tienes uno, 🗡️ trampa solo con Corazón puesto, 🏹 🎯 🛡️ 🌀 desde el primer lobo visto (o tras el paso de combate del tutorial). Nunca más de 10, mismas posiciones fijas (hueco vacío, no reordenar: la memoria del pulgar manda). **[D]**
- Pastillas a **52 px** mínimo (hoy más pequeñas en 360 px); A y B a 76 px.

### 5.2 Menú con pestañas
`Jugar` (Seguir, Viajes y llamadas de montura si hay, Trampa, Asedios si junto al Corazón, Poner/Recoger puesto, Puestos) · `Libro` (Libro → Oficios, Aspecto) · `Ajustes` (§6) · `Ayuda` (§5.3) · `Salir` (con confirmación). Pestañas arriba, 44 px de alto. El Menú recuerda la última pestaña. **[D]**

### 5.3 Ayuda
Tarjetas por tema (Moverse, Pelear, Poderes, Monturas, Corazón y asedios, Santuarios y zonas, Tiendas), **cada una solo si ya la has visto** (misma bandera que el paso del rastreador o del tutorial). Cada tarjeta enseña los controles **del dispositivo en uso**: iconos de pastilla en táctil, teclas en PC. **[D]**

### 5.4 Textos
- `qty(n, item)` en `names.ts`: "1 perla / 3 perlas", "1 espina negra / 2 espinas negras", "1 baya", "1 ámbar / 2 de ámbar", "1 cuarzo / 2 cuarzos". Reemplaza `ITEM_LABELS` en estantes, ventas, Buhonero, Encargos, toasts del servidor, costes ("8 madera, 4 piedra") y la mochila. Un test barre todos los textos con cifra + material.
- Barrido de voz: quitar "!" sobrantes, unificar "E / A" (mostrar solo la del dispositivo: "A · Entrar" en táctil, "E · Entrar" en PC), nombres por `NAMES`.
- La llamada desde la Ceniza dice "ciervo" aunque tengas la Estrella → nombre de la montura real (HANDOFF S5-H).

### 5.5 Accesibilidad
- **Tamaño de texto**: Normal / Grande (×1,25 en todo el HUD y los paneles vía una variable CSS).
- **Marcas para daltónicos**: lo que hoy se distingue solo por color (zonas moradas vs. limpias, estantes verde/gris, oficios, brotes del Marchito por color, rayas de aviso moradas, anillo de doma amarillo) recibe **además forma o patrón**: brotes con icono sobre ellos (▲ ● ■), avisos de ataque con borde discontinuo, oficios con ✔ / 🔒. Activado por defecto (no molesta). **[D]**
- Contraste mínimo 4,5:1 en todo texto del HUD (sombra negra de 2 px sobre el mundo).
- Nada parpadea más de 3 veces por segundo.

### 5.6 Muerte
Panel más limpio: "Has caído." + causa ("Te mordió un lobo", "El Zarzal", "Frío") + cuenta atrás del compañero como barra + **Reaparecer** grande; el mundo sigue visible desaturado detrás (CSS `backdrop-filter` en media/alta, velo gris en baja).

## 6. Ajustes (pestaña del Menú)
| Ajuste | Valores | Por defecto |
|---|---|---|
| Calidad gráfica | Baja / Media / Alta / Auto | Auto (ya existe) |
| Volumen general, efectos, ambiente, música | 0–100 | 80 / 100 / 60 / 50 |
| Silencio | sí / no | no |
| Sacudida de cámara | Normal / Suave / Nada | Suave (táctil), Normal (PC) |
| Vibración | sí / no | sí |
| Sensibilidad de cámara | 0,5×–2× | 1× |
| Tamaño de texto | Normal / Grande | Normal |
| Marcas de forma | sí / no | sí |
| Mostrar "Qué sigue" | sí / no | sí |
| Consejos | sí / no | sí |
| Cámara | 3.ª / 1.ª persona | 3.ª |
| Repetir tutorial | botón | — |
Todo en `localStorage` (clave `bosque.settings`, JSON, con `try/catch`), por dispositivo. **[D]** Son preferencias del aparato (un niño juega en el móvil de su madre y en el PC).

## 7. "Qué sigue" — rastreador de objetivo (P7-D)

### 7.1 Qué muestra
Una línea: **icono + qué + dónde**. "🌳 Planta el Corazón (G / 🌳)" · "✨ Santuario del Bosque · 120 m ↗" · "🦌 Doma el ciervo del halo dorado · 80 m ←" · "🌀 Entra en la Raíz-madre · 200 m ↑". Tocarla abre la tarjeta de Ayuda del tema. Una flecha pequeña en el borde de la pantalla apunta al sitio cuando está fuera de vista (1 sprite).

### 7.2 Cómo sabe qué toca
`src/shared/guide.ts`: `nextStep(view): Step | null` — **función pura** sobre lo que el cliente ya recibe (poderes, monturas, `invasion*`, santuarios, cofres, zonas, pilares, `fogOpen`, `towerOpen`, `ending`, Corazón, Rango/puntos). Una lista ordenada de ~30 pasos que sigue la historia de los 5 biomas + post-juego; el primero que no está hecho gana. Si algún dato no llega hoy al cliente, se añade al `self` del snapshot como campo opcional **en el mismo bump 63**. **[D]** Nada de misiones en el servidor: la historia ya es lineal y el estado ya está.
- **Secundarios**, solo si no hay nada mejor cerca: "Tienes 1 punto de oficio" (→ Menú › Libro › Oficios), "Tu Caja tiene 12 bayas", "Luna llena esta noche". Máximo uno.
- **Co-op**: si un amigo conectado está en un paso más adelante del mundo (p. ej., el pez ya domado por otro), el paso del mundo cuenta como hecho; los pasos de jugador (tu orbe, tu montura) siguen siendo tuyos. Al lado: "(Bea está allí)" si un amigo está a ≤ 30 m del objetivo.

### 7.3 Lo nuevo, visible
- **Punto nuevo** (●) en la pestaña del Menú y en la pastilla que acaba de aparecer, hasta que la tocas.
- **Primera vez de cada mecánica** → un "consejo" de una línea bajo el rastreador durante 6 s ("Mantén 🌿 para cambiar de poder."), una vez por dispositivo, desactivable en Ajustes. ~25 consejos. **[D]**
- Junto con "El eco del bosque" (§9), cubre el hallazgo de que en los primeros minutos nadie notaba lo nuevo.

## 8. Tutorial (P7-F — lo último del subproyecto)

### 8.1 Quién lo ve
- **Solo** un jugador cuyo guardado está vacío de progreso (sin Corazón propio, sin orbes, Savia 0, `tut` ausente). Quien ya jugó nunca lo ve; en el guardado se pone `tut: 'skip'` al cargar si tiene cualquier progreso. **[D]**
- Guardado en el servidor como `SavedPlayer.tut?: number | 'done' | 'skip'` (opcional, protocolo 64): sigue al jugador entre móvil y PC.
- Botón **"Saltar tutorial"** siempre visible arriba a la derecha; "Repetir tutorial" en Ajustes (solo repite los consejos, no el mundo).

### 8.2 Los 8 pasos (≈ 10 minutos, en el mundo compartido, sin zona aparte)
Cada paso = una línea en el sitio del rastreador + una **mano/flecha fantasma** sobre el control real en táctil (o la tecla en PC). Avanza al **hacerlo**, no al leer.
1. **Mirar y andar** — "Arrastra a la derecha para mirar. Stick izquierdo para andar." (hasta andar 10 m y girar 90°). Solo stick, A y B visibles.
2. **Coger** — "A junto al arbusto. Bayas." Aparece 🫐. "🫐 para comer."
3. **Talar y picar** — "A en un árbol. A en una roca." (3 madera, 2 piedra).
4. **Fuego** — aparece 🔥. "La noche enfría. 🔥 pone una fogata (3 madera)."
5. **Corazón** — aparece 🌳. "Planta el Corazón. Es tu casa y lo que atacan de noche." Colocarlo dentro de ≤ 60 m del spawn.
6. **Pelear** — si es de día, un **lobo de práctica** (en el servidor: `kind: 'wolf'` normal marcado `tut`, 40 PV, pega 4, no huye, solo te persigue a ti) sale a 15 m. Aparecen 🌀 🛡️. "A para golpear. 🌀 esquiva. 🛡️ justo antes del mordisco: parada." Pide una parada o 2 esquivas; si fallas 3 veces, sigue igual (no bloquea). **[D]** Es el único paso con algo nuevo en el servidor.
7. **Arco y fijar** — aparecen 🏹 🎯. "🎯 fija. 🏹 dispara." Blanco: el mismo lobo o, si ya murió, un tocón con diana.
8. **Salir a explorar** — "¿Ves un haz de luz? Es un santuario." Se enciende el rastreador normal con "✨ Santuario del Bosque". Toast "Tutorial hecho." y `tut: 'done'`. 🧱 🗡️ 🌿 aparecen después, con su consejo, cuando toca (§5.1).

### 8.3 Co-op
- Si un amigo **veterano** está a ≤ 30 m, su pantalla muestra "Leo está aprendiendo. Paso 4/8." y el aprendiz ve "(Bea puede ayudarte)". Cada paso es de quien aprende (que el amigo tale no lo cuenta), pero los recursos que le pase sí sirven. **[D]**
- Dos aprendices a la vez: cada uno con su tutorial; el lobo de práctica es uno por aprendiz.
- El tutorial **nunca** pausa el mundo ni esconde nada a los demás.
- Si llega un asedio o la noche durante el tutorial, el paso actual espera y sale "Primero, aguanta." (no se retrasan las reglas del mundo).

### 8.4 Primer arranque (antes del tutorial)
La pantalla de entrada añade una línea: "Bosque. Juego cooperativo. Con auriculares se oye mejor." y el primer toque arranca el audio (§4.1).

## 9. Idea de Claude — "El eco del bosque"
Al entrar al mundo, si faltabas desde hace > 30 min de reloj real, una **tarjeta de 3 líneas** (en la tarjeta de visión, ✕ para cerrar, 6 s): lo más importante que hicieron **los demás** desde tu última salida — hitos del mundo (zonas limpias, jefes, Raíces-madre, monturas domadas, asedios aguantados, Rango de un amigo), más lo de tu Puesto (ya existe el aviso: se integra aquí). El servidor ya guarda casi todo con fecha de día de juego; se añade un **registro de 20 eventos** en memoria del DO con día + nombre (se pierde en un reinicio, y no pasa nada). **[D]** Además, los sitios que cambiaron llevan un brillo suave 1 minuto (una zona limpia, una fogata nueva). Esto hace ver que el mundo compartido se movió: la mitad de la gracia de "siempre encendido" que hoy nadie nota.

## 10. Bug-bash: lo que el HANDOFF dejó pendiente

### 10.1 Triaje
| Pendiente (HANDOFF) | Decisión |
|---|---|
| Plural fijo "1 perlas" (T6-A) | **Arreglar** (P7-C, `qty`) |
| Telón pintado de la Copa (S5-F/G) | **Arreglar** (P7-E): un cilindro con degradado + silueta del mapa pintada en canvas, 1 draw call |
| Raíces-madre como tocones blancos y Ceniza verde-gris tras el final (S5-G) | **Arreglar** (P7-E): color por uniform, ya hay "sanar a la vista" |
| Árbol-torre: sin luna en el cielo; la llamada dice "ciervo" con Estrella (S5-H) | **Arreglar** los dos: luna = disco en el cielo en luna llena; nombre de la montura real |
| Poses toscas (arco bajo, deslizar aproximado) (V2-E) | **Arreglar** números en `poses.ts` (sin clips nuevos) |
| Sombra de criaturas en pose quieta (V2-E) | **No arreglar** (coste de sombra con huesos en móvil; apenas se ve) |
| Robot de noche en la Costa = silueta negra (V2-B) | **Arreglar**: borde de luna también al jugador propio (+ 0,05 de emisivo de noche) |
| Cámara atraviesa muros y rocas | **Arreglar** (§3.3) |
| Pastilla 🎥 → 🌿 (A-E); cámara solo en C/Menú | **Mantener**; la cámara va a Ajustes |
| Menú destripa lo no descubierto | **Arreglar** (§5.3) |
| Casi nada visto en móvil real | **Arreglar con proceso**: la lista de prueba §12 es obligatoria antes del merge |
| Asedios siguen tras el final (S5-G, anulación del spec) | **Dejar** (ya hay interruptor en el Corazón); revisar en la prueba |
| Trueques solo en memoria (T6-C) | **Dejar** |
| Visiones de entrada una vez por mundo, no por jugador (S3/S4) | **Arreglar**: el que no la vio la recibe al entrar (bandera por jugador, opcional, protocolo 63) |
| "Ciervo" en el Menú de fogatas con Estrella | igual que arriba |
| Chromium headless a 2 fps: nada de P7 se puede juzgar ahí | **Proceso**: capturas por arnés + prueba real |

### 10.2 Balance trivial (lista aparte; solo números, un commit, fácil de revertir)
Solo lo que el HANDOFF ya señaló y se arregla cambiando **una constante**; todo lo demás, a la prueba de Gabriel:
1. **Curva de Savia**: si la simulación de historia completa (test ya existente) da Rango 8 antes de El Marchito, subir los dos últimos umbrales; si no llega, bajar el 8 (P4-A lo dejó escrito así).
2. **El Marchito dura ~6 min (objetivo 8)**: voluntad +30 % en solitario en `FINAL` (S5-F).
3. **Pez: 7 s entre anillos nadando** → 8 s (S2-B, "¿da tiempo?").
Nada más: estacas, Tragón y Marchito del Slice 1 ya se afinaron en el cierre del Slice 1; los precios del Buhonero siguen como el spec.

## 11. Fuera de alcance
- Música compuesta o generada; voces.
- Números de daño, combos, nuevos ataques, nuevas animaciones o clips.
- Mapa del mundo (el rastreador + rumbo lo sustituye); minimapa.
- Cuentas, logros de plataforma, notificaciones push.
- Traducción a otros idiomas (se deja todo en `names.ts` + textos centralizados, que es la mitad del camino).
- Cambios de balance fuera de §10.2; cambios de reglas del mundo.
- Mandos (gamepad) — se deja una nota: la API existe, pero nadie lo ha pedido.

## 12. Lista de prueba para Gabriel y los sobrinos
Con `?fps=1`, en **los dos móviles** + el PC, en el mundo de pruebas con una partida nueva para cada sobrino y la partida vieja de Gabriel.
1. **Primer arranque (sobrino de 10, sin ayuda):** ¿termina el tutorial en ≤ 12 min? ¿Dónde se atasca? ¿Salta algo sin querer?
2. **Veterano (Gabriel):** entra con su partida → no ve el tutorial; ve "El eco del bosque"; el rastreador dice algo con sentido.
3. **Sonido:** con auriculares y con altavoz: ¿se oye el aviso del lobo antes del mordisco? ¿Algún sonido cansa en 10 min? Silenciar desde el Menú.
4. **Impacto:** 5 golpes, 1 parada, 1 muerte de lobo: ¿se nota cada uno? ¿La sacudida marea en Suave? ¿Y en Normal?
5. **HUD en el móvil más pequeño:** ¿algo tapado por pulgares o muesca? Texto Grande: ¿cabe todo?
6. **Menú:** encontrar Oficios, cambiar sombrero, viajar a una fogata, poner el Puesto — sin preguntar.
7. **Rastreador:** seguirlo 20 min sin ayuda: ¿lleva a un sitio real? ¿Se entiende la flecha?
8. **Co-op:** un aprendiz con un veterano al lado; dos aprendices a la vez.
9. **Daltonismo:** con el filtro de escala de grises del móvil: ¿se distinguen los brotes del Marchito y las zonas?
10. **Rendimiento:** fps en el bosque de noche con asedio, antes y después de #7 (≤ 1 fps de diferencia en baja).
11. **Textos:** buscar "1 perlas" o parecidos en estantes, Buhonero y Encargos.

## 13. Riesgos
| Riesgo | Mitigación |
|---|---|
| Audio en iOS (se corta, no arranca, silencio del interruptor lateral) | Arranque en el primer toque; `resume()` al volver a la pestaña; aviso "Sin sonido: revisa el interruptor del móvil" si el contexto sigue suspendido tras 2 toques |
| Efectos procedurales suenan "a 8 bits" | Filtros + ruido + variación de tono; la música "suelta y listo" tapa el resto; si no gusta, los parámetros son una tabla fácil de retocar |
| Hit-stop se siente como lag en red mala | Solo en tus golpes, ≤ 110 ms, apagable con "Sacudida: Nada" |
| `fx` en el snapshot sube el tráfico | ≤ 6 entradas por snap, solo a ≤ 40 m; medido en el test de bot |
| El rastreador guía mal (pasos que no encajan en co-op) | Pasos del mundo vs. del jugador separados; tests puros con partidas de cada punto de la historia |
| El tutorial choca con asedios/noche | Paso en espera, nunca bloquea; el lobo de práctica es de un aprendiz y muere al terminar |
| Pastillas que aparecen/desaparecen confunden | Posiciones fijas, hueco en vez de reordenar, punto ● en la nueva |
| Todo esto sin móvil real en el contenedor | Arnés con capturas a 360×780 y 844×390; la prueba §12 antes del merge |

## 14. Mapa de planes
| Plan | Qué | Protocolo |
|---|---|---|
| **P7-A** Impacto | `fx` y `me.hurt` en el snapshot, parpadeo, hit-stop, sacudida, vibración, barra flotante, borde rojo, cámara que choca con muros, fijado suave, visiones por jugador | 62 → 63 |
| **P7-B** Sonido | sintetizador, ~40 efectos, ambiente por bioma, buses y volumen, música "suelta y listo", aviso iOS | — |
| **P7-C** UI y textos | HUD móvil (zonas seguras, 🎒, toasts), pastillas según progreso, Menú en pestañas, Ajustes (§6), Ayuda por temas, `qty` y barrido de textos, accesibilidad, panel de muerte | — |
| **P7-D** Guía | `guide.ts` (`nextStep`), línea "Qué sigue" + flecha de borde, consejos de primera vez, punto ●, "El eco del bosque" (registro de 20 eventos) | — (campos en 63) |
| **P7-E** Bug-bash | triaje §10.1 (telón de la Copa, tocones blancos, luna, poses, robot de noche, "ciervo"/Estrella) + balance trivial §10.2 en su propio commit | — |
| **P7-F** Tutorial (último) | `SavedPlayer.tut`, 8 pasos, lobo de práctica, co-op, "Saltar"/"Repetir", pantalla de entrada; después la lista §12 con Gabriel | 63 → 64 |

Cada plan: `npm test && npm run test:workers && npm run check` verdes, arnés de rendimiento sin pasarse de presupuesto, y su sección en el HANDOFF con "Decidido por Claude — revisar", "Qué probar" y "NO verificado".
