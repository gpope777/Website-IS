# Handoff — Aventura, Plan A (2026-09-26)

## Aventura completa — estado (LEER PRIMERO)
La historia entera está hecha: del mundo nuevo a los créditos y el post-juego. **#4 Progresión también está hecha** (Savia y Rango, Oficios, Aspecto, Libro y Proezas; ver "Progresión — resumen") y **#6 Tiendas y economía también** (Puesto, Caja, trueque, Buhonero, Encargos; ver "Tiendas — resumen") y **#2 Mundo y visuales también** (cielo, luz, hierba, agua, vida, criaturas, poses; ver "Visuales — resumen"). Rama `aventura/resto`, PR draft #3 (el Slice 1–2 fue el #2). **Nada mergeado ni desplegado; casi nada probado en navegador real.** Tests (al cierre de #2): npm test 1204, test:workers 12, check + build verdes; **PROTOCOL_VERSION = 62**; todos los campos guardados nuevos son opcionales (las partidas viejas cargan). Resúmenes por slice: **Slice 1** → "RESUMEN PARA LEER PRIMERO" (planes A–H + cierre) · **Slice 2** → "Slice 2 — resumen" · **Slice 3** → "Slice 3 — resumen" · **Slice 4** → "Slice 4 — resumen" · **Slice 5** → "Slice 5 — resumen" (incluye el orden de prueba de toda la historia) · **#4** → "Progresión — resumen" · **#6** → "Tiendas — resumen" · **#2** → "Visuales — resumen". Lo más gordo a revisar: los asedios siguen tras el final (anulación del spec, S5-G), el balance de El Marchito (S5-F), la curva de Savia (P4-A) y los precios del Buhonero (T6-D). Visuales: casi nada visto en un móvil real (mirar con `?fps=1`). **Lo siguiente:** #7 Pulido (con el tutorial).

**Branch:** `aventura/slice-1` (pushed to origin).

**Read first:**
1. `docs/superpowers/specs/2026-09-26-bosque-aventura-design.md`: the approved design (BotW-style adventure + base defense).
2. `docs/superpowers/plans/2026-09-26-aventura-A-corazon-asedios.md`: the plan to execute now (6 tasks).
3. `docs/superpowers/specs/2026-09-26-bosque-online-design.md`: foundation architecture (shared/ client/ server/, Cloudflare DO).

**Status:** the spec and plan A are committed. No game code for Aventura yet. Baseline: `npm test` shows 67 passing.

**What to do:** execute plan A with superpowers:subagent-driven-development (one fresh subagent per task, review between tasks). Gabriel wants minimal input: run Tasks 1–5 autonomously.
- **Stop at Task 6:** push, open the PR, and let Gabriel OK the merge. Deploy happens via GitHub Actions on merge to main.
- **Local check:** `npm run dev:server` → http://localhost:8787. If the cloud env can't run wrangler/browser, say so and skip; don't fake it.

**Rules:**
- Spanish UI text, dry voice.
- Every action needs a touch button.
- `npm test && npm run test:workers && npm run check` before each commit.
- Commits end with the `Co-Authored-By` trailer shown in the plan.

**After plan A:** write plan B (combat) with superpowers:writing-plans, against the code as it stands. The plan map is at the top of plan A.

---

# Progreso autónomo (noche 2026-09-27)

## RESUMEN PARA LEER PRIMERO
- **Planes A–H: todos hechos, ninguno bloqueado.** Rama `aventura/slice-1`, PR draft #2. Nada mergeado ni desplegado.
- Tests finales: npm test 250, test:workers 12, check + build verdes. PROTOCOL_VERSION = 9; las partidas viejas cargan (campos nuevos opcionales).
- **Nada se probó de punta a punta en navegador real** (Chromium headless a ~2 fps). Cada sección abajo dice qué se vio y qué no.
- Balance que hay que revisar sí o sí: estacas casi inútiles (A), boss Tragón pega demasiado (F: mata en ~12 s), voluntad/daño de El Marchito (H).
- Decisiones de alcance grandes: escalada = fallback de pilares marcados (D, el terreno no tiene pendientes >30°); Enredadera se obtiene en el altar de la mazmorra (F); mazmorra "instanciada" = zona fuera del mapa en la misma sala (F); el pill 🎥 cámara se cambió por 🌿 poder (E, cámara sigue en tecla C y Menú); la mochila ahora cae en una tumba al reaparecer (C).


PR draft: https://github.com/gpope777/Website-IS/pull/2 (NO merge: merge a main = deploy).

## Plan A — HECHO
- Commits: 32f50a6 (T1 items/protocolo v2), fff4221 (T2 Corazón), 171cab3 (T3 raider AI), a391bf8 (T4 asedios), 0e05933 (T5 cliente).
- Tests: npm test 93, test:workers 12, check + build verdes.
- Decisiones/desvíos: el test de estacas reposiciona al lobo cada tick porque los asaltantes (6,2 m/s) salen del radio de 1,3 m en ~2 ticks. **En juego real las estacas casi no dañan: revisar balance** (radio mayor o ralentizar al pisarlas).
- Verificado en navegador local: login, teclas G/T llegan al server, botones 🌳/🗡️ en móvil. NO verificado: un asedio completo (jugador nuevo sin materiales).
- Qué probar: plantar Corazón, estacas, aviso al atardecer (flecha del banner), oleada, marchitar + atender con bayas.

## Plan B — Combate — HECHO
- Plan: `docs/superpowers/plans/2026-09-26-aventura-B-combate.md` (b26b0a1).
- Commits: abfb082 (T1 tipos de enemigo + protocolo v3), d3b1f35 (T2 combate en servidor: rodar, bloqueo/parada, arco), c7ceb4b (T3 auto-apuntado, fijar objetivo, ayuda de rodar), cc45d6a (T4 controles en cliente + botones táctiles).
- Tests: npm test 110, test:workers 12, check + build verdes.
- Controles: Q rodar 🌀, Z mantener bloquear 🛡️ (pulsar justo antes del mordisco = parada), R arco 🏹, X fijar 🎯. E sigue golpeando (prefiere el objetivo fijado). Ayuda de teclas en el Menú.
- Decisiones/desvíos:
  - Sin subagentes (no había herramienta Agent en esta sesión): implementé yo cada tarea con TDD y revisé el diff.
  - "Tipo de enemigo genérico" = tabla `ENEMY` por `EnemyKind` sobre el registro `Wolf` existente (no renombré nada). Nuevo: **bruto marchito** (140 HP, lento, pega 22), uno de cada 3 asaltantes desde nivel de asedio 1. Visual: el zorro a escala 1,8 (sin modelo propio).
  - Arco **sin munición** (lo más simple; añadir flechas si hay abuso). Daño 15, alcance 24 m, cono 60°, 0,9 s.
  - Parada: ventana 0,25 s desde que subes la guardia; aturde 1,5 s y hace 15 de daño. Volver a subir la guardia antes de 0,6 s bloquea pero no para (anti-spam). Bloqueo normal quita 80 %.
  - Rodar: 0,35 s de invulnerabilidad (tiempo del servidor), enfriamiento 0,8 s; el desplazamiento es del cliente a velocidad de carrera (cabe en el control de velocidad).
  - El cliente elige el objetivo; el servidor revalida alcance, cono (arco), enfriamientos y vida. Antes de disparar el cliente manda un `move` con la nueva orientación.
  - Animaciones de rodar/bloquear/arco son provisionales (clips del robot).
  - El "poder activo" del §5 queda para el Plan E.
  - PROTOCOL_VERSION 2 → 3; nada de combate se guarda, las partidas viejas cargan.
- Verificado en navegador local (Chromium headless, móvil 844×390): los botones rodar/bloquear/arco/fijar aparecen; rodar (botón y Q) y bloquear (Z) llegan al servidor; arco/fijar sin enemigos dicen "Nada a tiro"/"Nada que fijar". NO verificado: una pelea real de noche (parada, flechas, cámara fijada, brutos).
- Bloqueos: ninguno.
- Qué probar: de noche, rodar a través de un mordisco (sin daño); pulsar 🛡️ justo antes del mordisco ("Parada", el zorro se congela); mantener 🛡️ (poco daño); 🏹 sin apuntar acierta al de delante; 🎯 fija y la cámara sigue; subir a nivel 1 y ver brutos grandes en el asedio. Revisar que 10 pastillas táctiles no tapen nada en móviles pequeños.

## Plan C — Tumba y revivir en co-op — HECHO
- Plan: `docs/superpowers/plans/2026-09-26-aventura-C-tumba-revivir.md`.
- Commits: 088116e (T1 tumbas + protocolo v4), 6bd80d0 (T2 revivir en co-op), 7d181c9 (T3 cliente: tumbas, revivir con A/E, panel de muerte).
- Tests: npm test 119, test:workers 12, check + build verdes.
- Cómo funciona: al caer, un compañero tiene 30 s para acercarse (2,5 m) y pulsar E / botón A: te levantas donde caíste con 40 de vida y la mochila intacta. Si reapareces, la mochila se queda en una **tumba** donde caíste; la tuya lleva un haz violeta. Se recoge sola al pisarla (2 m). Solo el dueño puede abrirla.
- Decisiones/desvíos:
  - **Cambio de regla:** "al morir conservas la mochila" (spec base §8) queda sustituido por el §10. El test viejo se actualizó a la nueva regla (no se borró).
  - La tumba se crea al reaparecer, no al morir: así el revivido no tiene que volver. Quien cierra la pestaña muerto conserva las cosas encima hasta reaparecer.
  - Revivir es una pulsación (sin mantener). Hambre y calor suben a mínimo 30 para no volver a caer al instante.
  - La ventana de 30 s es solo en vivo (`deadAt` no se guarda): tras reconectar ya no te pueden levantar.
  - Sin botón nuevo: revivir es contextual en el botón de acción (tiene prioridad sobre golpear/recoger); recoger la tumba es automático. La rejilla sigue en 10 pastillas.
  - Máximo 50 tumbas en el mundo (se borra la más vieja). PROTOCOL_VERSION 3 → 4; `graves` es opcional en la partida guardada, las viejas cargan.
- Verificado: solo tests, check y build. NO verificado en navegador (morir y revivir requiere dos jugadores y una pelea; no lo automaticé).
- Bloqueos: ninguno.
- Qué probar: morir con materiales → Reaparecer → haz violeta donde caíste → pisarlo → "Recuperaste tus cosas". Con dos jugadores: uno cae, el otro pulsa A junto a él antes de 30 s (el panel cuenta atrás) → "X levantó a Y" y el panel de muerte se cierra solo. Pasados 30 s: "Ya es tarde".

## Plan D — Travesía: trepar, planeador, nadar — HECHO
- Plan: `docs/superpowers/plans/2026-09-26-aventura-D-travesia.md` (5e7abdb).
- Commits: 1f5f507 (T1 peñascos + anims climb/glide, protocolo v5), ff8a57f (T2 validación de movimiento en servidor), 61cce0f (T3 trepar con aliento), 6f1548a (T4 planeador + nado rápido), ab0dc9c (T5 cliente: peñascos, anillo de aliento, planeador visible), 4c22047 (más peñascos: ~20 por mundo), c9ba52e (prioridad de avisos).
- Tests: npm test 139, test:workers 12, check + build verdes.
- **Decisión: fallback B (superficies marcadas), no escalada libre.** Por qué:
  - El terreno es un heightfield suave. Medido en 4 semillas (rejilla de 2 m): ~80 % bajo 10°, ~19 % entre 10–20°, ~1 % entre 20–30°, **0 % por encima de 30°**. Escalar libre ahí sería caminar.
  - Un `heightAt(x, z)` no puede tener paredes verticales ni salientes. Hacer acantilados exige otra representación del terreno (worldgen, recursos, rutas de asaltantes, validación del servidor): mucho más que un spike.
  - En móvil, "empuja el stick contra la roca marcada" no necesita botón ni adivinar normales.
- Cómo funciona:
  - **Peñascos con enredadera**: pilares de roca de 7–14 m con franjas de enredadera, generados de la semilla (`src/shared/crags.ts`), ~20 por mundo, lejos del spawn y en claros. Cliente y servidor los calculan igual: sin tráfico de red. Es la lista de "escalable" que Enredadera (Plan E) puede ampliar.
  - **Trepar**: empujar contra un peñasco lo agarra. Adelante/atrás = subir/bajar (2,2 m/s), lados = rodearlo. Arriba se sube solo a la cima y puedes estar de pie. Espacio/B trepando = saltar hacia atrás (cuesta 20). Aliento: 10/s moviéndote, 3/s quieto.
  - **Aliento** (100, recarga 30/s en el suelo): si llega a 0 te sueltas y quedas "sin aliento" (anillo rojo) hasta llenarlo del todo: ni trepar, ni planear, ni nadar rápido. Anillo junto al personaje, oculto si está lleno.
  - **Planeador**: pulsar Espacio/B otra vez en el aire (a más de 1,5 m del suelo). Cae a 1,6 m/s, avanza a 7 m/s (bajo el tope de 9 del servidor), gasta 4/s. Se cierra al pulsar otra vez, al aterrizar o sin aliento. Si chocas con un peñasco planeando, te agarras. Los compañeros ven la tela sobre tu cabeza (anim `glide`).
  - **Nadar**: ya existía (nado lento 2,2 m/s). Añadido: correr en el agua = 4 m/s, gasta 12/s. Sin ahogarse (lo más simple).
  - **Servidor**: cerca de un peñasco (4 m) acepta alturas hasta su cima + 3 m; en otro sitio, por encima de suelo + 4 solo acepta bajar. El aliento es del cliente (como el rodar).
- Decisiones/desvíos:
  - Sin pastilla nueva (la rejilla sigue en 10): trepar es contextual, planear/saltar del muro usan B/Espacio, nadar rápido usa correr (Shift o el stick al borde).
  - Animaciones provisionales: trepar = puñetazo lento, planear = salto congelado + un cono verde como tela.
  - Árboles/rocas que caen dentro de un peñasco se ocultan solo en el cliente (el servidor no cambia su lista).
  - Si mantienes W al saltar del muro, te vuelves a agarrar enseguida (hay que soltar el stick o apuntar a otro lado).
  - PROTOCOL_VERSION 4 → 5. No se guarda nada nuevo: las partidas viejas cargan.
  - ponytail: un tramposo puede flotar a altura constante (el servidor solo impide subir en el aire). Los asaltantes y lobos atraviesan los peñascos. La cámara puede meterse en la roca al trepar.
- Verificado en navegador local (Chromium headless, 1000×600, ~2,5 fps): el peñasco se ve con sus enredaderas; con W el robot se agarra y sube (anillo de aliento visible, bajando); llegó a la cima y quedó de pie encima sin que el servidor lo devolviera. NO verificado: el planeador (a 2,5 fps no pude ver el vuelo; bajó del peñasco y acabó en el suelo sin que pudiera saber si planeó), el nado rápido, ni los botones táctiles.
- Bloqueos: ninguno.
- Qué probar: buscar un pilar gris con franjas verdes, empujar contra él y subir; mirar el anillo; soltarse sin aliento a media altura; desde la cima correr, saltar y pulsar B otra vez → planear lejos; pulsar B otra vez → cerrar; en el agua mantener correr → más rápido hasta quedar sin aliento. ¿Se sienten bien 2,2 m/s trepando y 1,6 m/s de caída? Constantes: `STAMINA`/`GLIDE`/`CLIMB_SPEED` en `src/client/movement.ts` y `CRAG` en `src/shared/crags.ts`.

## Plan E — Enredadera y 3 santuarios — HECHO
- Plan: `docs/superpowers/plans/2026-09-26-aventura-E-enredadera-santuarios.md` (e6f29e8).
- Commits: 9465fe6 (T1 santuarios y enredaderas en shared + protocolo v6), 7e822ad (T2 acertijos y orbes en servidor), e32062f (T3 poder Enredadera en servidor), 34d4120 (T4 reglas de cliente: roca lisa, aliento por orbe, tecla H), 500a454 (T5 cliente: santuarios, enredaderas, avisos).
- Tests: npm test 165, test:workers 12, check + build verdes.
- Cómo funciona:
  - **3 santuarios por mundo** (`src/shared/shrines.ts`), generados de la semilla a 70–150 m del spawn, un tercio de círculo entre ellos, en seco y lejos de peñascos. Se ven de lejos por un haz de luz verde (desaparece cuando ya lo completaste). El orbe está tras una verja de luz (lógica: el orbe se niega mientras está cerrada).
    - **Palancas:** dos palancas a 20 m. Tirar de las dos (E / A) con menos de 6 s de diferencia → abierto 30 s.
    - **Losa:** una losa a 14 m del orbe. Pisada, y 3,5 s después, está abierto. Solo: correr. En co-op: uno la pisa.
    - **Roca lisa:** el orbe está encima de un pilar de 10 m sin enredadera: no se puede trepar hasta cubrirlo con Enredadera.
  - **Orbe de mejora:** +20 de aliento máximo cada uno (100 → 160 con los tres). Cada jugador completa cada santuario una vez; el estado del acertijo es compartido.
  - **Enredadera** (H / 🌿): se despierta con el **primer orbe**. Hace crecer una enredadera trepable (pilar verde de 8 m) 2,5 m delante; junto a una roca lisa, la cubre y se vuelve trepable. Dura 90 s, enfriamiento 12 s, una por jugador (la nueva sustituye a la vieja), alcance 6 m. Los **muros a menos de 6 m** de una enredadera se regeneran 5 PV/s.
- Decisiones/desvíos:
  - La Enredadera sale del primer santuario, no de la mazmorra (el Plan F aún no existe). La regla es una línea (`(p.shrines ?? []).length > 0` en `onPower`): el Plan F puede moverla.
  - Orbe = +20 de aliento (lo más simple que se nota). El aliento sigue siendo del cliente (ponytail, como en el Plan D).
  - La rejilla táctil sigue en 10: la pastilla 🎥 cámara pasa a ser 🌿 poder. Cambiar cámara sigue en el Menú y en C.
  - Palancas y orbes usan el botón de acción contextual (después de revivir, antes de golpear).
  - Puentes de raíces (§6) fuera: no hay huecos que cruzar en este terreno.
  - Las enredaderas y el estado de los acertijos no se guardan. `SavedPlayer.shrines` es opcional: las partidas viejas cargan. PROTOCOL_VERSION 5 → 6.
  - ponytail: asaltantes y lobos atraviesan pilares y enredaderas. Los recursos dentro de la roca lisa solo se ocultan en el cliente.
- Verificado en navegador local (Chromium headless): la pastilla 🌿 poder aparece (móvil 844×390); H sin orbes → "Aún no tienes ese poder"; con un orbe (partida importada) junto a la roca lisa, H → "Crece una enredadera" y la roca muestra franjas verdes. Sin errores en consola. NO verificado: trepar la roca cubierta y tomar el orbe, palancas y losa en juego, la regeneración de muros (todo eso tiene tests de servidor).
- Bloqueos: ninguno.
- Qué probar: buscar los haces de luz; palancas corriendo de una a otra; la losa corriendo (andando no llega) y con un compañero encima; tras el primer orbe, H/🌿 delante → trepar el pilar verde; cubrir la roca lisa, subir y tomar el orbe; romper un muro de noche y poner una enredadera al lado. Constantes: `SHRINE` en `src/shared/shrines.ts`, `ENREDADERA` en `src/shared/enredadera.ts`, `STAMINA.perOrb` en `src/client/movement.ts`.

## Plan F — Mazmorra de la Raíz-madre, jefe de papel y defensor purificado — HECHO
- Plan: `docs/superpowers/plans/2026-09-26-aventura-F-mazmorra-jefe.md` (1d37033).
- Commits: a7dd63c (T1 trazado de la mazmorra + protocolo v7), a3ee977 (T2 entrada, verja de raíces, altar de Enredadera), efd81d5 (T3 el Tragón de Papel), 1d9fb16 (T4 defensor purificado), 7e33335 (T5 reglas de cliente: suelo, muros, acciones), 025cdf4 (T6 visuales: Raíz-madre, interior, jefe de papel), fe5fed9 (muros exteriores transparentes por detrás).
- Tests: npm test 201, test:workers 12, check + build verdes.
- Cómo funciona:
  - **La Raíz-madre** (`src/shared/dungeon.ts`): un tronco enorme con haz violeta, generado de la semilla a 90–150 m del spawn, lejos de peñascos y santuarios. Junto al hueco, A / E → "Entrar en la Raíz-madre".
  - **Interior "instanciado"**: un rectángulo de 24 × 96 m en `x = HALF + 150`, fuera del mapa, en la misma sala/sim (el servidor te teletransporta). Suelo plano a 30 m (`withDungeon` envuelve el terreno en cliente y servidor); los muros son un límite (`clampStep`) que usan los dos. Dentro hace calor (no te congelas).
  - **Sala 1:** dos palancas de raíz a 18 m; tirar de las dos con menos de 6 s → la verja se abre (para todos, hasta que la sala se reinicie). Sin verja abierta el servidor rechaza cruzarla.
  - **Sala 2:** el altar. A / E → **despierta la Enredadera** (se guarda en `SavedPlayer.enredadera`).
  - **Sala 3: el Tragón de Papel** (`public/enemies/enemy1.png`). 300 PV, lento, mordisco anunciado (0,7 s agachado y temblando) de 24 en 3,2 m. **Papel doblado**: golpes y flechas no le hacen nada ("El papel doblado aguanta. Párale o enrédalo") salvo si está **expuesto**: 4 s tras una parada, o 5 s (y quieto) si una Enredadera brota a ≤4 m de él. Rodar esquiva el mordisco. Si la sala queda vacía, desaparece y vuelve con la vida llena.
  - **Purificado**: al vencerlo, `SavedWorld.purified = true`. Desde entonces un Tragón pequeño y blanco espera junto al Corazón y, en los asedios, muerde al asaltante más cercano a menos de 16 m del Corazón (25 de daño cada 1,2 s). No muere.
  - **Papel espíritu (cliente)**: `src/client/actors/paper.ts`, un plano con el dibujo que gira hacia la cámara, bota sobre sus ruedas al correr, se balancea, respira (squash), se agacha antes de morder, se tiñe de azul cuando está expuesto y cae plano al morir. Se voltea para que la boca vaya por delante. Nada de pipeline imagen→3D.
- Decisiones/desvíos:
  - **Enredadera se mueve del primer orbe al altar de la mazmorra** (el spec dice que la da la mazmorra). Partidas viejas: quien ya tenía algún orbe y no tiene el campo `enredadera` la conserva al cargar. Los tests del Plan E se adaptaron a la regla nueva (no se borró ninguno). La roca lisa queda para después de la mazmorra.
  - **Recorte de alcance**: el spec pide 30–45 min, 4–6 acertijos y un mini-jefe. Aquí hay 1 acertijo (palancas), el altar y el jefe. Añadir salas es añadir entradas al trazado.
  - "Instanciado" = zona aparte en el mismo Durable Object (lo más simple; el spec dejaba abierta la opción). Una sola mazmorra por mundo, compartida en co-op.
  - Sin pastilla nueva (la rejilla sigue en 10): entrar, salir, palancas y altar usan el botón A contextual; el poder sigue en H / 🌿.
  - El jefe viaja en la lista `wolves` con `kind: 'boss'` (id 0): fijar, arco y golpes funcionan igual. Barra del jefe arriba ("Tragón de Papel 300/300 · doblado / ¡expuesto!").
  - PROTOCOL_VERSION 6 → 7. `enredadera` y `purified` son opcionales: las partidas viejas cargan.
  - ponytail: el interior no tiene techo (se ve el cielo). Los muros exteriores son planos de una cara (desde fuera se ven a través, así la cámara nunca queda tapada). La verja no se vuelve a cerrar hasta reiniciar la sala. El defensor no tiene vida.
- Verificado en navegador local (Chromium headless, 1000×600, partida importada): junto al tronco aparece "E · Entrar en la Raíz-madre"; E → dentro ("Huele a papel viejo"), el anillo de salida y "E · Salir de la Raíz-madre"; en la sala del jefe se ve el dibujo recortado, la barra "doblado"; H delante → "La enredadera atrapa al Tragón" y la barra pasa a "¡expuesto!". Sin errores en consola. Quieta en la sala, Ana murió en ~12 s: el jefe pega fuerte (**revisar balance**: `ENEMY.boss` en `src/shared/sim/wolves.ts`, `BOSS` en `src/shared/sim/boss.ts`). NO verificado en navegador: parar el mordisco, vencerlo, el defensor en un asedio (todo con tests de servidor), ni en móvil.
- Bloqueos: ninguno.
- Qué probar: buscar el haz violeta y el tronco; entrar; tirar de las dos raíces corriendo; tomar la Enredadera en el altar; en la sala del jefe, 🛡️ justo cuando se agacha → "Parada: el papel se desdobla" y pegar; o 🌿 delante de él y pegar mientras está azul; rodar el mordisco. Tras vencerlo: el Tragón blanco junto al Corazón y, de noche, mordiendo asaltantes. ¿Se lee bien el papel en móvil? ¿24 de daño es demasiado?

## Plan G — Montura terrestre: el Ciervo y el anillo de doma — HECHO
- Plan: `docs/superpowers/plans/2026-09-26-aventura-G-montura.md` (883dcba).
- Commits: b4f9ea6 (T1 reglas de montura + protocolo v8), 824600e (T2 doma juzgada en servidor), 3d6a647 (T3 montar/bajar y tope de velocidad para jinetes), 5826ab9 (T4 reglas de cliente: galope, orilla, tecla M), 92d78cf (T5 cliente: ciervo, anillo, jinete).
- Tests: npm test 229, test:workers 12, check + build verdes.
- Cómo funciona:
  - **El Ciervo salvaje** (`src/shared/mount.ts`): uno por mundo, generado de la semilla a 50–110 m del spawn, en seco y lejos de peñascos, santuarios y la Raíz-madre. Ciervo de cajas con cornamenta y un halo dorado en el suelo; pasta cuando está quieto.
  - **Doma:** junto a él, A / E → se encabrita (la cámara tiembla) y aparece el anillo. La aguja gira; hay que pulsar cuando cruza la zona amarilla. 3 rondas: 2,4 → 3,4 → 4,6 rad/s, zona 1,3 → 0,95 → 0,65 rad. Cuenta como pulsación: A, E, Espacio/B o **tocar el propio anillo**. Fallo → "Te tira al suelo. Otra vez" y 2 s de espera. Alejarse más de 6 m o no pulsar en 8 s también te tira.
  - **Co-op:** si otro jugador está a ≤6 m del ciervo mientras domas, la zona es ×1,5 ("calmar").
  - **Juez en el servidor:** el servidor elige la zona de cada ronda y su hora de inicio. El cliente manda `at` (su estimación del reloj del servidor); se acepta si `at` está entre `ahora − 0,6 s` y `ahora + 0,15 s` y no antes del inicio de la ronda, y el servidor calcula la aguja en ese instante.
  - **Montar:** al domarlo ya vas encima. A / E / M → bajar (el ciervo se queda donde bajaste). A / E / M junto a tu ciervo → montar. Paso 6 m/s, galope (Shift o stick al borde) 12 m/s.
  - **Servidor:** sabe quién monta. Tope de velocidad 13 m/s solo para jinetes (y 2 s tras bajar, por la latencia); el resto sigue en 9. Montado: no se trepa (sin margen de peñasco), no se entra al agua (el cliente para en la orilla; el servidor rechaza), no se monta dentro de la mazmorra. Entrar en la Raíz-madre o morir te baja y el ciervo se queda ahí.
  - Otros jugadores ven los ciervos aparcados, el salvaje y a los jinetes encima de su ciervo (`PlayerView.ride`, `snap.steeds`).
- Decisiones/desvíos:
  - Un solo ciervo salvaje que nunca se va: cada jugador doma "su copia" (lo más simple; nadie te lo quita en co-op). Uno por jugador.
  - El ciervo no te sigue ni acude a un silbido: se queda donde bajaste. (Idea para después.)
  - Fuera: acarrear materiales (spec §9), bestias legendarias, montura dibujada por el sobrino (el ciervo son cajas; se puede cambiar por un dibujo como el Tragón).
  - Montado puedes pegar (A ataca si hay enemigo al alcance; si no, A te baja). Recoger exige bajar.
  - Sin pastilla nueva (la rejilla sigue en 10): todo va por el botón A contextual; en teclado también M.
  - PROTOCOL_VERSION 7 → 8. `SavedPlayer.steed` es opcional: las partidas viejas cargan. Montar es solo en vivo (reconectar te deja a pie junto al ciervo).
  - ponytail: un tramposo puede elegir el instante del toque dentro de la ventana de 0,75 s (no puede saltarse rondas ni darse un ciervo). El ciervo atraviesa árboles igual que tú (mismo colisionador del jugador). Durante la doma no se mueve tu posición real: solo se te dibuja encima del ciervo.
- Verificado en navegador local (Chromium headless, 1000×600, partida importada junto al ciervo): E → "El ciervo se encabrita…", el anillo con la zona amarilla y "Doma 1/3", el robot sentado sobre el ciervo que corcovea. Un clic sobre el anillo mandó un toque y el servidor lo juzgó ("Te tira al suelo. Otra vez"). Con `steed` importado: M → montado (prompt "E / M · Bajar del ciervo", robot encima del ciervo) y galopando el servidor aceptó los movimientos (el ciervo guardado se movió con él). NO verificado: domarlo entero en navegador (a ~2 fps no se puede acertar a mano; los tests de servidor lo cubren), la pulsación con B/Espacio, móvil, ni ver a otro jinete.
- Bloqueos: ninguno.
- Qué probar: buscar el halo dorado (hay un ciervo pastando a 50–110 m del spawn); A → pulsar cuando la aguja cruce la zona, 3 veces; fallar a propósito; con un compañero al lado, ¿la zona se nota más ancha?; galopar (¿12 m/s se siente bien?), llegar al agua (para en la orilla), bajar y volver a montar; entrar en la Raíz-madre montado. Constantes: `MOUNT` en `src/shared/mount.ts`.

## Plan H — El Marchito: Invasión 1 y visiones — HECHO
- Plan: `docs/superpowers/plans/2026-09-26-aventura-H-marchito.md` (9cda194).
- Commits: ff38372 (T1 reglas del Marchito + protocolo v9), 2e8a9e7 (T2 visiones e Invasión 1 en servidor), 9f459cd (T3 asedios desde la Raíz-madre, más débiles tras purificarla), 2936ecb (T4 cliente: Marchito, barra, visiones), 6e2f9fe (dibujo recortado y más lento).
- Tests: npm test 250, test:workers 12, check + build verdes.
- Cómo funciona:
  - **Visión al purificar:** al vencer al Tragón llega a todos una tarjeta morada con la voz del Marchito, que nombra a los jugadores presentes ("Así que muerden, las ramitas. Ana y Leo."). Se cierra con ✕ o Enter y se va sola a los pocos segundos; las líneas quedan también en el registro.
  - **Invasión 1** (`src/shared/sim/marchito.ts`): 20 s después, si hay Corazón y alguien fuera de la mazmorra, El Marchito entra a 28 m del Corazón **desde el lado de la Raíz-madre**. Es un papel espíritu de 7 m (`enemy12.png`, teñido morado). Va a por la **mitad más cercana de las defensas** (muros, estacas y fogatas; redondeando hacia arriba, contadas al llegar), tarda 2,5 s en romper cada una, golpea (18) a quien tenga a 3 m, se ríe 4 s y se va. **Nunca daña el Corazón.**
  - **No se le puede matar:** golpes, flechas y paradas le quitan **voluntad** (400). A 0 se retira antes ("Me acordaré de sus nombres", con los nombres de quienes le pegaron). La primera vez que cada jugador le pega: "¿Eso es todo, Ana?". Barra arriba: "El Marchito · voluntad 320/400" / "El Marchito se ríe". Fijar (X), arco y parada funcionan igual que con el jefe.
  - **Una vez por mundo:** `SavedWorld.invasion` ('pending' | 'done'). Guardar a mitad de invasión la deja 'pending' (vuelve al cargar; lo roto sigue roto). Si nadie está activo, se congela.
  - **Corrupción por dirección (§3):** los asedios ahora vienen del lado de la Raíz-madre (±0,4 rad) y el aviso lo dice ("hacia la Raíz-madre"). Tras purificarla, las oleadas son ×0,6 y sin brutos ("Restos de corrupción… Vienen menos").
- Decisiones/desvíos:
  - Solo la **derrota** del Tragón dispara la invasión. Los mundos viejos que ya lo habían vencido (`purified: true` sin `invasion`) no la reciben: nada de sorpresas al cargar.
  - Sin mensaje de cliente nuevo: pegarle usa `attack`/`shoot` con su id (900000). Lo único nuevo en el cliente es la tecla Enter (acción `dismiss`) y el ✕ de la tarjeta; la rejilla táctil sigue en 10.
  - "Reacciona a los jugadores" = nombres en las visiones y la burla al primer golpe de cada uno. Nada más elaborado.
  - La torre en el horizonte (§2) queda fuera: pertenece al último bioma. Corrupción por zonas que avanza tampoco (no hay zonas todavía).
  - PROTOCOL_VERSION 8 → 9. `EnemyKind` gana `'marchito'`; `snap.marchito`; mensaje `vision`. `invasion` es opcional: las partidas viejas cargan.
  - ponytail: atraviesa árboles, muros y peñascos (va recto). Los asaltantes de esa noche siguen su curso aparte.
- Verificado en navegador local (Chromium headless, 1000×600, partida importada con Corazón, 4 muros e `invasion: 'pending'`): a los ~20 s apareció la tarjeta "El Marchito entra en el claro…" y la barra "El Marchito · voluntad 400/400"; unos segundos después la risa y "Solo vine a mirar…". Sin errores en consola. El primer intento usó `enemy15.png`, que no tiene transparencia (se veía un rectángulo morado): cambiado a `enemy12.png`. NO verificado en navegador: verle bien de cerca (la cámara no lo encuadró), pegarle hasta echarlo, la visión al vencer al Tragón, móvil (todo eso tiene tests de servidor).
- Bloqueos: ninguno.
- Qué probar: vencer al Tragón → visión con sus nombres; salir y volver al Corazón → a los 20 s entra el Marchito desde el lado del tronco; mirar qué muros rompe (los más cercanos al Corazón); pegarle y parar su golpe → baja la voluntad; ¿se le puede echar antes de que termine? (400 de voluntad puede ser mucho o poco: `ENEMY.marchito` en `src/shared/sim/wolves.ts`, `MARCHITO` en `src/shared/sim/marchito.ts`). ¿El dibujo `enemy12` es el que el sobrino quiere para el villano? Cambiarlo es una línea (`MARCHITO_IMG` en `src/client/game.ts`). Ver de noche que el asedio llega del lado de la Raíz-madre.

---

# Decisiones de Gabriel (entrevista 2026-09-27)

**Cierre del Slice 1** (antes del Slice 2, en `aventura/slice-1`):
- Balance: estacas (ralentizan + dañan de verdad), Tragón menos letal, voluntad/daño de El Marchito.
- 2ª trampa: **red de raíces** (inmoviliza unos segundos).
- **Corrupción por zonas** del bosque.
- Mazmorra: **3–4 puzzles + mini-jefe** = bruto marchito reforzado (más vida + carga).

**Slice 2:**
- Bioma: **Costa/Lago**, ampliando el mismo mundo (se llega con el ciervo: "cada montura es la llave del siguiente bioma").
- Poder: **Viento**.
- Monturas: **pez gigante** (personal, carrera por anillos + anillo final) y **ballena** (una por mundo, lenta, lleva 3–4 jugadores, se doma en co-op).
- **Invasión 2** incluida (El Marchito se lleva algo → misión de rescate).
- Nombres: placeholders en un solo archivo; los sobrinos los cambian después.
- Orden: cierre S1 → spec S2 → planes S2 → implementar. Sin merge ni deploy.

---

## Cierre Slice 1 — balance, red de raíces, corrupción por zonas, mazmorra ampliada — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S1-cierre.md` (8d977ee).
- Commits: 844ddb3 (T1 balance), 740eaff (T2 red de raíces, protocolo v10), 514176f (T3 corrupción por zonas, v11), d0de36b (T4 mazmorra: 4 acertijos + mini-jefe, v12), ab367f2 (T5 cliente de la mazmorra).
- Tests: npm test 285 (antes 250), test:workers 12, check + build verdes. PROTOCOL_VERSION = 12; las partidas viejas cargan (`SavedWorld.cleansed` opcional).
- Cómo funciona:
  - **Balance.** Estacas: radio 1,8 m, 40 PV/s y **frenan al 30 %** (0,5 s tras cada toque): un lobo que las cruza muere encima, un bruto sale muy tocado. Tragón: 12 de daño, 3,2 s entre mordiscos, aviso de 0,9 s → quieto aguantas ~37 s (antes ~12). Marchito: voluntad **300 / 420 / 540 / 660** según jugadores activos al llegar (1–4), 14 de daño cada 3 s.
  - **Red de raíces** (4 madera + 2 bayas, 60 PV): la primera bestia que la pisa queda atrapada 3 s; se rearma en 5 s; cada captura le quita 15 PV (4 capturas). Tecla **Y**. En táctil, la pastilla 🗡️ ahora es **"trampa"** y pone la elegida; se cambia en el Menú ("Trampa: estacas / red de raíces"). T sigue poniendo estacas. La rejilla sigue en 10.
  - **Corrupción por zonas** (`src/shared/corruption.ts`): 6 zonas sembradas; la 0 es la Raíz-madre, las demás se inclinan hacia ella (60–190 m del spawn). Suelo teñido de morado y una raíz marchita con brillo violeta en el centro. De noche, cada jugador dentro de una zona corrupta trae 2 bestias más (una, bruto). Se limpian con un **orbe de santuario** (la zona corrupta más cercana a ese santuario, nunca la 0), con la **Enredadera** a ≤5 m de la raíz marchita, o **venciendo al Tragón** (zona 0). Los **asedios vienen de la zona corrupta más cercana al Corazón**; sin ninguna, de la Raíz-madre.
  - **Mazmorra** (ahora 170 m, 5 verjas): palancas (como antes) → altar → **nudo** (Enredadera junto a él lo abre) → **losa** (un compañero encima, o el **bloque de raíz**, que se coge y suelta con A; sola, la losa cierra en 1,5 s y no da tiempo a correr) → sala oscura: **linterna** al **brasero** → **bruto reforzado** (420 PV; se agacha 1,1 s y carga en línea recta a 13 m/s: 30 de daño; rodar o apartarse lo esquiva; muerde 18) → Tragón.
- Decisiones/desvíos:
  - **Cambios de regla con tests adaptados (ninguno borrado):** el test viejo de estacas ya no reteletransporta al lobo; el de parada del Tragón espera según `BOSS.windup`; el de dirección de asedio limpia primero las otras zonas (ahora manda la más cercana); `clampStep` recibe una bandera por verja; `decodeClient` acepta `dungeon` 5–7.
  - La verja de la losa **se atasca abierta** en cuanto alguien la cruza: así nadie queda encerrado detrás.
  - Todo el estado de la mazmorra sigue siendo solo en vivo (se reinicia con la sala). Quien sale de la mazmorra con el bloque o la linterna los devuelve a su sitio; si muere, los suelta donde cayó.
  - Mundos viejos con `purified: true` y sin `cleansed` cargan con la zona 0 ya limpia.
  - El bruto reforzado es el zorro a escala 2,4 (sin modelo ni tinte propio). El aviso de la carga es la barra "· ¡carga!" más la anim de ataque; no hay marca en el suelo.
  - Cada orbe de cada jugador limpia una zona: con 2–3 jugadores el bosque se limpia rápido. Revisar si molesta.
- Verificado en navegador local (Chromium headless, 1000×600, mundo nuevo): entra sin errores de consola; Y sin materiales → "Faltan materiales"; el Menú muestra "Trampa: estacas"; el snap trae `corrupt [0..5]` y las 5 verjas cerradas. NO verificado en navegador: el tinte morado (las zonas están a ≥60 m del spawn), la mazmorra nueva por dentro, el bruto cargando, la red atrapando (todo tiene tests de servidor), ni móvil.
- Bloqueos: ninguno.
- Qué probar: de noche, estacas en el camino del asedio (¿se nota el frenazo?); una red delante de un muro; quedarse quieto junto al Tragón (~37 s); echar al Marchito solo (300) y con 3–4. Buscar una mancha morada, pasar la noche dentro (más bestias), lanzar la Enredadera junto a la raíz violeta. En la mazmorra: el nudo con 🌿, la losa con un compañero y luego sola con el bloque, la linterna en la sala oscura, rodar la carga del bruto. Constantes: `SPIKES`/`NET` en `world-sim.ts`, `SLOWED` y `ENEMY` en `wolves.ts`, `BOSS`, `marchitoWill`, `CORRUPTION` en `corruption.ts`, `DUNGEON` en `dungeon.ts`, `ELITE` en `elite.ts`.

## Slice 2 — resumen (LEER PRIMERO)
- **S2-A a S2-H: todos hechos, ninguno bloqueado.** Rama `aventura/slice-1`, PR draft #2. Nada mergeado ni desplegado.
- Tests finales: npm test 456, test:workers 12, check + build verdes. **PROTOCOL_VERSION = 22.** Todos los campos guardados nuevos son opcionales: las partidas viejas cargan.
- **Qué hay:** S2-A la Costa al sur (Ciénaga que muerde a pie, playa, bajíos, mar hondo, 3 islotes, isla), `names.ts`, ciervo para dos · S2-B el Pez Grande (carrera de 6 anillos + anillo de 2 rondas, bucear con B) · S2-C 3 santuarios de la Costa, 6 cofres hundidos, perlas y mejora de arma · S2-D 4 zonas corruptas de la Costa y "algo sube de la costa" (+brutos) · S2-E la Ballena (doma con 2+, 4 asientos, aguas bravas) · S2-F la mazmorra de la Costa, el Viento (J / mantener el botón de poder para cambiar) y el bruto escudado · S2-G El Antenón (enemy3) y el Antenón blanco que sopla asaltantes · S2-H Invasión 2: El Marchito se lleva al Tragón purificado y el rescate de la jaula con 3 anclas.
- **Nada del Slice 2 se probó en navegador real** (solo tests + build). Es lo primero que hay que hacer.
- **Balance a revisar:** daño de la Ciénaga (8 PV/s) y si un amigo sin ciervo se siente fuera; 7 s entre anillos del pez nadando; rondas de la ballena con 2 jugadores; perlas (3) + coste de la mejora (+15 % por nivel, máx. 3); brutos de la costa por zona; Viento: 3 muertes por agua por ráfaga, 6 s de enfriamiento; bruto escudado 420 PV; El Antenón (~43 s quieto a su lado, 360 PV); voluntad del Marchito en la Invasión 2 (×1,2); anclas (150 PV, ráfaga ×3) y guardias (2 lobos); +10 de mordisco al volver. Constantes: `CIENAGA`, `FISH`, `WHALE`, `UPGRADE`, `VIENTO`, `ELITE`, `ANTENON`, `MARCHITO`, `RESCUE`, `ALLY`.
- **Qué probar (en orden de historia):** ciervo por la Ciénaga (con un amigo detrás) → domar el pez → santuarios Marea/Hundido → cofres y perla → al atardecer siguiente, El Marchito sube de la costa y se lleva al Tragón (probar echarlo antes y no echarlo: ¿rompe un cuarto de defensas?) → noche sin Tragón → romper las 3 anclas (lobos guardianes) y abrir la jaula → domar la ballena con 2 → mazmorra de la Costa → Viento → bruto escudado → El Antenón → Antenón blanco de noche. En móvil: rejilla de 10 pastillas, cambiar de poder con pulsación larga, bucear.

## Slice 2 · S2-A — Costa, Ciénaga, nombres y ciervo para dos — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S2-A-costa-cienaga.md` (03211ba).
- Commits: 09c9dac (T1 `names.ts`), bcc0844 (T2 terreno de la Costa), 01db40d (T3 Ciénaga + mar hondo), c5812f5 (T4 el ciervo lleva a dos, protocolo v13), e86b0a7 (T5 cliente de la Costa).
- Tests: npm test 305 (antes 285), test:workers 12, check + build verdes. PROTOCOL_VERSION = 13; no hay campos guardados nuevos: las partidas viejas cargan.
- Cómo funciona:
  - **Mapa:** crece al sur hasta `SOUTH = HALF + 220` (z = 460). El bosque (z < 200) es idéntico al de antes (hay un test que compara con la función vieja). De norte a sur: 20 m de mezcla, **Ciénaga** (barro plano morado-pardo hasta HALF+20), **playa** de arena, **bajíos** (≤4 m), **mar hondo** (~15 m, fondo con ruido), 3 **islotes** sembrados y la **isla de la mazmorra** (HALF+170, aún sin nada), y un borde de colinas.
  - **Ciénaga:** a pie vas a 3 m/s y el barro quita 8 PV/s ("El barro marchito muerde. A lomos del ciervo no"). A caballo, nada. El servidor lo valida (tope de velocidad y daño en `step`).
  - **Mar hondo:** a pie, pasados 4 m de profundidad solo aceptas movimientos que te lleven a menos fondo ("La corriente te devuelve"). Planeando por encima no cuenta.
  - **Ciervo para dos:** A (E/M) junto a alguien a caballo → "Subir detrás de X". El servidor coloca al pasajero 0,6 m detrás del jinete cada tick e ignora sus `move`. A → "Bajar". Si el jinete baja, cae, se desconecta o entra en la mazmorra, el pasajero baja también. El pasajero no sufre el barro. Uno por ciervo.
  - **Nombres:** `src/shared/names.ts`. Un test falla si un texto de juego escribe a mano El Marchito, Tragón, Raíz-madre, Corazón del Bosque, Enredadera, bruto reforzado o Ciénaga.
- Decisiones/desvíos:
  - El pasajero va en S2-A: es lo que deja entrar a la Costa a quien no tiene ciervo.
  - Las reglas del mar solo se aplican al sur de `COAST_Z0`. Los lagos del bosque siguen como antes, aunque alguno tiene más de 4 m.
  - Solo se construye en el bosque ("No se puede construir aquí" en la Costa). La base se queda en casa.
  - No hay recursos en la Costa todavía (tampoco en los islotes). **Mundos viejos:** los ids de recursos se desplazan porque desaparece la franja del antiguo borde sur. Una tala a medias guardada puede caer en otro árbol, y vuelve a crecer en minutos.
  - Sin peñascos a menos de 60 m de la Ciénaga (z > 140), para que el planeador no la salte. En mundos viejos desaparecen los peñascos de esa franja, y algún santuario, zona o entrada podría moverse un poco si dependía de ellos.
  - El terreno de la Costa vive en `terrain.ts` (`coastFeatures`, bandas en `COAST`) para evitar una importación circular. Las reglas están en `src/shared/coast.ts`.
  - No hay aviso propio del cliente en el borde de la Ciénaga: el primer paso en el barro ya muestra el aviso del servidor (se repite cada 4 s).
- Rendimiento móvil: la malla fina llega hasta HALF+90 y el mar lejano usa celdas ×2. En gama baja (160 segmentos) el terreno pasa de 25.921 a ~32.600 vértices (+26 %, no +46 %). En alta (240) pasa de 58.081 a ~73.300. Suma **+1 draw call** (malla lejana). El agua sigue siendo un solo quad (más grande). La hierba solo va en el bosque. La niebla existente tapa casi todo el mar lejano.
- Verificado en navegador local (Chromium headless 1000×600): mundo nuevo sin errores de consola. Con la partida importada en la playa (z = 268) se ven la arena, la franja de barro morado-pardo y, detrás, el agua y el bosque. NO verificado: cruzar a caballo, el pasajero con dos clientes, el mar hondo en vivo, ni en móvil.
- Bloqueos: ninguno.
- Qué probar: ir al sur a pie hasta el barro (aviso y vida bajando, lento), volver y cruzar a caballo (~5 s). Con dos jugadores: uno a caballo y el otro pulsa A a su lado ("Subir detrás"), cruzan juntos la Ciénaga, y A para bajar. En la playa, nadar mar adentro hasta que "La corriente te devuelve". Constantes: `CIENAGA`/`SWIM_MAX_DEPTH` en `coast.ts`, `COAST`/`COAST_Z0`/`SOUTH` en `terrain.ts`, `MOUNT.seatBack`.

## Slice 2 · S2-B — el Pez Grande — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S2-B-pez-grande.md`.
- Commits: T1 reglas del pez (`src/shared/fish.ts`), T2 domar al pez (carrera de anillos, protocolo v14), T3 montar y bucear en el servidor, T4 cliente del pez (anillos, montar, bucear).
- Tests: npm test 325 (antes 305), test:workers 12, check + build verdes. PROTOCOL_VERSION = 14. Campo guardado nuevo opcional `SavedPlayer.fish` (dónde espera tu pez): las partidas viejas cargan.
- Cómo funciona:
  - **Pez salvaje:** uno por mundo, sembrado en los bajíos (HALF+60…80, 1,5–3,5 m de fondo, se llega nadando). Halo dorado; en el cliente da vueltas de 2 m (el servidor lo tiene quieto en su sitio). Cada jugador doma su copia.
  - **Doma, parte 1:** A a ≤4 m → "Sale disparado". Aparecen **6 anillos** en el agua (sembrados, 10–14 m entre sí, todos nadables a pie); el siguiente brilla, y una línea arriba dice "Anillo 3/6 · 5 s". El servidor cuenta un anillo cuando tu posición validada pasa a ≤2,2 m de su centro, en orden, antes de 7 s. Si no: "Se escapa" y 3 s de espera.
  - **Doma, parte 2:** el anillo del ciervo, **2 rondas** (3,0 → 4,2 rad/s, zona 1,1 → 0,75). Un amigo a ≤6 m la ensancha ×1,5. Un fallo: "Se sacude y se va. Otra vez" (vuelves a la carrera tras 3 s).
  - **Montar:** 9 m/s, sprint 14 sin gastar aguante; tope del servidor 15 (+2 s de gracia al bajar). Solo en agua: ni playa, ni Ciénaga, ni **aguas bravas** (30 m alrededor de la isla de la mazmorra). **B / Espacio mantenido = bucear** a 3 m/s hasta el fondo + 0,5; al soltar sube a 4 m/s. Sin límite de aire. La corriente del mar hondo no afecta al pez.
  - **Bajar:** A (E/M) donde hay <1 m de fondo; en hondo: "Aquí es hondo. Acércate a la orilla". El pez espera allí y A junto a él vuelve a montar. Morir o entrar en la mazmorra te baja.
- Decisiones/desvíos:
  - Sin mensaje `tame` nuevo: `mount` gana los actos 6 (carrera), 7 (montar el pez) y 8 (bajar); el acto 1 (toque del anillo) sirve para las dos bestias. `TameView` lleva `beast`.
  - `PlayerView.ride` pasa de booleano a `'deer' | 'fish' | null` (tests del ciervo adaptados a la unión, cambio buscado). `snap.fish` trae el pez salvaje y los aparcados; `SelfState` gana `fish`, `onFish` y `race`. Los anillos no viajan: el cliente los calcula con la semilla.
  - El pez es una figura de cajas (azul con aletas naranjas), como el ciervo. Los anillos son toros amarillos/blancos sobre el agua.
  - En el pez no se puede montar el ciervo ni subir detrás de nadie.
- Verificado en navegador: no (solo tests + build).
- Bloqueos: ninguno.
- Qué probar: bajar a la playa (a caballo), nadar al halo dorado, A, seguir los anillos (¿7 s es justo nadando rápido?), calmarlo con 2 toques. Montado: sprint por el mar, mantener B para bajar al fondo, intentar entrar en la playa y cerca de la isla (se para), volver a la orilla y A para bajar. Constantes: `FISH` en `src/shared/fish.ts`.

## Slice 2 · S2-C — santuarios de la Costa, cofres hundidos, perlas y mejora de arma — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S2-C-santuarios-costa.md` (da01fdb).
- Commits: 94818d5 (T1 reglas: `src/shared/coast-shrines.ts`, perla, `UPGRADE`), 9b06fcb (T2 santuarios en el servidor, protocolo v15), 81712a9 (T3 cofres, perlas y mejora, v16), f1408be (T4 cliente).
- Tests: npm test 351 (antes 325), test:workers 12, check + build verdes. PROTOCOL_VERSION = 16. Campos guardados nuevos opcionales `SavedPlayer.chests` y `SavedPlayer.weaponLvl`: las partidas viejas cargan.
- Cómo funciona:
  - **Tres santuarios más** (ids 3–5, en la misma lista que los del bosque: mismo orbe de +20 de aliento, uno por jugador, estado del acertijo compartido y solo en vivo).
    - **Marea** (playa): losa a 12 m del orbe. La pisa un amigo, o se lleva la **piedra pómez** con A (A otra vez la suelta donde estás). Encima de la losa, la verja se queda abierta. Si quien la lleva muere o se va, la suelta allí.
    - **Hundido** (playa + bajíos): una palanca en la arena y otra en el fondo, a ~40 m mar adentro (2–4 m de fondo). La del fondo solo cede buceando (a ≤2 m del fondo; en la superficie: "Está en el fondo"). Las dos en **8 s**.
    - **Islote** (islote 1): verja-molino con **3 ruedas**, las tres en 6 s. Con una sola: "La verja-molino no se mueve. Quizá con viento… o con tres manos".
  - **6 cofres** en el mar hondo, alrededor de 2 ruinas sembradas, lejos de islotes y aguas bravas. Una columna de luz tenue sube hasta la superficie. A buceando junto a uno (≤2,5 m y ≤2 m sobre él) lo abre: 6–10 de madera, piedra o bayas y **1 perla**. Uno por jugador (`SavedPlayer.chests`).
  - **Mejora de arma:** A junto al Corazón con 3 perlas + 10 piedra + 5 madera → +15 % de daño a puño y arco, hasta +3 ("Arma +N" en la mochila).
- Decisiones/desvíos:
  - **Viento no existe todavía (S2-F).** El Islote se construye ya y se abre con tres jugadores. Solo, es un santuario de "vuelve luego". Hay marcas `// S2-F` en `onShrinePart` para la ráfaga (girar el molino y empujar la pómez).
  - **No hay forja en el juego:** la mejora se compra en el Corazón, con un coste fijo. Si el Corazón está dañado, A primero lo cuida (bayas) y después mejora.
  - La piedra pómez **no frena** (igual que el bloque de raíz de la mazmorra). El spec pedía 3 m/s, pero eso exige predicción en el cliente.
  - Los orbes de la Costa **no limpian zonas del bosque**. Las zonas de la Costa llegan en otro plan, y ahí el orbe limpiará la más cercana.
  - Cambio de regla con test adaptado: "old saves load" ahora espera 6 santuarios (antes 3). Los tests de versión de protocolo pasan a 16.
  - Con la pómez en la mano, A siempre la suelta primero (antes que pegar).
- Verificado en navegador local (Chromium headless 1000×600, semilla 42): entra sin errores de consola. El snap trae los 6 santuarios (el 3 con `block`), `chests: []` y `weapon: 0`. Con la partida importada en la playa y 3 perlas, la mochila muestra "Piedra 12 · Perlas 3". NO verificado: ver los santuarios y los cofres en pantalla, bucear hasta un cofre, la mejora en vivo, ni en móvil.
- Bloqueos: ninguno.
- Qué probar: en la playa, buscar los dos haces de luz. En Marea: coger la pómez, llevarla a la losa, soltarla y tomar el orbe. En Hundido: montar el pez, bucear hasta la palanca del fondo, volver a la de la arena en menos de 8 s (¿da tiempo solo?). En el islote 1, con tres, girar las ruedas. En el mar hondo: seguir la luz, bucear y abrir un cofre. Con 3 perlas, ir al Corazón y mejorar. Constantes: `COAST_SHRINE`/`CHEST` en `coast-shrines.ts`, `UPGRADE` en `items.ts`.

## Slice 2 · S2-D — corrupción de la Costa — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S2-D-corrupcion-costa.md` (689cab7).
- Commits: dd3b840 (T1 zonas de la Costa, reglas), 0e5d652 (T2 servidor, protocolo v17), ca7c7fa (T3 cliente: tinte del mar lejano).
- Tests: npm test 363 (antes 351), test:workers 12, check + build verdes. PROTOCOL_VERSION = 17. Sin campos guardados nuevos: `cleansed` ya guardaba ids; las partidas viejas cargan con las 4 zonas de la Costa corruptas.
- Cómo funciona:
  - **4 zonas más** (ids fijos 6–9, en la misma lista que las del bosque, `allZones`): 6 = la Raíz-madre de la Costa en la isla de la mazmorra, 7 en la playa, 8 en los bajíos, 9 en el último islote. Mismo tinte morado y misma raíz marchita; misma regla nocturna (+2 bestias por jugador dentro).
  - **Orbes:** un orbe de la Costa limpia la zona corrupta de la Costa más cercana (7–9, nunca la 6): "La luz del santuario limpia un trozo de costa". Un orbe del bosque ya nunca limpia la Costa.
  - **Presión en los asedios:** mientras la zona 6 siga corrupta, cada asedio trae **+1 bruto por cada 2 zonas corruptas de la Costa** (4 corruptas → +2, encima de `maxWave` y también con el Tragón purificado). El aviso del atardecer añade "Algo sube de la costa". Los asedios siguen viniendo de la zona corrupta más cercana al Corazón (casi nunca una de la Costa).
- Decisiones/desvíos:
  - Ids de la Costa fijos 6–9 aunque un mundo tenga menos de 6 zonas en el bosque: los `cleansed` guardados nunca se desplazan.
  - La **Enredadera no limpia la Costa**; lo hará el Viento (marca `// S2-F`). La zona 6 solo se limpia venciendo al jefe de la Costa (S2-G). Hasta entonces, con los 3 orbes de la Costa tomados quedan 6 sola → la presión baja a 0 (1 zona corrupta / 2 = 0).
  - Cambios de regla con tests adaptados (ninguno borrado): 4 tests de asedio del bosque limpian la zona 6 antes de contar la ola (`calmCoast`); el test de S2-C "un orbe de la Costa no limpia el bosque" ahora mira solo las zonas del bosque. Versión de protocolo en los tests → 17.
  - El mar lejano (malla gruesa) ahora también se tiñe, porque la isla y los islotes caen en ella.
- Verificado en navegador: no (solo tests + build).
- Bloqueos: ninguno.
- Qué probar: ir a la playa y buscar la mancha morada; pasar una noche dentro (más bestias). Tomar un orbe de la Costa y ver qué mancha desaparece. En casa, al atardecer: "Algo sube de la costa" y dos brutos de más; tras limpiar dos zonas de la Costa, uno. Constantes: `COAST_ZONES`, `coastRaidBrutes` en `corruption.ts`.

## Slice 2 · S2-E — la Ballena — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S2-E-ballena.md`.
- Commits: 11fe1dc (T1 reglas: `src/shared/whale.ts`), a244788 (T2 doma entre varios, protocolo v18), 2b55824 (T3 asientos, piloto, aguas bravas, vuelta a casa), 5d8edc9 (T4 cliente).
- Tests: npm test 388 (antes 368), test:workers 12, check + build verdes. PROTOCOL_VERSION = 18. Campo guardado nuevo opcional `SavedWorld.whale` (dónde flota la ballena domada): las partidas viejas cargan con la ballena salvaje.
- Cómo funciona:
  - **Ballena salvaje:** una por mundo, sembrada en el mar hondo (≥8 m de fondo, lejos de islotes y aguas bravas). Resopla un chorro alto que se ve desde lejos (el `snap.whale` va siempre, a todos).
  - **Doma (decisión de Gabriel: nunca solo):** A a ≤10 m. Con uno solo: "Con uno solo no se deja. Hacen falta dos". Con dos o más a ≤10 m sale el anillo del ciervo a **todos** los de alrededor, **4 rondas** (2,2 → 4,8 rad/s, zona 1,2 → 0,55), zona ×(1 + 0,4 por jugador extra, hasta 3). Cualquiera pulsa; el primer toque bueno cuenta y el de un amigo que llega tarde a esa ronda se ignora (no la estropea). Un toque malo, 8 s sin tocar o quedarse menos de dos: "La ballena se sumerge. Otra vez en 10 s".
  - **Es del mundo:** "La ballena es del mundo. A junto a ella para subir".
  - **4 asientos:** A a ≤5 m sube al primer libre; el primero **pilota** ("Llevas la ballena"). Quinto: "No queda sitio". El servidor coloca a los pasajeros cada tick e ignora sus `move` (salvo mirar). Si el piloto baja, el siguiente pasa a pilotar.
  - **Pilotar:** 5 m/s, sprint 7 (tope del servidor 8), en la superficie, nunca con menos de 3 m de fondo ("La ballena no cabe"). **Cruza las aguas bravas**: es la llave de la isla de la mazmorra.
  - **Bajar:** A (E/M). Caes al agua 3 m al costado; si tu pez espera a ≤8 m, vuelves a estar encima. Subir desde el pez lo deja esperando donde estabas. Morir, irse o entrar en la mazmorra te baja.
  - **Vuelta a casa:** sin nadie encima durante 10 min de tiempo con alguien conectado, reaparece en su sitio.
- Decisiones/desvíos:
  - Sin mensaje nuevo: `mount` gana los actos 9 (domar), 10 (subir) y 11 (bajar); el acto 1 sirve también para la ballena. La doma es estado del mundo y se muestra como `self.tame` con `beast: 'whale'`, así el anillo del cliente no cambia.
  - "En rango" = vivo, conectado y a ≤10 m (no se exige ir en pez: al mar hondo solo se llega en pez o ballena).
  - La salvaje está quieta en el servidor; el cliente la mece. Volver a casa es un salto (una ruta nadando podría encallar en un islote); el cliente la suaviza.
  - El cuerpo del piloto es el asiento 0 (1,6 m delante del centro); girar en el sitio hace pivotar la ballena alrededor del piloto.
  - Figura de cajas azul oscuro con chorro blanco (alto si es salvaje, bajo si es domada; desaparece al sumergirse).
  - Cambio de regla con test adaptado: versión de protocolo en los tests → 18.
- Verificado en navegador: no (solo tests + build).
- Bloqueos: ninguno.
- Qué probar: con dos jugadores en pez, ir al chorro del mar hondo, A, calmarla entre los dos (¿4 rondas son muchas?). Probar solo (debe negarse). Subir los dos, pilotar hasta la isla cruzando las aguas bravas, intentar entrar en los bajíos (se para), bajar junto al pez. Dejarla lejos 10 min y ver que vuelve. Constantes: `WHALE` en `src/shared/whale.ts`.

## Slice 2 · S2-F — mazmorra de la Costa y el Viento — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S2-F-viento-mazmorra.md` (f3c7e08).
- Commits: c454549 (T1 reglas: `src/shared/viento.ts`, `src/shared/coast-dungeon.ts`), 6bcaf9b (T2 mazmorra en el servidor, protocolo v19), 4dae55e (T3 la ráfaga), 7f72b0d (T4 bruto escudado), da7d50d (T5 cliente).
- Tests: npm test 417 (antes 388), test:workers 12, check + build verdes. PROTOCOL_VERSION = 19. Campo guardado nuevo opcional `SavedPlayer.viento`: las partidas viejas cargan.
- Cómo funciona:
  - **Entrada:** el tronco gris verdoso de la **Raíz-madre de la Costa** está en la isla de la mazmorra, 5 m al norte del centro (el centro es la raíz marchita de la zona 6). Solo se llega en ballena. A / E junto al tronco → dentro (quien va en la ballena baja; la ballena se queda).
  - **Interior** en `x = HALF + 300`, 24 × 180 m, suelo plano a 30 m, cálido. Cuatro verjas:
    1. **Palancas** (como en el bosque, 6 s) → verja 0.
    2. **Altar del Viento** (A / E) → `viento` guardado.
    3. **Molino** (verja 1): una ráfaga lo gira y se abre.
    4. **Piedra pómez + canal de 10 m + losa:** la pómez solo se mueve a ráfagas (6 m cada una; tres la llevan del inicio a la losa). A pie, el canal solo se cruza por un **puente estrecho** junto a la pared oeste. Con la pómez en la losa, la verja 2 se abre para siempre (hasta reiniciar la sala). La losa no cuenta a los jugadores.
    5. **Sima de 20 m** (sin verja): planear + la subida del Viento. Si caes 4 m por debajo del borde, vuelves al borde con −10 PV ("El hueco te escupe arriba").
    6. **Bruto escudado** (420 PV): el bruto reforzado con un escudo delante. De frente, golpes y flechas no entran ("El escudo para el golpe…"). Una ráfaga lo gira y queda **expuesto 3 s**; una parada también. Al caer, verja 3.
    7. **Sala del jefe:** vacía y lista para S2-G ("La sala está en calma. Algo duerme bajo la marea").
  - **Viento** (H / botón de poder): cono de 8 m y 70°, 6 s de enfriamiento propio (el de la Enredadera sigue aparte). Bestias: empujadas 6 m, aturdidas 1 s, −5. Jefes, élites y El Marchito: 2 m. Lobos y asaltantes que acaban en mar de más de 4 m: "Se los lleva el mar" (máx. 3 por ráfaga). Caída de más de 3 m: −20. Estacas y red funcionan solas.
  - **Planeando**, la primera ráfaga del vuelo te sube 6 m (el servidor acepta la subida 2 s; al tocar suelo o agua se recarga).
  - **Cambio de poder (decisión de Gabriel):** H lanza, **J cambia**; en táctil, tocar lanza y **mantener 0,5 s** cambia. El icono del botón pasa de 🌿 a 🌬️. El Menú lo explica. La elección es del cliente y viaja en `power.kind`; el servidor comprueba que lo tienes.
  - **Marcas `// S2-F` resueltas:** el santuario **Islote** se abre con una ráfaga a sus ruedas (ya se puede solo); la pómez de **Marea** se desliza con una ráfaga (si nadie la lleva); una ráfaga a ≤5 m de la raíz marchita de una zona de la Costa (7–9) la limpia ("El viento arranca la raíz marchita. La costa respira"). La 6 no: eso es del jefe (S2-G).
- Decisiones/desvíos:
  - **Sin refactor a `DUNGEONS[]`:** `DUNGEON`/`inDungeon` siguen siendo el bosque; la Costa tiene `COAST_DUNGEON`/`inCoastDungeon`, y `inAnyDungeon` cubre lo común (calor, sin monturas, límites). `withDungeon` y `clampStep` cubren las dos (menos líneas tocadas).
  - Cuatro verjas, no cinco: la sima no necesita verja.
  - En el canal la pómez no se lleva en brazos: solo ráfagas. Por eso la losa solo cuenta la piedra (si no, bastaba con cruzar el puente y pisarla).
  - `SelfState` gana `viento` y `windLeft` (no `powers: string[]`: menos cambio).
  - El bruto escudado es el zorro a escala 2,4 con una tabla azul delante; no tiene modelo propio.
  - Cambios de regla con tests adaptados (ninguno borrado): `decodeClient` acepta `dungeon` hasta 12 (el test que rechazaba 8 ahora rechaza 13); versión de protocolo en los tests → 19.
  - ponytail: los golpes de la pómez con los muros solo se sujetan a la sala (no choca con nada más). La subida del Viento es una ventana de 2 s con techo +6,5 m, no física.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: en ballena hasta la isla, A junto al tronco. Palancas, altar (J / mantener el botón para cambiar a 🌬️). Ráfaga al molino. Tres ráfagas a la pómez hasta la losa, cruzando por el puente. En la sima: correr, saltar al vacío, B para planear y H a medio camino (¿llega?). Bruto escudado: pegar de frente (nada), ráfaga y pegar rápido. Fuera: ráfaga a las ruedas del Islote, a la pómez de Marea y a una raíz morada de la playa. De noche, en la orilla, empujar lobos al mar. Constantes: `VIENTO` en `src/shared/viento.ts`, `COAST_DUNGEON` en `src/shared/coast-dungeon.ts`, `ELITE.exposedFor`.

## Slice 2 · S2-G — El Antenón y el defensor del viento — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S2-G-antenon.md` (5b5009d).
- Commits: f8004f5 (T1 reglas: `src/shared/sim/antenon.ts`, pilares de coral), 08f11d1 (T2 el combate en el servidor, protocolo v20), 72dfa16 (T3 el Antenón blanco), 2041b0f (T4 cliente).
- Tests: npm test 434 (antes 417), test:workers 12, check + build verdes. PROTOCOL_VERSION = 20. Campo guardado nuevo opcional `SavedWorld.purified2`: las partidas viejas cargan.
- Dibujo: `public/enemies/enemy3.png` (512 × 353) **tiene transparencia de verdad** (69 % de píxeles con alfa 0, esquinas transparentes). No hizo falta recortar el blanco. Va por `PaperActor` como el Tragón (4 m de alto).
- Cómo funciona:
  - **Sala del jefe** de la mazmorra de la Costa (z 150–180, tras la verja 3). Ya no dice "Algo duerme bajo la marea": al entrar, **El Antenón despierta**. Cuatro **pilares de coral** (rosas, radio 1 m) en (±5, 160) y (±5, 172); nadie los atraviesa.
  - **360 PV** y **cáscara de marea**: golpes, flechas y ráfagas no le hacen nada ("La cáscara de marea aguanta. Empújalo contra el coral, o párale") salvo si está **expuesto**:
    - **5 s** si una ráfaga del Viento lo **empuja contra un pilar** (el empuje de jefe, 2 m, avanza en pasos de 0,25 m; si toca coral se para ahí: "¡Contra el coral! La cáscara se abre", y queda aturdido 1 s). Una ráfaga en suelo libre solo lo mueve.
    - **3 s** tras una **parada**.
  - **Ataques anunciados:** **barrido de antenas** (si estás a ≤3,5 m: 0,8 s de aviso con un anillo rojo de 4 m en el suelo, 10 de daño a todos dentro; rodar lo esquiva) y **carga** (a 5–14 m: 1,0 s de aviso con una franja roja en la dirección fijada, luego 12 m/s durante 0,8 s, 14 de daño, una vez por jugador; se para en pilares y muros). La barra dice "El Antenón 360/360 · cáscara / ¡expuesto! / ¡barrido! / ¡carga!". Expuesto se tiñe dorado.
  - **Balance:** quieto a su lado recibes 10 cada ~4,3 s → aguantas **~43 s** con 100 PV (test: < 100 de daño en 30 s).
  - Sala vacía → desaparece y vuelve con la vida llena.
  - **Al vencerlo:** `purified2 = true`, se limpia la **zona 6** (la Raíz-madre de la Costa): `coastRaidBrutes` pasa a 0, se acaban los brutos de más y el "Algo sube de la costa". **Visión** del Marchito con los nombres de los presentes ("Primero el papel, ahora la cáscara. Ana.").
  - **Antenón blanco:** pequeño, junto al Corazón (2,5 m al oeste; el Tragón está al este). Cada **8 s**, si hay asaltantes a ≤12 m del Corazón, los empuja **a todos 6 m hacia fuera** y los aturde 1 s ("El Antenón sopla…"); estacas y red hacen el resto. No pega, no muere. Destello blanco del cono al soplar.
- Decisiones/desvíos:
  - "Empujado contra un pilar" = el empuje de 2 m toca coral en el camino. Hay que atraerlo cerca de un pilar y soplar desde el otro lado.
  - La ráfaga siempre lo empuja; el arañazo de 5 solo entra si ya está expuesto (como el papel del Tragón).
  - El defensor no ahoga (sin agua cerca del Corazón no importa; así no toca el tope de 3).
  - `snap.ally2` aparte de `snap.ally` (no una lista): menos cambio.
  - Cambios de regla con tests adaptados (ninguno borrado): el test de S2-F "la sala del jefe espera, en calma" ahora espera que El Antenón despierte; versión de protocolo en los tests → 20.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: pasar el bruto escudado y entrar en la sala. Atraerlo junto a un pilar, colocarse al otro lado y 🌬️: ¿se lee que se abre? Parar el barrido con 🛡️ justo antes del golpe. Rodar el anillo rojo; apartarse de la franja de la carga. ¿El dibujo se ve bien de tamaño en móvil? Tras vencerlo: la visión, la mancha de la isla limpia, de noche el Antenón blanco soplando junto al Tragón. Constantes: `ANTENON` y `ANTENON_ALLY` en `src/shared/sim/antenon.ts`, `COAST_DUNGEON.pillars`, `ENEMY.boss2`.

## Slice 2 · S2-H — Invasión 2: El Marchito se lleva al Tragón, y el rescate — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S2-H-invasion2-rescate.md` (bbc9b6c).
- Commits: 0843906 (T1 reglas: `src/shared/rescue.ts`, `stepThief` en `marchito.ts`), 0adb6ad (T2 la invasión en el servidor, protocolo v21), f3f41ac (T3 jaula, anclas, guardias y rescate, v22), 58233ae (T4 cliente).
- Tests: npm test 456 (antes 434), test:workers 12, check + build verdes. PROTOCOL_VERSION = 22. Campos guardados nuevos opcionales `SavedWorld.invasion2` ('pending' | 'taken' | 'rescued') y `SavedWorld.anchors`: las partidas viejas cargan.
- Cómo funciona:
  - **Disparo:** cuando alguien doma un pez, `invasion2 = 'pending'`. En la franja del aviso de asedio (atardecer), si la Invasión 1 ya pasó, el Tragón está purificado, hay Corazón vivo y alguien fuera de las mazmorras, **El Marchito sube desde el sur** (28 m del Corazón, lado de la costa) con voluntad ×1,2 ("Esta vez no mira los muros").
  - **El robo:** va recto al Tragón blanco y lo **envuelve en raíces 6 s** (barra: "El Marchito envuelve al Tragón · 40 % · voluntad …"; el Tragón se queda quieto). Sigue dando zarpazos (14) a quien esté a 3 m. Al terminar se lo lleva y **rompe el cuarto de defensas más cercano** al Corazón. Visión: «Me llevo al perrito de papel. Vengan a por él al mar, Ana.»
  - **Echarlo antes** (voluntad a 0) **no evita el robo**: se va con el Tragón en ese momento, pero **sin romper nada** ("Los muros, otro día").
  - **Sin Tragón:** de noche no hay defensor que muerda (el Antenón blanco sigue si lo tienen).
  - **La jaula:** en el fondo, justo fuera de las aguas bravas de la isla (hacia el norte si cabe), se llega con el pez. Barrotes oscuros con el papel pálido dentro; baja 1,5 m por cada ancla rota.
  - **Anclas:** una por islote (a 0,3 r al norte del centro, en tierra): raíz marchita con brillo violeta y una cadena morada hacia el cielo. **150 PV**; golpes y flechas normales; una **ráfaga del Viento pega ×3** (15). Van en `snap.wolves` como `kind: 'anchor'`, así que fijar, arco y auto-apuntado funcionan; no se mueven ni muerden. Al romperse: "Se parte una cadena. La jaula baja. Quedan 2".
  - **Guardias:** la primera vez (por carga de la sala) que alguien vivo llega a `r + 12` m de un islote con el ancla en pie salen **2 lobos** junto a ella ("Unos lobos marchitos guardan el ancla").
  - **Liberar:** E / A a ≤5 m de la jaula. Con anclas en pie: "La jaula aguanta: quedan 2 anclas en los islotes". Con las 3 rotas: `invasion2 = 'rescued'`, el Tragón vuelve junto al Corazón y **muerde 35 (25 + 10, "con rabia")**; visión del Marchito enfurruñado con los nombres.
- Decisiones/desvíos:
  - **Mundos que nunca purificaron al Tragón:** no pasa nada; la invasión espera hasta que se cumplan todas las condiciones (el primer atardecer tras purificarlo). Sin jaula ni anclas.
  - Partidas viejas donde alguien ya tenía pez cargan como 'pending' (vendrá al próximo atardecer). Un pez domado durante el propio atardecer puede dispararla ese mismo día (lo más simple).
  - Guardar a mitad del robo deja 'pending': vuelve en la siguiente franja de atardecer; lo roto sigue roto.
  - El Marchito desaparece en el acto al llevárselo (sin animación de irse al mar).
  - El daño parcial de las anclas es solo en vivo (al recargar, las que siguen en pie vuelven a 150); las rotas quedan rotas (`anchors`). Los guardias salen una vez por carga, y el amanecer los borra como a cualquier lobo.
  - Mensaje nuevo `{ t: 'rescue' }` (validado en `decodeClient`, el servidor comprueba estado, distancia y anclas). Sin pastilla nueva: E / botón A contextual. Línea nueva en el Menú.
  - La visión de robo usa "Vengan" (ustedes, como el resto del juego) en vez de "Venid" del spec.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: con Invasión 1 hecha y el Tragón purificado, domar el pez y esperar al atardecer junto al Corazón: ¿se ve venir del sur? ¿Se lee la barra de "envuelve"? Probar echarlo (con 2 jugadores, voluntad 504) y no echarlo (¿qué muros rompe?). Pasar una noche sin Tragón. Buscar las cadenas moradas desde la playa, ir a cada islote en pez, pelear los 2 lobos, romper el ancla a golpes y con 🌬️. Ver bajar la jaula. Bucear hasta ella y A. De noche, el Tragón con rabia. Constantes: `RESCUE` en `src/shared/rescue.ts`, `MARCHITO.grabFor` y `thiefWill` en `src/shared/sim/marchito.ts`, `ALLY.rage`.

---

# Fase 3 — Resto del roadmap (autónomo, desde 2026-09-27)

Gabriel: "haz el resto de los subproyectos en orden con el menor input mío; guíate por mis respuestas pasadas; añade buenas ideas". Tutorial/onboarding: **al final**, dentro de #7 Pulido.

Rama: `aventura/resto` (desde main tras el merge del PR #2). PR draft; **merge solo con OK de Gabriel**.

Orden (roadmap "content first", #3+#5 = Aventura por biomas, #4 plegado en cada slice):
1. Slice 3 — Pantano
2. Slice 4 — Montañas
3. Slice 5 — Tierras Corruptas (torre, Invasión 3, asalto final, dragón)
4. #4 Progresión (lo que no se plegó: niveles/habilidades/tiers/apariencia)
5. #6 Tiendas y economía
6. #2 Mundo y visuales
7. #7 Pulido (incluye tutorial)

Criterios para decidir sin preguntar (sacados de respuestas pasadas): opción más simple que respete el spec; co-op que no bloquee al que juega solo salvo cuando es el gancho (ballena); no tocar balance del Corazón; nombres provisionales en `src/shared/names.ts`; dibujos de los sobrinos como papel espíritu; rejilla táctil ≤10; decisiones anotadas como "Decidido por Claude — revisar".

## Slice 3 — resumen (LEER PRIMERO)
- **S3-A a S3-G: todos hechos, ninguno bloqueado.** Rama `aventura/resto`, PR draft #3. Nada mergeado ni desplegado.
- Tests finales: npm test 610, test:workers 12, check + build verdes. **PROTOCOL_VERSION = 31.** Todos los campos guardados nuevos son opcionales: las partidas viejas cargan (y simplemente reciben un Pantano).
- **Qué hay:** S3-A el Pantano al oeste (ciénaga alta, 12 montículos, Laguna Negra), el Zarzal que muerde y la Boca del Río · S3-B la Rana (nenúfares + anillo, salto alto con B) · S3-C santuarios 6–8 (Candiles, Nenúfares, Turba), 6 árboles de ámbar y la Capa de corteza · S3-D zonas 10–13 y La Gata Araña (1 de cada 3 asedios) · S3-E mazmorra del Pantano, el Fuego (🌿→🌬️→🔥), bruto de turba y hoguera · S3-F El Zancudo (enemy9), el farol del Zancudo blanco y el nudo del Zarzal · S3-G fogatas (viaje rápido de día) y las visiones del Pantano. Arreglo suelto: el bruto de turba y El Antenón compartían id de enemigo (900_003); ahora el bruto es 900_004 y un test vigila que no se repitan.
- **Decidido por Claude — revisar (lo gordo):** el Zarzal mide 64 m (si no, se planeaba por encima); la antorcha no frena y se gasta en cada brasero/fogata; la Gata en asedios múltiplo de 3 aunque nadie haya visto aún el Pantano; arena del Zancudo 24 × 30; nudo del Zarzal en un punto fijo (x = −HALF+8, z = 120); las fogatas solo viajan al/desde el Corazón (no entre fogatas) y no se puede viajar montado; visión de entrada al Pantano una vez por mundo (los mundos que ya lo habían visto no la reciben).
- **Balance a revisar:** Zarzal 10 PV/s y ciénaga al 60 %; rana 8/11 m/s y salto 7 m; nenúfares 6 s (rana) y 1,5 s (santuario); Candiles 12 s; ámbar 2 por árbol cada 2 días y Capa −10 %/nivel; Gata 300 PV y aura +20 %; sala del gas 10 s; tablas 1,2 s; bruto de turba 480 PV y +10 PV/s en charco; El Zancudo 380 PV (~31 s quieto debajo); farol cada 10 s; hoguera 4 madera + 2 ámbar; fogatas 5 s de canal. Constantes: `ZARZAL`, `BOG`, `FROG`, `SWAMP_SHRINE`, `AMBER`, `CAPA`, `GATA`, `FUEGO`, `HOGUERA`, `SWAMP_DUNGEON`, `ENEMY.elite3`, `ZANCUDO`, `FAROL`, `FOGATA`.
- **Nada del Slice 3 se probó a fondo en navegador real** (S3-A se miró en headless). Es lo primero.
- **Qué probar (en orden de historia):** ir al oeste a pie (el Zarzal mata) → pez por la Boca del Río hasta la Laguna (visión «¿Te gusta mi niebla?») → antorcha de Candiles a una fogata (encenderla) → domar la rana → Candiles, Nenúfares, ámbar, Capa → de día, A en la fogata → Corazón en 5 s; Menú en el Corazón → fogata → noche con la Gata (3.er asedio) → mazmorra del Pantano, Fuego, bruto de turba → El Zancudo → farol de noche → quemar el nudo del Zarzal (visión) y entrar andando con un amigo → Turba con Fuego. En móvil: rejilla de 10, cambio de poder con pulsación larga, A contextual en fogatas.

## Slice 3 · S3-A — el Pantano, el Zarzal y la Boca del Río — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S3-A-pantano-zarzal.md` (2d2dc69).
- Commits: 25c0d1e (T1 terreno del Pantano, límites en unión, nombres), 862b55d (T2 Zarzal, ciénaga alta y río en el servidor, protocolo v23), 9e148b9 (T3 movimiento en el cliente), 8ac1a4f (T4 malla, espinas y niebla).
- Tests: npm test 476 (antes 456), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 23** (el terreno cambió: cliente y servidor tienen que coincidir). Sin campos guardados nuevos: las partidas viejas cargan.
- Cómo funciona:
  - **Mapa:** crece al oeste: `SWAMP` = x de −HALF−180 a −HALF, z de 40 a HALF+150. Todo lo que está al este de −HALF es igual que antes, salvo el cauce del río (x < −HALF+30). Una costura de 12 m arranca a la altura del borde del bosque/costa. Dentro hay **ciénaga alta** (agua de 0,3 m casi toda, algunas pozas de hasta 1,5 m), **12 montículos** sembrados (`swampFeatures`), la **Laguna Negra** (elipse de 5 a 8 m de fondo al sur) y bordes de colinas. `inMap`/`clampMap` usan la unión de los dos rectángulos (con 1 m de solape en x = −HALF para que la costura se pueda cruzar).
  - **Boca del Río:** canal de 16 m de ancho y 5 m de fondo en z = HALF+103, desde el mar hondo de la Costa (x = −HALF+30) hasta la Laguna (x = −HALF−80). A pie, "La corriente te devuelve" (más de 4 m), pero **río abajo (hacia el este) siempre se puede nadar**, así que nadie se queda atrapado. El pez y la ballena lo cruzan. En el Pantano el pez necesita ≥1 m de agua (en la ciénaga alta no entra).
  - **El Zarzal:** espinas en tierra seca o con menos de 1 m de agua, desde x = −HALF+4 (borde del bosque) hasta x = −HALF−60, en toda la franja z del Pantano. Muerde **10 PV/s** a pie, al jinete del ciervo y al pasajero ("El Zarzal muerde. Las espinas no respetan al ciervo"). Frena a todos a **3 m/s**. El servidor lo valida con la misma regla de ventana completa que la Ciénaga.
  - **Ciénaga alta:** a pie vas al **60 %** (servidor: tope 9 × 0,6). El ciervo no se frena ahí.
  - **Cliente:** una malla del Pantano con celdas ×2, espinas instanciadas (unas 220, un solo draw call), el quad de agua ensanchado y colores propios (ciénaga oliva oscuro, espinas gris violeta, montículos verde oscuro, fondo de la Laguna casi negro). **Niebla:** entra en 20 m (`swampFog`) y cierra hacia near 35 / far 70. Dentro del todo, el plano lejano de la cámara baja a 100 m.
  - **Nombres:** los doce de §12 están en `names.ts`. El test de nombres también prohíbe escribir a mano "Pantano" y "Zarzal".
- Decidido por Claude — revisar:
  - **El Zarzal es de 64 m, no de 16 + 30.** Con el planeador (7 m/s, cae 1,6 m/s) se planean unos 50 m desde el borde del bosque (~9 m de alto). Una franja de 60 m dentro del Pantano obliga a pisar espinas. Por eso la Laguna empieza en x = −HALF−65 y el río mide 110 m (llega hasta −HALF−80).
  - Sin peñascos a menos de 64 m del borde oeste. En mundos viejos desaparecen los de esa franja, y algún santuario o zona que dependiera de uno podría moverse.
  - La ciénaga alta es casi toda de 0,3 m para que se vadee (el cliente pasa a nadar con más de 0,6 m). Algunas pozas son más hondas y ahí se nada, que ya es lento.
  - "Río abajo" es cualquier paso hacia el este dentro del cauce (x de −HALF−80 a −HALF+30). No hace falta regla nueva de salida en la Laguna: de lo hondo siempre puedes ir a menos fondo.
  - Las espinas no muerden a quien va en pez o en ballena (siempre están en ≥1 m de agua).
  - Plano lejano: un solo número (100 m) para todos los niveles en vez de 90/120/160. La niebla ya lo tapa todo a 70 m.
  - Protocolo v23 sin mensajes nuevos: el cambio de versión existe porque cambió el terreno.
- Rendimiento móvil: la malla del Pantano añade 1.829 vértices en gama baja (160 segmentos, celdas de 6 m; +5,6 % sobre ~32.600) y ~4.100 en alta. Suma **+2 draw calls** (malla y espinas). El agua sigue siendo un solo quad. En el Pantano la niebla y el plano lejano de 100 m recortan lo que se dibuja.
- Verificado en navegador local (Chromium headless 1000×600, mundo `pantano`, semilla 42): tras importar la partida con Ana en (−340, 160), se ven el agua de la ciénaga, un montículo verde oscuro, espinas oscuras a lo lejos y una colina del borde. Sin errores de consola. NO verificado: cruzar el Zarzal andando, el río en pez o en ballena, la niebla de noche ni el móvil.
- Bloqueos: ninguno.
- Qué probar: ir al oeste a pie desde el bosque (z ≈ 100): ¿mata el Zarzal antes de llegar al interior? ¿Se entiende el aviso? Probar a caballo: también muere. Planear desde lo alto del borde: ¿se aterriza todavía en espinas? En la Costa, ir en pez hacia el oeste pegado a z ≈ HALF+103 (≈343), buscar la boca, remontar el río hasta la Laguna y bajar en un montículo. A pie en la ciénaga alta: ¿el 60 % se hace pesado? Meterse en el río a pie y dejarse llevar hacia el mar. En móvil: fps con la niebla. Constantes: `SWAMP`/`RIVER`/`LAGUNA` en `terrain.ts`, `ZARZAL`/`BOG`/`FOG_BLEND` en `src/shared/swamp.ts`, `SWAMP_FAR` en `game.ts`.

## Slice 3 · S3-B — la Rana — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S3-B-rana.md` (529dd97).
- Commits: abb2010 (T1 reglas: `src/shared/frog.ts`), 488951c (T2 domarla en el servidor, protocolo v24), eecb602 (T3 montarla y el salto alto), 6a2565b (T4 cliente).
- Tests: npm test 499 (antes 476), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 24**. Campo guardado nuevo opcional `SavedPlayer.frog`: las partidas viejas cargan.
- Cómo funciona:
  - **La rana salvaje** espera en el montículo más cercano a la orilla norte de la Laguna Negra, con halo dorado y la garganta que brilla (no la tapa la niebla).
  - **Domarla:** A a ≤4 m → "Salta al agua. Sigue los 3 nenúfares, 6 s cada uno". Los 3 nenúfares (sembrados, 8–12 m entre sí, siempre en ciénaga vadeable) salen en el agua; el siguiente brilla verde a través de la niebla. HUD: "Nenúfar 2/3 · 4 s". Llegar a ≤2,5 m de cada uno. Tarde → "Se escapa" y 3 s de espera. Tras el tercero, el anillo de siempre en **3 rondas** (3,0 / 3,8 / 4,6 rad/s, zona 1,1 / 0,9 / 0,7); un amigo a ≤6 m la calma (×1,5).
  - **Montarla:** tierra y agua de hasta **2 m**: 8 m/s, 11 corriendo, sin aguante. La ciénaga alta no la frena. Tope del servidor **12** (+2 s de gracia al bajar). El Zarzal la muerde igual y la frena a 3 m/s. La Ciénaga de la Costa también muerde (solo el ciervo es inmune).
  - **B = salto alto:** 7 m arriba, 9 m adelante, 1,2 s de espera. Aterriza en tierra, agua somera o encima de un peñasco; sin daño por caída.
  - **Bajar:** A en cualquier sitio; la rana espera allí. A junto a ella para volver a subir. Entrar en una mazmorra, morir o teletransportarte te baja. En la rana no puedes montar ciervo ni pez, subir detrás de nadie ni a la ballena.
  - Teclado: E / M bajar, Espacio salto alto. Táctil: A contextual y B. Rejilla sigue en 10.
- Decidido por Claude — revisar:
  - Acciones 12/13/14 dentro del mensaje `mount` (como el pez), no un mensaje nuevo.
  - La carrera de nenúfares reutiliza la del pez (`race` lleva ahora `beast`).
  - El salto en el servidor es solo un techo: un jinete de rana puede estar hasta 13 m sobre el suelo (7 del salto + lo que baja un montículo). No hay física de salto en el servidor.
  - En agua la rana flota a `WATER_LEVEL` (nunca "nada" para el servidor).
  - Montículo "más cercano a la orilla norte" = el de centro más cerca del punto norte de la elipse de la Laguna; en algunas semillas queda a 30–40 m.
  - Dibujo: una rana de cajas (verde, garganta dorada), sin PNG, como el pez.
- Rendimiento móvil: una rana = 12 cajas pequeñas; 3 discos para los nenúfares. Sin luces nuevas.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: entrar al Pantano en pez, bajar en un montículo y buscar el brillo de la garganta en la niebla. Perseguir los nenúfares a pie en la ciénaga (60 %): ¿6 s es justo? Las 3 rondas del anillo. Montada: ¿8/11 m/s se sienten bien? Saltar a un montículo alto y encima de un peñasco. Meterse en el Zarzal en rana (debe morder). Bajar y volver a subir. Constantes: `FROG` en `src/shared/frog.ts`.

## Slice 3 · S3-C — santuarios del Pantano, ámbar y Capa de corteza — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S3-C-santuarios-ambar-capa.md` (f705d67).
- Commits: 907bc43 (T1 reglas: `src/shared/swamp-shrines.ts`, ámbar, `CAPA`), 6123848 (T2 santuarios en el servidor y la rana sobre los nenúfares, protocolo v25), 632c4ce (T3 árboles de ámbar y Capa, v26), f50e7e3 (T4 cliente).
- Tests: npm test 528 (antes 499), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 26**. Campos guardados nuevos opcionales `SavedPlayer.amber` (árbol → momento de la cosecha) y `SavedPlayer.capaLvl`: las partidas viejas cargan.
- Cómo funciona:
  - **Tres santuarios más** (ids 6–8, en la misma lista: orbe de +20 de aliento, uno por jugador). Los orbes del Pantano dan además **1 ámbar**.
    - **Candiles** (el montículo más ancho libre): 3 braseros a ~12 m entre sí y un **poste de antorchas** junto al orbe. A en el poste → antorcha (se ve en la mano). A en un brasero con antorcha → arde **12 s** y la antorcha se gasta. Los tres a la vez abren la verja. Sin antorcha: "Hace falta fuego". Si mueres, la antorcha se pierde.
    - **Nenúfares** (mitad oeste de la Laguna Negra): el orbe está en una losa de piedra baja a ~30 m de la orilla, sobre agua de más de 4,5 m (nadando no se llega). **7 nenúfares** van de la orilla a la losa (~4,6 m entre centros). Se hunden **1,5 s** después de que alguien los pisa y vuelven **4 s** después. Pisar el último abre la verja 30 s. Si caes, nadas de vuelta hacia la orilla.
    - **Turba** (el montículo más cerca de la Laguna): pared de raíz de turba en lugar de verja de luz. "Raíces de turba. Esto solo arde. Vuelve luego".
  - **Ámbar:** 6 árboles hundidos en montículos libres, con brillo naranja que la niebla no tapa. A → **2 ámbar**; vuelve a brotar para ti a los **2 días** de juego ("Aún no ha vuelto a brotar"). Cada jugador tiene los suyos. **2 están encima de un tocón liso de 6 m**: solo se sube con el salto de la rana.
  - **Capa de corteza:** A junto al Corazón con 3 ámbar + 10 madera + 5 bayas → nivel 1–3, **−10 % de daño por nivel** en mordiscos, golpes y la caída de la sima. Las espinas del Zarzal y el barro de la Ciénaga muerden igual. Se ve como una capa de corteza a la espalda (más larga con cada nivel) y "Capa N" en la mochila.
  - **La rana sobre el agua honda:** en el aire, sobre un nenúfar o sobre la losa puede estar encima de agua de cualquier fondo. Si cae en agua honda solo puede ir hacia menos fondo. Así cruza los Nenúfares en unos 3 saltos.
- Decidido por Claude — revisar:
  - **La antorcha no frena** (igual que la pómez; frenar exige predicción en el cliente). A cambio **se gasta en cada brasero**: solo hay que ir tres veces al poste en 12 s. Un corredor rápido puede hacerlo solo; con dos es fácil.
  - Nenúfares: la verja se abre al pisar el último nenúfar (como una losa), sin contar si empezaste en la orilla. Nadando no se llega (agua de más de 4 m).
  - La Capa no tiñe el torso: los materiales del robot se comparten entre copias, así que es una tabla de corteza a la espalda (una caja). La antorcha de los demás no se ve (solo la tuya).
  - En el Corazón, A hace esto en orden: cuidar (si está dañado), mejorar el arma (si hay perlas) y después la Capa.
  - Mensajes nuevos `{ t: 'amber', id }` y `{ t: 'capa' }`; el poste es la parte 4 del mensaje `shrine`.
  - Cambios de regla con tests adaptados (ninguno borrado): "old saves load" espera ahora 9 santuarios (antes 6); versión de protocolo en los tests → 26.
- **Marcas pendientes:** `// S3-E` (una Llamarada enciende un brasero sin antorcha; tres queman la pared de turba), `// S3-D` (el orbe del Pantano limpiará la zona más cercana 10–13). Ahora un orbe del Pantano no limpia nada, tampoco zonas de la Costa.
- Rendimiento móvil: 3 braseros, 7 discos, 6 árboles (2 cajas cada uno) y 2 tocones. Llamas y ámbar con material básico sin niebla y **sin luces reales**. Unos 30 draw calls nuevos, todos pequeños (se pueden instanciar si hace falta).
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: Candiles solo (¿se puede con 12 s?) y con dos. Nenúfares a pie saltando (¿1,5 s es justo? ¿el hueco de ~2,4 m entre discos se salta?) y en rana. Buscar el ámbar en la niebla, subir a un tocón en rana, comprar la Capa y notar menos daño de noche. Constantes: `SWAMP_SHRINE`, `AMBER` en `src/shared/swamp-shrines.ts`, `CAPA` en `src/shared/items.ts`.

## Slice 3 · S3-D — corrupción del Pantano y La Gata Araña — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S3-D-corrupcion-gata.md`.
- Commits: 4763f5e (T1+T2 zonas 10–13 y orbes del Pantano, protocolo v27), 8949370 (T3 La Gata Araña en reglas y servidor, v28), 4d6de0f (T4 cliente).
- Tests: npm test 545 (antes 528), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 28**. Campos guardados nuevos opcionales `SavedWorld.raidN` y `SavedWorld.swampSeen`: las partidas viejas cargan (contador en 0, zonas 10–13 corruptas).
- Cómo funciona:
  - **4 zonas más** (ids fijos 10–13, `generateSwampZones` en `corruption.ts`): 10 = Raíz-madre del Pantano en el centro de la Laguna Negra (r 18); 11 en el montículo seco más lejano de la Laguna; 12 en ciénaga abierta (búsqueda sembrada); 13 en la orilla de los Nenúfares. Mismo tinte, raíz marchita y regla nocturna (+2 bestias por jugador dentro).
  - **Orbes:** un orbe del Pantano limpia la zona corrupta del Pantano más cercana (11–13, nunca la 10): "La luz del santuario limpia un trozo de pantano". Cada orbe limpia solo zonas de su bioma. La Enredadera y el Viento no limpian el Pantano.
  - **Contador de asedios** (`raidN`, sube con cada aviso del atardecer) y **Pantano visto** (`swampSeen`, alguien entró en `inSwamp`). Con el Pantano visto y la zona 10 corrupta, **cada 3.er asedio** lo guía **La Gata Araña**: el aviso añade "La Gata Araña guía el asedio esta noche".
  - **La Gata Araña** (`src/shared/sim/lieutenant.ts`, `EnemyKind 'lieut1'`): recorte de papel de `enemy2.png` (2,6 m). 300 PV, velocidad de lobo, muerde 12 cada 2 s. Sale 10 m por detrás de su manada; persigue al jugador más cercano a ≤28 m; sin nadie, se queda a 14 m del Corazón (no lo muerde). **Aura:** los asaltantes a ≤8 m corren un 20 % más. **Al caer:** el resto del asedio huye (se alejan del Corazón y desaparecen a los 3 s; la noche cuenta como superada), cada jugador vivo a ≤40 m recibe **2 ámbar** y hay visión: «Mi gata… <nombres>, esto no queda así.»
- Decidido por Claude — revisar:
  - "Cada 3.er asedio" = asedios cuyo número (contado desde el principio del mundo, 1-based) es múltiplo de 3. El contador cuenta aunque aún nadie haya visto el Pantano.
  - La visión nombra a los presentes (el spec decía "Ana"; se usan los nombres reales como en las otras visiones).
  - "Presentes" = vivos a ≤40 m de ella. Sin barra de vida propia ni tinte de aura en el cliente.
  - T1 y T2 van en un solo commit: al cambiar `isCoastZone` a 6–9, el filtro de orbes del servidor tenía que cambiar a la vez para no dejar tests rojos.
  - Cambios de regla con tests adaptados (ninguno borrado): "a swamp orb cleanses no zone" ahora espera que limpie la 13; el test de ids de la Costa mira solo los 4 que siguen al bosque; versión de protocolo → 28.
- **Marcas pendientes:** `// S3-E` (una Llamarada a ≤5 m de la raíz de 11–13 la limpia; junto a la de la Enredadera en `world-sim.ts`), `// S3-F` (vencer a El Zancudo limpia la 10 y con ello la Gata deja de venir).
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: entrar al Pantano, buscar las 4 manchas; tomar un orbe del Pantano y ver cuál desaparece. Forzar el 3.er asedio (en una partida de prueba, `raidN: 2` en el guardado): ¿se ve la Gata en la niebla del atardecer?, ¿se nota el aura?, ¿300 PV es mucho con arma nivel 0? Constantes: `SWAMP_ZONES` en `corruption.ts`, `GATA` en `sim/lieutenant.ts`.

## Slice 3 · S3-E — mazmorra del Pantano y el Fuego — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S3-E-fuego-mazmorra.md` (7331ed0).
- Commits: 72c2887 (T1 reglas: `src/shared/fuego.ts`, `src/shared/swamp-dungeon.ts`), 6a3ce70 (T2 mazmorra en el servidor, protocolo v29), fa76e52 (T3 la Llamarada), 15b8048 (T4 bruto de turba y hoguera), 8f06bec (T5 cliente).
- Tests: npm test 573 (antes 545), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 29**. Campo guardado nuevo opcional `SavedPlayer.fuego`: las partidas viejas cargan.
- Cómo funciona:
  - **Entrada:** tronco hundido de la **Raíz-madre del Pantano**, 5 m al norte del centro de la Laguna Negra (el centro es la raíz marchita de la zona 10). Agua honda: se llega en pez, en ballena o en el aire con la rana. A / E a ≤9 m → dentro (el pez se queda esperando en el tronco). Al salir apareces nadando junto al tronco.
  - **Interior** en `x = HALF + 450`, 24 × 180 m, suelo a 30 m, cálido:
    1. **Palancas** (6 s) → verja 0.
    2. **Altar del Fuego** (A / E) → `fuego` guardado.
    3. **Verja de espinas** (verja 1): tres Llamaradas la queman ("Las espinas humean (1/3)").
    4. **Sala del gas** (verja 2): 3 lámparas de gas apagadas (la sala solo tiene su luz). Encendidas las tres en ≤10 s, se abre. Las dos primeras están juntas y caen con una sola Llamarada; la tercera, 13 m más allá.
    5. **Pasarela que se hunde** (sin verja): 10 tablas sobre 30 m de barro. Cada tabla se hunde **1,2 s** después de que alguien la pisa y vuelve a los **4 s**. Caer al barro → de vuelta a la verja de la sala del gas, −10 PV ("El barro te traga y te escupe atrás…").
    6. **Bruto de turba** (480 PV): la carga del bruto reforzado. En los dos **charcos** de su sala se rehace **10 PV/s** salvo que arda. Al caer, verja 3.
    7. **Sala del jefe:** vacía y lista para S3-F ("Algo zumba en la oscuridad. Aún duerme").
  - **Fuego** (H / botón de poder): **Llamarada**, cono de 6 m y 60°, 5 s de enfriamiento propio. Bestias: −6 y **arden** 3 PV/s durante 4 s; los **lobos** que arden huyen 2 s. Brutos, élites y la Gata arden sin huir. Jefes y El Marchito solo reciben el golpe.
  - **Cambio de poder:** J / mantener el botón cicla 🌿 → 🌬️ → 🔥 saltando los que no tienes.
  - **Hoguera:** tercera trampa del Menú ("Trampa: estacas / red de raíces / hoguera"; solo aparece con Fuego) y tecla **U**. 4 madera + 2 ámbar, 60 PV, necesita el Fuego ("Hace falta el Fuego"). La primera bestia que entra arde; los lobos a ≤4 m huyen 2 s; se rearma en 8 s; cada vez −10 PV. No calienta (es trampa, no fogata).
  - **Marcas `// S3-E` resueltas:** una Llamarada enciende un brasero de **Candiles** sin antorcha (3 Llamaradas en 10 s abren; cada brasero aguanta 12 s); tres Llamaradas queman la pared de **Turba** (el santuario queda abierto mientras la sala viva); una Llamarada a ≤5 m de la raíz de las zonas **11–13** la limpia ("El fuego seca la raíz marchita. El pantano respira"). La 10 no: eso es de El Zancudo (S3-F).
- Decidido por Claude — revisar:
  - **Cuatro verjas físicas + la pasarela** como quinto obstáculo sin verja (igual que la sima de la Costa).
  - **Sin losa con bloque de raíz** en la pasarela: el spec la da como atajo opcional; las tablas solas bastan.
  - Las tablas son discos "crag" pelados (como los nenúfares): el cliente se sube con la física de siempre. El servidor usa franjas de 3 m para saber en qué tabla estás; en la junta entre dos tablas el cliente puede caer un pelo antes que el servidor.
  - Las dos primeras lámparas comparten Llamarada: con 5 s de enfriamiento, tres lámparas separadas no caben en 10 s.
  - Solo huyen los **lobos** (Llamarada y hoguera).
  - La pared de Turba quemada es estado vivo (como todos los puzles de santuario): vuelve si la sala se reinicia; el orbe tomado sigue tomado.
  - Protocolo v29 de una vez para todo el plan (acts 13–17, `power.kind 'fuego'`, `DungeonView.swamp`, `SelfState.fuego/fireLeft`, `EnemyKind 'elite3'`, `WolfView.burning`, `StructureKind 'fire'`).
  - El bruto de turba es el zorro a escala 2,4 con un manto de turba (una caja). Las bestias que arden llevan una llamita naranja encima (material compartido, sin partículas).
  - Cambios de regla con tests adaptados (ninguno borrado): `decodeClient` acepta `dungeon` hasta 17 (el test que rechazaba 13 ahora rechaza 18) y `power.kind 'fuego'` (el test que lo rechazaba usa ahora `'rayo'`); versión de protocolo → 29.
- **Marcas pendientes:** `// S3-F` (vencer a El Zancudo limpia la 10; el nudo del Zarzal y los respiraderos de gas arden con la Llamarada, en `flameThings`), `// S3-G` (las fogatas, en el mismo sitio).
- Rendimiento móvil: interior de ~60 mallas pequeñas + 4 luces fijas y 3 luces de lámpara que solo se encienden al prenderlas (fuera de la mazmorra no se ven). La hoguera no tiene luz propia.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: en pez hasta el tronco de la Laguna y A. Palancas, altar (J / mantener → 🔥). Tres Llamaradas a las espinas. Sala del gas: Llamarada a las dos lámparas juntas y correr a la tercera (¿10 s es justo?). Pasarela: ¿1,2 s por tabla da para cruzar corriendo? ¿se entiende por qué caes? Bruto de turba: dejarlo en un charco y ver que se cura; quemarlo. Fuera: Candiles solo con Fuego, la pared de Turba, una raíz morada del Pantano. De noche: Llamarada a lobos (¿huyen?) y una hoguera cerca del Corazón. Constantes: `FUEGO`/`HOGUERA` en `src/shared/fuego.ts`, `SWAMP_DUNGEON` en `src/shared/swamp-dungeon.ts`, `ENEMY.elite3`.

## Slice 3 · S3-F — El Zancudo, el farol y el nudo del Zarzal — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S3-F-zancudo.md` (187f709).
- Commits: faceb01 (T1 reglas: `src/shared/sim/zancudo.ts`, respiraderos, `ZARZAL_KNOT`), ce9a2cf (T2 el combate en el servidor, protocolo v30), 90cc0ef (T3 el farol y el nudo), 3d4f572 (T4 cliente).
- Tests: npm test 593 (antes 573), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 30**. Campos guardados nuevos opcionales `SavedWorld.purified3` y `SavedWorld.zarzalBurnt`: las partidas viejas cargan (jefe sin vencer, nudo entero).
- Dibujo: `public/enemies/enemy9.png` (358 × 291, alfa real según el spec). Va por `PaperActor`, **6 m de ancho** (el riesgo del spec: líneas finas se leen pequeñas).
- Cómo funciona:
  - **Sala del jefe** de la mazmorra del Pantano (z 150–180, tras la verja 3). Ya no dice "Aún duerme": al entrar, **El Zancudo despierta**. Cuatro **respiraderos de gas** en (±5, 158) y (±5, 172).
  - **380 PV**, flota a **4 m**. Los puñetazos no llegan ("Vuela alto. Flechas, o fuego al gas bajo él"); **flechas, ráfagas y Llamaradas hacen el 50 %** (la ráfaga no lo empuja).
  - **Deriva** de respiradero en respiradero cada 6 s. Una **Llamarada sobre el respiradero que tiene debajo** lo tumba **5 s** ("El gas prende bajo El Zancudo. ¡Cae! Ahora sí"): en el suelo recibe el daño entero y no ataca. Un respiradero sin él encima solo llamea.
  - **Picado:** su sombra (disco oscuro con borde rojo, sin niebla) marca el sitio durante 1,0 s; luego cae ahí: 14 a todos a ≤1,8 m. Rodar lo esquiva; **parar lo tumba 3 s**. Si acierta, **se engancha** (5 PV/s, máx. 3 s) hasta que ruedas ("Ruedas y te lo quitas de encima"). Enfriamiento 8 s.
  - Balance: quieto debajo, ~31 s de 100 PV (objetivo 30–45 s).
  - Sala vacía → se reinicia. **Al caer:** `purified3`, **zona 10 limpia** (así **La Gata Araña deja de venir**: `gataLeads` ya miraba la 10) y visión con los nombres: «Mi zancudo. Mi niebla. Mi gata sin casa…».
  - **Zancudo blanco:** junto al Corazón (2,5 m al +z) con un farol (bola dorada sin niebla). **De noche, cada 10 s**, todos los **lobos** a ≤12 m del Corazón **huyen 3 s**. Brutos, élites y la Gata no. Sin PV, no muere; no toca PV del Corazón ni tamaño de asedio.
  - **Nudo del Zarzal:** raíz marchita en `x = −HALF + 8, z = 120` (lado del bosque). **Tres Llamaradas** a ≤5 m ("El nudo del Zarzal humea (1/3)") → `zarzalBurnt`: en `|z − 120| < 5` el Zarzal deja de morder y de frenar, **para todos**, para siempre. Cliente: el nudo y su seto de espinas desaparecen.
  - Barra: "El Zancudo 380/380 · en el aire / ¡picado! / ¡en el suelo! / chupando a Ana: ¡rueda!". Tumbado se tiñe dorado.
- Decidido por Claude — revisar:
  - Arena = la sala que ya había (24 × 30 m), no 22 × 22.
  - Nudo en un punto **fijo**, no sembrado; la altura del terreno no cambia (el borde se puede andar; solo las espinas cierran). El contador de Llamaradas del nudo es vivo (un reinicio lo pone a 0).
  - La visión al quemar el nudo queda para S3-G (visiones del Pantano); aquí solo una línea (`// S3-G`).
  - El farol solo asusta a `kind 'wolf'` (asaltantes o no); "de noche" = `isNight`.
  - El tinte de espinas del suelo sigue en el hueco (cosmético); los arbustos de espinas sembrados nunca caen en el hueco, que tiene su propio seto hasta arder.
  - `bite()` ahora dice si el golpe entró (para el enganche); `hurt()` aplica daño con Capa.
  - Cambios de regla con tests adaptados (ninguno borrado): el test "the boss room is quiet (S3-F)" ahora espera "El Zancudo despierta"; versión de protocolo → 30.
- **Marcas `// S3-F`:** resueltas todas. Queda `// S3-G` (fogatas y la visión del nudo, en `flameThings`).
- Rendimiento móvil: 4 anillos + 4 llamaradas (ocultas salvo al prender), 1 disco de sombra, el nudo (1 malla + 1 instanciada ≤120). Sin luces nuevas.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: entrar a la sala con Fuego y arco; ¿se lee la sombra del picado en la penumbra?, ¿6 s entre respiraderos da para apuntar?, ¿el enganche se entiende? Vencerlo y ver el farol de noche. Quemar el nudo (junto al borde oeste, z ≈ 120) y cruzar a pie. Constantes: `ZANCUDO`/`FAROL` en `src/shared/sim/zancudo.ts`, `SWAMP_DUNGEON.vents`, `ZARZAL_KNOT` en `src/shared/swamp.ts`.

## Slice 3 · S3-G — Fogatas del Pantano y visiones — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S3-G-fogatas-visiones.md` (9e30e11).
- Commits: 74ed097 (arreglo: id propio del bruto de turba, 900_004, + test de ids únicos), f0281fa (T1 reglas: `src/shared/fogatas.ts`, `VISION.swamp`/`knot`), 65bde53 (T2 servidor, protocolo v31), 31b88b3 (T3 cliente).
- Tests: npm test 610 (antes 593), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 31**. Campo guardado nuevo opcional `SavedWorld.fogatas`: las partidas viejas cargan con las cuatro apagadas.
- Cómo funciona:
  - **4 fogatas** (anillo de piedras) en montículos que no usan ni los santuarios ni la rana, repartidas de norte a sur; cada una al 60 % del radio del montículo, hacia el bosque (nunca encima de un árbol de ámbar).
  - **Encender:** una Llamarada a ≤4 m, o E / A a ≤3 m **con la antorcha** del poste de Candiles (se gasta). Sin fuego: "Hace falta fuego". Encendidas **para todo el mundo**, para siempre; la llama se ve a través de la niebla.
  - **Viajar:** E / A junto a una encendida → "Volver al Corazón del Bosque"; en el Corazón, el **Menú** muestra "Ir a la fogata N" por cada encendida. **5 s** mirando el fuego ("Viajando… N s"), **solo de día**. Lo cortan: un golpe (perder salud), moverse más de 1,5 m, la noche, morir o montar. Se llega 2 m al este del anillo, o al sitio de reaparecer del Corazón. Las monturas se quedan donde estaban.
  - El servidor valida todo: fogata encendida, alcance, de día, vivo, fuera de mazmorras, sin montura/asiento/pez/rana/ballena, sin doma ni carrera, que exista el Corazón.
  - **Visiones:** la primera vez que alguien entra en el Pantano («¿Te gusta mi niebla, Ana?», con su nombre) y al quemar el nudo del Zarzal («Quemar mi seto. Qué educados…», nombra a quien lo quemó). Las de la Gata y El Zancudo ya estaban. **Marcas `// S3-G`: resueltas todas.**
- Decidido por Claude — revisar:
  - Solo Corazón ↔ fogata (el spec no pide fogata ↔ fogata). Montado: "Baja de la montura primero".
  - "Cancelado por daño" = la salud baja de la que tenías al empezar (también el hambre o el frío).
  - La visión de entrada salta cuando `swampSeen` pasa a verdadero: una vez por mundo; los mundos que ya lo tenían no la ven.
  - Mensajes nuevos `{ t: 'fogata', id }` y `{ t: 'travel', to: 'heart' | 0–3 }`; `snap.fogatas`, `SelfState.travel`.
  - Mallas normales (4 anillos de 8 piedras + llama `fog: false`), sin instancias ni luces reales: son solo 4.
  - Cambios de regla con tests adaptados (ninguno borrado): versión de protocolo en los tests → 31. `claimed` de `swamp-shrines.ts` ahora se exporta como `claimedMounds`.
- Rendimiento móvil: 36 mallas pequeñas, 0 luces.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: coger antorcha en Candiles y encender la fogata más cercana; de día, E en ella y esperar 5 s; recibir un golpe a mitad; probar de noche. Menú en el Corazón → fogata. ¿Se ve la llama en la niebla? ¿5 s se hacen largos? Constantes: `FOGATA` en `src/shared/fogatas.ts`.

## Slice 4 — resumen (LEER PRIMERO)
- **S4-A a S4-H: todos hechos, ninguno bloqueado.** Rama `aventura/resto`, PR draft #3. Nada mergeado ni desplegado.
- Tests finales: npm test 789, test:workers 12, check + build verdes. **PROTOCOL_VERSION = 43.** Todos los campos guardados nuevos son opcionales (`SavedPlayer.quartz/piedra/dragon`, `SavedWorld.mountainsSeen/purified4/escalera`, fogatas 6): las partidas viejas cargan y reciben Montañas.
- **Qué hay:** S4-A las Montañas al norte, los Peldaños (rana) y la regla de la pendiente · S4-B trepar roca, frío de altura y clima sembrado (lluvia/tormenta) · S4-C santuarios 9–11, cuarzo, arma 4–5 y 2 refugios · S4-D zonas 14–17 y El Triángulo (asedios) · S4-E mazmorra de la Montaña y la Piedra (🌿→🌬️→🔥→🪨) · S4-F El Cucurucho, la atalaya y la Escalera del Umbral · S4-G el Dragón (tormentas, salto desde el Pico, vuelo) · S4-H tobogán de nieve y las últimas visiones.
- **Decidido por Claude — revisar (lo gordo):** 60/25/15 % de clima cede ante "una tormenta cada 4 días"; el frío empieza a 30 m absolutos (casi todas las Faldas); pilares = construcciones; la rampa de la Escalera cambia el terreno (`withEscalera`); el dragón vuela a radio 22 m (no 14) y la ventana del salto va por rumbo; el tobogán dura ~15 s del Pico al Umbral (no ~40 s) y en el canal siempre baja al sur; visiones de entrada (Pantano y Montañas) una vez por mundo.
- **Balance a revisar en juego:** `PELDANOS` (salto de la rana), `COLD.y`, coste de cuarzo, vida y carga de El Cucurucho, 1,5 s de ventana del dragón y sus 5 rondas, `SNOWSLIDE` (15° para empezar, 14 m/s).
- **Orden de prueba:** rana por los Peldaños (visión «Qué alto…») → trepar y frío → santuarios y cuarzo → un asedio con El Triángulo → mazmorra y Piedra → Escalera (visión) → El Cucurucho → tormenta y dragón → tobogán desde el Pico hasta el Umbral.

## Slice 4 · S4-A — las Montañas, los Peldaños y la regla de la pendiente — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S4-A-montanas-peldanos.md` (7ebd5db).
- Commits: 877151b (T1 terreno de las Montañas, límites en unión de 3 rectángulos, sin peñascos junto a los Peldaños, nombres), 85d7489 (T2 regla de la pendiente en el servidor, protocolo v32), 467ba2c (T3 movimiento en el cliente y aviso), 31770a1 (T4 malla por trozos con silueta, colores y pinos).
- Tests: npm test 640 (antes 610), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 32** (cambió el terreno). Sin campos guardados nuevos: las partidas viejas cargan y reciben Montañas.
- Cómo funciona:
  - **Mapa:** crece al norte: `MOUNTAINS` = x de −HALF a HALF, z de −HALF−220 a −HALF. Todo lo que está al sur de z = −HALF es idéntico (un test compara 120 alturas grabadas antes del cambio). La altura de las Montañas se suma a la del borde del bosque en z = −HALF, así que la costura no tiene escalón. `inMap`/`clampMap` son la unión de 3 rectángulos (bosque+costa, Pantano, Montañas) y `clampMap` lleva al más cercano.
  - **Los Peldaños:** 4 terrazas de +6 m; cada escalón sube en 1,5 m de carrera (~80°), cada 10 m. Roca lisa (`smoothAt`).
  - **Faldas** (d 40–120): +24 a +40 con ruido suave (≥85 % por debajo de 30°), **9 paredes** sembradas (mesas de 12–25 m con caras de 56–78°), y el **canal de nieve** (valle de 2 m, |x| < 4) por el centro. **Cumbre** (d 120–200) hasta ~+75 con ruido de cresta. **El Pico**: disco plano de 12 m a +80, cerca de x = 0. Bordes: acantilados hasta +90 al norte (d > 200) y a los lados (|x| > HALF−20).
  - **Regla de la pendiente** (`src/shared/mountains.ts`, solo dentro de las Montañas): no se puede subir a pie ni en ciervo a una celda de más de **45°** (el servidor tolera 50°). Bajar siempre se puede. También en el aire: un salto que choca con un escalón cae en vez de subirse encima. Avisos: "Roca lisa. Sin agarre" (Peldaños), "El ciervo no trepa", "Demasiado empinado" (paredes); en el cliente como mucho uno cada 3 s.
  - **La Rana** es la llave: en el suelo tampoco sube, pero su salto alto (7 m) pasa cada escalón si saltas desde 3–5 m antes (un test hace las 4 terrazas). El servidor no aplica la regla a los jinetes de rana (ya tienen el techo de suelo + 13).
  - **Peñascos:** ninguno en los 60 m del norte del bosque (no se planea a las terrazas).
  - **Nombres:** los 14 de §13 están en `names.ts`. El test de nombres también prohíbe escribir a mano "Montañas", "Peldaños" y "Cucurucho".
- Decidido por Claude — revisar:
  - Terrazas de 10 m de fondo (4 × 10 = 40 m); el salto de la rana tiene una ventana de 3–5 m antes del escalón. Si cuesta en móvil, bajar `PELDANOS.rise` o subir `pitch`.
  - Las paredes son mesas redondas (cara todo alrededor, cima plana de 3–6 m), no crestas. Caben 9 siempre.
  - Las alturas van relativas al borde del bosque (varía ±15 m con el ruido); el Pico está a +80 sobre el borde en su x.
  - La Escalera del Umbral cambiará el terreno en S4-F (una rampa en |x| < 2); aquí no hay nada.
  - Pinos solo decorativos (sin colisión ni recursos), unos 150 instanciados.
  - Las Montañas aún no se tiñen de corrupción (llega en S4-D con las zonas 14–17).
  - Cambios de regla con tests adaptados (ninguno borrado): versión de protocolo → 32; en `coast.test.ts`, el borde norte ya no es z = −HALF sino el de las Montañas, y la esquina (−HALF−1, −HALF−1) ahora se lleva a las Montañas.
- Rendimiento móvil: **+5 draw calls** (4 trozos de 120 m, cada uno en detalle o en silueta, nunca los dos, + 1 de pinos). Vértices: silueta 4 × 289 = 1.156 siempre; detalle solo a menos de 160 m: gama baja 2.132 por trozo (8.528 con los 4, +26 % sobre ~32.600 — más que los +2.600 que estimaba el spec, porque las columnas tienen que coincidir con las del bosque en la costura), media 3.264/trozo, alta 4.514/trozo. Desde el Corazón (a ~240 m) solo se dibujan siluetas. La niebla y el plano lejano (120–260 m) no se tocaron: en gama baja la cumbre no se ve desde el Corazón.
- Verificado en navegador local (Chromium headless 1000×600, mundo `montes`, semilla 42, partida importada): a los pies (0, −232) mirando al norte se ve el muro gris liso del primer escalón; en las Faldas (20, −300) se ven pinos, el canal de nieve pálido, una pared oscura y la cumbre nevada detrás. Sin errores de consola. NO verificado: subir con la rana, los avisos en pantalla, el cambio de silueta a detalle al acercarse, ni el móvil.
- Bloqueos: ninguno.
- Qué probar: andar al norte desde el bosque hasta los Peldaños (¿se entiende el aviso?). En rana: acercarse y saltar (¿la ventana de 3–5 m es justa?). En las Faldas: rodear una pared, ir al Pico andando por las pendientes suaves (¿hay camino?). Mirar la costura en z = −HALF por si hay grietas lejos (silueta). En móvil: fps al entrar en las Montañas. Constantes: `MOUNTAINS`/`PELDANOS`/`PICO`/`CHUTE` en `terrain.ts`, `STEEP` en `src/shared/mountains.ts`, `MOUNTAIN_LOD` en `terrain-mesh.ts`.

## Slice 4 · S4-B — trepar la montaña, el frío y el clima — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S4-B-trepar-frio-clima.md` (0e1014f).
- Commits: f6f175b (T1 clima sembrado y frío de altura, Llamarada calienta), 035c5e1 (T2 el servidor deja trepar roca seca, protocolo v33), 30909bd (T3 trepar y resbalar en el cliente), 3e5e163 (T4 lluvia/nieve, cielo gris y el parte del alba).
- Tests: npm test 656 (antes 640), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 33** (cambió la regla de movimiento). Sin campos guardados ni de snapshot nuevos: las partidas viejas cargan.
- Cómo funciona:
  - **Trepar** (solo en las Montañas): empujar cuesta arriba contra roca de más de 45° que no es lisa ni está mojada **la agarra** (`climbableAt` en `src/shared/mountains.ts`). Adelante = arriba por la pendiente, lados = a lo largo; 2,2 m/s sobre la superficie; aliento 10/s moviéndote, 3/s quieto. Arriba (pendiente < 35° y lo de delante < 45°) te pones de pie. B salta hacia atrás (20 de aliento). Sin aliento o si empieza a llover te sueltas.
  - **Resbalar:** de pie sobre roca de más de 45° sin agarrarte, bajas por la pendiente a 4 m/s (sin daño). Solo si la roca cae bajo tus pies (al pie de un escalón no te empuja).
  - **Servidor:** la regla de la pendiente ya no rechaza a quien va a pie sobre roca trepable; sí al ciervo, a los Peldaños y a la roca mojada ("Roca mojada. Resbala"). El aliento sigue siendo del cliente (como en los peñascos).
  - **Clima** (`src/shared/weather.ts`): `weatherAt(semilla, día)` con día = `floor(time / DAY_LENGTH)`; cliente y servidor lo calculan igual, sin red. Solo cuenta en las Montañas. Lluvia o tormenta = roca mojada.
  - **Frío:** en las Montañas por encima de 30 m de altura del terreno, lejos del fuego, el calor baja como de noche por el día y el doble de noche. Cada Llamarada da +20 de calor al que la lanza.
  - **Cliente:** una nube de puntos (600, 1 draw call) sigue al jugador en las Montañas los días mojados: lluvia, o nieve por encima de 55 m. Cielo más gris y niebla más cerca (0,5 lluvia, 1 tormenta). Al amanecer (0,22 del día) un aviso para todos: "Hoy en la montaña: lluvia".
- Decidido por Claude — revisar:
  - **El reparto 60/25/15 % no cabe con "una tormenta cada 4 días"** (eso ya es ≥ 25 %). Manda la garantía: las tiradas naturales son 15 % tormenta / 25 % lluvia / 60 % despejado, y desde la última tormenta natural cada 4.º día se fuerza. Queda ~30 % tormenta, ~20 % lluvia, ~50 % despejado. Si hay demasiada tormenta, alargar `WEATHER.stormEvery`.
  - "2 s de Llamarada = +20 de calor" → **cada Llamarada** da +20 (no hay canalización).
  - El frío usa la altura absoluta del terreno (> 30): como el borde del bosque está a ~7–16 m, casi todas las Faldas ya son frías, no solo la mitad alta. Subir `COLD.y` si molesta.
  - El parte del alba sale en todas partes (no solo junto al Corazón) y siempre, aunque nadie haya visto aún las Montañas (`mountainsSeen` llega en S4-D).
  - Al agarrarte, los lados del stick mueven a lo largo de la pared (como en los peñascos): si agarras de lado, subes con adelante.
  - Cambios de regla con tests adaptados (ninguno borrado): versión de protocolo → 33 en `protocol.test.ts`.
- Rendimiento móvil: +1 draw call (la nube de puntos), oculta fuera de las Montañas o en días despejados; 600 posiciones actualizadas por fotograma solo mientras se ve.
- Verificado en navegador local (Chromium headless 1000×600, mundo `trepa`, semilla 42, partida importada en el día 4, despejado, a 16 m al este de la primera pared): manteniendo A hacia la pared, el personaje la agarra (pose de trepar, aviso "Espacio · Saltar", anillo de aliento bajando) y se desplaza por la cara; el calor bajó de 89 a 81 en ~10 s (frío de altura). Sin errores de consola salvo un aviso de textura de GLTF ya existente. NO verificado: subir hasta la cima con adelante, la lluvia/nieve en pantalla, el parte del alba, móvil.
- Bloqueos: ninguno.
- Qué probar: ir a una pared un día despejado y empujar (¿se entiende que se agarra?); subir hasta arriba con el aliento base (¿llega en paredes de 25 m?); saltar con B; un día de lluvia (¿se ve la lluvia? ¿se entiende "Roca mojada"?); quedarse en la cumbre de noche sin fuego. Constantes: `SLIDE`/`CLIMB_SPEED`/`STAMINA` en `src/client/movement.ts`, `COLD` en `src/shared/mountains.ts`, `WEATHER` en `src/shared/weather.ts`, `PRECIP` en `src/client/scene/weather.ts`.

## Slice 4 · S4-C — santuarios de la Montaña, cuarzo, arma 4–5 y refugios — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S4-C-santuarios-cuarzo-refugios.md` (65bd739).
- Commits: 04e0194 (T1 reglas: `src/shared/mountain-shrines.ts`, cuarzo, `upgradeCost`, refugios en la lista de fogatas, protocolo v34), 7d956c2 (T2 santuarios y refugios en el servidor, v35), bc9219a (T3 vetas de cuarzo y arma 4–5, v36), a636c6f (T4 cliente).
- Tests: npm test 680 (antes 656), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 36**. Campo guardado nuevo opcional `SavedPlayer.quartz` (veta → momento): las partidas viejas cargan; `SavedWorld.fogatas` de 4 carga con los refugios apagados.
- Cómo funciona:
  - **Tres santuarios más** (ids 9–11, misma lista: orbe de +20 de aliento, uno por jugador). Los orbes de la Montaña dan además **1 cuarzo** y no limpian nada (aún no hay zonas).
    - **Cornisa** (la pared más alta que la rana sube en 3 saltos, cara que mira al bosque): el orbe está en el borde de arriba. **Sin verja**: la altura es el candado. Se sube trepando la roca (día seco) con **2 repisas** para descansar a un tercio y dos tercios, o en rana saltando de repisa en repisa. Con lluvia, solo la rana.
    - **Losas gemelas** (Faldas llanas): dos losas a 14 m. Las dos pisadas a la vez → verja abierta **20 s**. Un amigo, o una **ráfaga de Viento** a la roca suelta junto a la losa 2: rueda por el surco y se queda encima **60 s** (luego vuelve). Solo: ráfaga y pisar la losa 1.
    - **Bloques** (arriba en las Faldas): rejilla 6 × 6 de 2 m, 3 bloques, 3 casillas pálidas y una palanca. Sin Piedra: "No se mueve". La palanca: "Los bloques vuelven a su sitio". Reglas puras (`pushBlock`, `blocksSolved`) y una solución de 8 empujes ya probadas.
  - **Cuarzo:** 10 vetas blancas (sin niebla, se ven de lejos) en las caras de las paredes, a 8–20 m sobre el pie. E / A estando arriba junto a ella (≤ 2 m, no más de 1,5 m por debajo) → **2 cuarzo**; vuelve a brillar para ti a los **2 días** ("Aún no ha vuelto a brillar"). Gris mientras tanto.
  - **Arma 4–5:** en el Corazón, del nivel 3 al 5 cuesta **3 cuarzo + 10 piedra + 5 madera** cada nivel (+15 %, máximo +75 %). Los niveles 1–3 siguen con perlas.
  - **Refugios:** fogatas 4 y 5 (una en las Faldas bajas, otra alta hacia la Cumbre), con tres muros de piedra. Se encienden igual (Llamarada o antorcha), el Menú del Corazón dice "Ir al refugio N" y viajan igual. **Toda fogata encendida calienta** como una fogata construida.
- Decidido por Claude — revisar:
  - Cornisa sin verja (como la Roca Lisa). Las repisas están a ~2–3 m en horizontal una de otra: el salto de la rana (9 m adelante) puede pasarse; no se probó en juego.
  - La roca de las Losas cae en la losa 2 con cualquier ráfaga que la toque (surco), no con un deslizamiento libre de 6 m que exigiría puntería.
  - "Trepando junto a la veta" = alcance en 3D; el servidor no sabe si trepas.
  - Todas las fogatas encendidas calientan (también las del Pantano) y asustan a los lobos como una fogata. Una regla.
  - El cambio de `FOGATA.count` y de `UPGRADE.max` en T1 ya cambiaba lo que acepta el servidor, así que T1 subió el protocolo (v34) y cada tarea siguiente otra vez.
  - Cambios de regla con tests adaptados (ninguno borrado): versión de protocolo → 36; "12 santuarios" (antes 9); fogatas 6 (antes 4) en `fogatas.test.ts` y en los tests del servidor; la mejora en el nivel 3 sin cuarzo dice "Faltan materiales" (antes "El arma ya no da más de sí"); `travel`/`fogata` aceptan hasta 5; partes de santuario hasta 7.
- **Marcas pendientes:** `// S4-E` (Empujar mueve los bloques y una rejilla resuelta abre la verja; un pilar de Piedra pisa una losa), `// S4-D` (el orbe de la Montaña limpiará la zona 15–17 más cercana).
- Rendimiento móvil: cuarzo en 2 mallas instanciadas (30 cristales), 2 losas, 1 roca, 3 bloques + 3 losetas + palanca, 2 repisas, 6 muros. Sin luces reales. Unos 20 draw calls nuevos, pequeños.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: subir la Cornisa trepando un día seco (¿llega el aliento con las repisas?) y en rana (¿se aterriza en las repisas?). Losas con un amigo y solo con Viento. Ver las vetas desde lejos, picar una colgado de la pared. Comprar el nivel 4. Encender un refugio, viajar desde el Corazón y pasar la noche al lado. Constantes: `MOUNTAIN_SHRINE`, `BLOCKS`, `QUARTZ` en `src/shared/mountain-shrines.ts`, `UPGRADE` en `src/shared/items.ts`, `FOGATA` en `src/shared/fogatas.ts`.

## Slice 4 · S4-D — corrupción de la Montaña y El Triángulo — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S4-D-corrupcion-triangulo.md` (5309644).
- Commits: 8443b4b (T1+T2 zonas 14–17, orbes de la Montaña, `mountainsSeen`, protocolo v37), d61aefd (T3 El Triángulo en reglas y servidor, v38), 4598d31 (T4 cliente).
- Tests: npm test 697 (antes 680), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 38**. Campo guardado nuevo opcional `SavedWorld.mountainsSeen`: las partidas viejas cargan con 14–17 corruptas y sin Montañas vistas.
- Cómo funciona:
  - **Cuatro zonas más** (ids fijos 14–17, `MOUNTAIN_ZONES` en `corruption.ts`): **14 = Raíz-madre de la Montaña** (r 18) en un punto fijo (x −70, 140 m al norte del borde), donde S4-E abrirá la boca de la cueva; 15 en un prado suave de las Faldas; 16 al pie de la pared 0, del lado del bosque; 17 en el nevero alto. Mismo dibujo y misma regla de noche, pero las bestias extra salen **al pie de los Peldaños**, del lado del bosque (no trepan).
  - **Limpieza:** el orbe de un santuario de la Montaña (9–11) limpia la 15–17 corrupta más cercana ("La luz del santuario limpia un trozo de montaña"); nunca la 14. Enredadera, Viento y Llamarada no tocan la Montaña.
  - **Montañas vistas** (`mountainsSeen`): alguien vivo entró en `inMountains`. De momento sin visión (es de S4-H).
  - **El Triángulo** (`EnemyKind 'lieut2'`, `TRIANGULO` en `sim/lieutenant.ts`): recorte de `enemy7.png` (2,8 m). Con las Montañas vistas y la 14 corrupta, guía los asedios con **`raidN % 3 === 1`** desde el 4.º (nunca coincide con la Gata). Aviso: "El Triángulo guía el asedio esta noche". 340 PV, velocidad de lobo, patea 12 cada 2 s; anda como la Gata (persigue a ≤28 m, si no espera a 14 m del Corazón) y sale 12 m detrás de su manada. **Rocas:** cada 6 s, 40 de daño a la construcción de jugador más cercana a ≤25 m; **nunca al Corazón**. **Al caer:** el asedio huye (como con la Gata), **2 cuarzo** a cada jugador vivo a ≤40 m y visión: «Mis rocas… <nombres>, sube a por mí, a ver.»
- Decidido por Claude — revisar:
  - La 14 va en un punto fijo, no sembrado: S4-E pone ahí la cueva y así no hay que buscarla.
  - La roca es instantánea, sin proyectil dibujado: se ve en la barra de vida del muro (o en el muro que desaparece). Apunta a cualquier construcción que no sea el Corazón (muros, trampas, fogatas…).
  - Las bestias extra de una zona de la Montaña aparecen al pie de los Peldaños (la regla del spec §3.3), así que quedarse arriba de noche es más tranquilo que en el bosque.
  - La caída de la Gata y del Triángulo comparten un solo manejador; el texto de la Gata no cambia.
  - Cambios de regla con tests adaptados (ninguno borrado): versión → 38; el orbe de la Cornisa ahora sí limpia una zona (antes "no limpia nada"); las zonas del Pantano ya no son las últimas de la lista (`slice(-8, -4)`); la lista esperada tras un orbe del Pantano incluye 14–17.
- **Marcas pendientes:** `// S4-E` (un pilar de Piedra a ≤2 m de la raíz de 15–17 la aplasta; los pilares también serán blanco de las rocas), `// S4-F` (vencer a El Cucurucho limpia la 14 y con ello El Triángulo deja de venir: `triLeads` ya mira la 14), `// S4-H` (visión al entrar por primera vez en las Montañas, donde se pone `mountainsSeen`).
- Rendimiento móvil: un `PaperActor` más solo en su asedio; las zonas usan el mismo dibujo que las demás.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: subir, buscar las 4 manchas (¿se ve bien la 17 en el nevero?), tomar un orbe de la Montaña y ver cuál desaparece. Forzar el 4.º asedio (`raidN: 3` y `mountainsSeen: true` en el guardado): ¿se ve el Triángulo negro al atardecer?, ¿las rocas rompen muros demasiado rápido (40 cada 6 s)?, ¿340 PV con arma 4? Constantes: `MOUNTAIN_ZONES` en `corruption.ts`, `TRIANGULO` en `sim/lieutenant.ts`.

## Slice 4 · S4-E — mazmorra de la Montaña y la Piedra — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S4-E-piedra-mazmorra.md` (f8d4db2).
- Commits: 757630d (T1 reglas: `src/shared/piedra.ts`, `src/shared/mountain-dungeon.ts`, `pushBlock` con tamaño de rejilla), 0a5efae (T2 pilares en el servidor, protocolo v39), 5fb84f0 (T3 mazmorra en el servidor), 1fe3f8b (T4 bruto de roca, torre, marcas S4-E), 68e69ce (T5 cliente).
- Tests: npm test 731 (antes 707), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 39**. Campo guardado nuevo opcional `SavedPlayer.piedra`: las partidas viejas cargan. Los pilares nunca se guardan.
- Cómo funciona:
  - **Entrada:** la boca de la cueva está 5 m al norte de la raíz de la zona 14 (x −70, 145 m al norte del borde). A / E a ≤9 m → dentro. Al salir apareces 6 m al sur de la boca.
  - **Interior** en `x = HALF + 600`, 24 × 190 m, suelo a 30 m, luz azul fría, cálido (como todas las mazmorras):
    1. **Palancas** (6 s) → verja 0.
    2. **Altar de la Piedra** (A / E) → `piedra` guardado.
    3. **Losa alta** (verja 1): una losa encima de una repisa de roca de 3 m (se trepa). Abierta **solo mientras pesa**: un pilar a ≤2 m, o alguien de pie arriba.
    4. **Bloques** (verja 2): rejilla 5 × 5, 2 bloques a 2 casillas pálidas, 5 empujes. Palanca de reinicio. Resuelta, se queda abierta.
    5. **Corredor de rocas** (sin verja, 40 m): 3 carriles, una roca por carril cada 2 s a 8 m/s hacia la entrada. −15 y 3 m atrás; rodar la esquiva, bloquear la para. Un pilar en un carril para todas las rocas de ese carril por debajo de él.
    6. **Bruto de roca** (500 PV): la carga del bruto reforzado detrás de una losa gris. De frente, los golpes hacen el 10 %. Si su carga choca con un pilar o con la pared de la sala: **aturdido y expuesto 5 s**. Una parada lo expone 3 s. Al caer, verja 3.
    7. **Sala del jefe:** vacía y lista para S4-F ("La sala está en calma. Algo con gorro duerme bajo el hielo").
  - **Piedra** (H / botón de poder, 🪨): **Alzar** un pilar de 2 × 2 × 3 m a 4 m delante, en rejilla de 2 m. 3 s de enfriamiento propio. Máximo 3 por jugador (el 4.º tumba el más viejo), 120 s, 80 PV. Se trepa y se pisa (es un peñasco), pesa en las losas, los asaltantes lo muerden como a un muro, las rocas de El Triángulo lo buscan. Alzado bajo una bestia: aturdida 1 s y −4. Cualquier bruto élite que carga contra un pilar se estrella 5 s.
  - **Empujar:** E / A junto a un bloque (Bloques, sala de bloques): una casilla en dirección contraria a ti. Sin Piedra: "No se mueve".
  - **Cambio de poder:** J / mantener el botón cicla 🌿 → 🌬️ → 🔥 → 🪨 saltando los que no tienes.
  - **Torre:** cuarta trampa del Menú ("Trampa: … / torre", solo con Piedra) y tecla **I**. 6 piedra + 2 cuarzo, 150 PV. Se trepa; desde arriba las flechas llegan a 36 m (×1,5). Cada 4 s aparta 3 m a los asaltantes que están a ≤3 m de su pie.
  - **Marcas `// S4-E` resueltas:** Bloques se resuelve con Empujar (la solución de 8 empujes abre el santuario); un pilar pisa cualquier losa (la de la mazmorra del bosque, Losa, Marea, las dos de Losas gemelas y la losa alta); un pilar a ≤2 m de la raíz de 15–17 la aplasta ("La roca aplasta la raíz marchita. La montaña respira"; la 14 nunca); los pilares son blanco de las rocas de El Triángulo.
- Decidido por Claude — revisar:
  - **Los pilares son construcciones** (tipo `'pillar'`, nunca se pueden `place`), no un `snap.pillars` nuevo: así valen solos los mensajes `built`/`hit`/`wrecked`, los muros de los asaltantes y el blanco de las rocas. Sus peñascos usan ids 920 000 + id.
  - Cuatro verjas físicas + el corredor de rocas sin verja (como la sima y la pasarela).
  - La losa alta cuenta un pilar cuyo centro está a ≤2 m de ella (el pilar sale del suelo junto a la repisa, no encima): con Piedra se resuelve solo; sin ella, un amigo trepa y se queda arriba.
  - Las rocas son una función pura del tiempo (cliente y servidor las calculan igual, sin red). Los pilares no se rompen con ellas.
  - El aturdimiento por pilar vale para los cuatro brutos élite; la pared solo aturde al bruto de roca. El pilar no se daña al recibir la carga.
  - La torre solo aparta a asaltantes (no a los lobos sueltos de la noche). "Encima de la torre" = a ≤1,4 m de su centro y a ≥ altura − 0,6.
  - El bruto de roca es el zorro a escala 2,4 con una losa gris delante; sin modelo propio.
  - Cambios de regla con tests adaptados (ninguno borrado): versión → 39 en todos los tests que la miran; `decodeClient` acepta `dungeon` hasta 25 (los tests que rechazaban 18 ahora rechazan 26). El test viejo de Bloques ("no se mueven aún") sigue pasando: es el caso sin Piedra.
- **Marcas pendientes:** `// S4-F` (El Cucurucho limpia la 14; su sala ya existe, vacía), `// S4-H`.
- Rendimiento móvil: interior de ~60 mallas pequeñas + 5 luces fijas; 9 rocas (3 por carril) movidas por fotograma solo dentro. Cada pilar/torre es una malla (máx. 3 pilares × 8 jugadores). Sin luces nuevas fuera.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: subir a la raíz morada grande (x −70) y entrar por la boca. Palancas, altar (J hasta 🪨). Alzar un pilar junto a la repisa y cruzar la verja; o trepar la repisa con un amigo. Bloques (¿se entiende hacia dónde empuja?). Corredor: pasar sin pilares (¿2 s es justo?) y con pilares. Bruto de roca: pegarle de frente (casi nada), poner un pilar entre los dos y esperar la carga. Fuera: Bloques del santuario con Empujar, un pilar en una losa de Losas gemelas, un pilar en una raíz 15–17, una torre junto al Corazón de noche. Constantes: `PIEDRA`/`TOWER` en `src/shared/piedra.ts`, `MOUNTAIN_DUNGEON` en `src/shared/mountain-dungeon.ts`, `ENEMY.elite4`, `ELITE.frontMult/wallStun`.

## Slice 4 · S4-F — El Cucurucho, la atalaya y la Escalera del Umbral — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S4-F-cucurucho.md` (1a9007a).
- Commits: ea50bef (T1 reglas: `src/shared/sim/cucurucho.ts`, `UMBRAL`/`ESCALERA`/`withEscalera` en `mountains.ts`), ccbc1a5 (T2 el combate en el servidor, protocolo v40), e0596a7 (T3 la atalaya y la Escalera), b9689a2 (T4 cliente).
- Tests: npm test 756 (antes 731), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 40**. Campos guardados nuevos opcionales `SavedWorld.purified4` y `SavedWorld.escalera`: las partidas viejas cargan (jefe sin vencer, sin rampa).
- Dibujo: `public/enemies/enemy13.png` (556 × 601, alfa real según el spec). Va por `PaperActor`, **5 m de alto**.
- Cómo funciona:
  - **Sala del jefe** de la cueva (z 160–190, tras la verja 3). Ya no dice "La sala está en calma": al entrar, **El Cucurucho despierta** (espera en z 182).
  - **420 PV**. **El gorro es armadura:** desde su mitad delantera los golpes (también flechas) hacen el **25 %** ("El gorro para casi todo…").
  - **Embestida:** de 5 a 18 m, cada 4 s. Baja el gorro 1,0 s (se tiñe rojo) y carga en línea a 14 m/s (hasta 1,3 s): 25 al primero que toca (rodar esquiva). Si pasa a ≤3 m de un **pilar de Piedra**: **gorro clavado 5 s** (dorado, daño entero por todos lados, no ataca). La pared solo lo para. Una **parada** también le levanta el gorro 3 s.
  - **De cerca** pincha con el gorro: 8 cada 4 s.
  - **Alud:** a los 8 s y luego cada 15 s pisa fuerte: 4 círculos oscuros (uno sobre cada luchador, el resto en sitios fijos); 1,0 s después caen rocas: 15 a quien siga dentro (rodar esquiva). Un pilar a ≤2,5 m de un círculo para esa roca.
  - Balance: quieto a su lado, ~33 s de 100 PV (objetivo 30–45 s).
  - Sala vacía → se reinicia. **Al caer:** `purified4`, **zona 14 limpia** (así **El Triángulo deja de venir**: `triLeads` ya miraba la 14) y visión con los nombres: «Mi gorro… <nombres>. Mi montaña, mi triángulo.»
  - **La atalaya:** el Cucurucho blanco (papel pálido, 1,6 m) de pie sobre una torre de piedra de 5 m, **6 m al oeste del Corazón**. **De noche, cada 6 s**, tira una piedra al **asaltante más cercano a ≤20 m** de la torre: **8 de daño** (sin proyectil dibujado: el papel se ilumina). Sin PV, no muere; no toca PV del Corazón ni tamaño de asedio.
  - **Escalera del Umbral:** un bloque tallado de 2 m con una raya pálida en `(0, −HALF + 3)`, al pie de los Peldaños del lado del bosque. **Alzar (Piedra) a ≤5 m** de él no saca pilar: "La roca cruje (1/3)". A la tercera → `escalera`: en `|x| < 2` los Peldaños son una **rampa de ~31°** (borde del bosque + 24 m en 40 m) **para todos**, para siempre. Cliente: el bloque desaparece, 40 escalones de piedra cubren la franja y las mallas de las Montañas se rehacen una vez.
- Decidido por Claude — revisar:
  - Arena = la sala que ya había (24 × 30 m, la del spec).
  - "Frente" = el semiplano delante de su mirada, como la losa del bruto de roca; vale para flechas también. La carga no le hace daño al pilar.
  - La visión de la Escalera queda para S4-H (spec §16); aquí una línea para todos y la marca `// S4-H` en `crackUmbral`. El contador de grietas es vivo (un reinicio lo pone a 0), como el nudo del Zarzal.
  - **La rampa cambia la altura del terreno** con un envoltorio (`withEscalera(base, () => escalera)`) en servidor y cliente: la regla de la pendiente la acepta sola (31° < 45°). Por la sonda de 0,5 m la franja andable real es `|x| < 1,5`. Desde la rampa no se sube a las terrazas de al lado (lisas, >45°).
  - La atalaya apunta a cualquier asaltante (`raid`), también a El Triángulo; "de noche" = `isNight`.
  - Cambios de regla con tests adaptados (ninguno borrado): versión de protocolo → 40; el test de S4-E que esperaba "La sala está en calma…" ahora espera "El Cucurucho despierta".
- **Marcas `// S4-F`:** resueltas todas. Queda `// S4-H` (visiones de entrada y de la Escalera).
- Rendimiento móvil: 4 discos de sombra en la sala; fuera, 1 bloque + 1 malla instanciada de 40 escalones, 1 torre y 1 papel. Rehacer las 4 mallas de las Montañas pasa una sola vez por mundo. Sin luces nuevas.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: pasar el bruto de roca y entrar a la sala; pegarle de frente (casi nada) y por detrás; alzar un pilar entre los dos y esperar la embestida (¿se lee el gorro rojo?, ¿1 s da tiempo?); salir de los círculos del alud. Vencerlo y ver la atalaya de noche. Con Piedra, 3 veces junto al bloque del Umbral (x = 0, borde norte del bosque) y subir a pie; mirar si los escalones tapan bien la grieta del terreno. Constantes: `CUCURUCHO`/`ATALAYA` en `src/shared/sim/cucurucho.ts`, `UMBRAL`/`ESCALERA` en `src/shared/mountains.ts`, `ENEMY.boss4`.

## Slice 4 · S4-G — el Dragón — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S4-G-dragon.md` (7d0261c).
- Commits: 8d52804 (T1 reglas: `src/shared/dragon.ts`), 3e12b9d (T2 saltar y domar en el servidor, protocolo v41), feeca16 (T3 volar: techo, niebla, pasajero, asedio, v42), df56a7f (T4 cliente).
- Tests: npm test 774 (antes 760), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 42**. Campo guardado nuevo opcional `SavedPlayer.dragon` (dónde espera): las partidas viejas cargan.
- Dibujo: `public/enemies/enemy4.png` (459 × 512) por `PaperActor`, **8 m de ancho**; morado mientras es salvaje, sus colores al domarlo.
- Cómo funciona:
  - **Cuándo:** solo los días de **tormenta** y solo con `purified4` (El Cucurucho vencido). Da vueltas al Pico: una vuelta cada 10 s, 8 m por debajo de la cima. Es una función pura del tiempo (`dragonPos`): cliente y servidor lo ven igual, sin red.
  - **El salto:** en la cima del Pico (≤ 9 m del centro), cuando pasa por tu lado (un aro dorado en el borde marca la ventana, ~1,5 s por vuelta) → **A / E** "Saltar al dragón". Fuera de la ventana: "Aún no. Espera a que pase por debajo".
  - **La doma:** caes en su lomo y te lleva en su vuelta. Anillo de **5 rondas** (3,4 → 5,4 rad/s, zona 0,9 → 0,5); en las rondas 3 y 5 la aguja **gira al revés**. Un amigo a ≤ 6 m calma (×1,5), como siempre. Fallo: "Te tira. ¡Abre el planeador!" y caes desde donde estaba (Espacio / B abre el planeador). Ganas: «Mi dragón… Eso sí que no, <nombre>.»
  - **Volar:** stick a 15 m/s; **mantener B / Espacio = subir 4 m/s**, soltar = bajar 2 m/s. Sin aliento. Techo: suelo + 35 m (y ≤ 120). Toca suelo o agua y se posa. **A / E / M** baja (solo posado); A junto a él lo vuelves a montar.
  - **Pasajero:** uno, con el "Subir detrás de …" de siempre (el dragón tiene que estar posado).
  - **Servidor:** tope 17 m/s (+2 s de gracia al bajar), altura ≤ suelo + 36 y ≤ 121, o cualquier movimiento que solo baje (al salir volando de un acantilado quedas por encima de la franja y vas bajando). Sin reglas de pendiente ni de agua en el aire.
  - **Muro de niebla:** al norte del borde de las Montañas (z < −HALF − 200) un plano gris; "La niebla te devuelve. Aún no". Lo abre el Slice 5.
  - **Asedio:** durante un asedio no se aterriza a ≤ 30 m del Corazón (el servidor rechaza bajar de suelo + 5; el cliente se mantiene a 6; A: "Aquí no se aterriza en pleno asedio").
  - Entrar a una mazmorra, morir o teletransportarte te baja (el dragón espera).
- Decidido por Claude — revisar:
  - **Radio de 22 m, no 14:** a 14 m y 8 m bajo la cima el dragón atravesaba la falda del Pico. Vuela a `max(cima − 8, suelo más alto bajo el círculo + 3)`. Por eso la ventana del salto es **por rumbo** (±0,47 rad desde la cima) y no "≤ 4 m en horizontal": saltas ~16 m hacia fuera y abajo.
  - Un salto fuera de la ventana no te tira del Pico: solo avisa. La caída con planeador pasa si el anillo te tira.
  - La inversión del anillo es una **velocidad negativa** en `TameView.speed` (sin campo nuevo; `ringAngle` ya envuelve negativos).
  - El dragón no lleva id de enemigo: va en `snap.dragons` como las ranas (salvaje = owner null).
  - Personal (como el spec): cada uno doma su copia.
  - No se hizo "las bestias ignoran a los jinetes a más de 6 m" (spec §riesgos): con la regla de no aterrizar junto al Corazón basta de momento.
  - Cambios de regla con tests adaptados (ninguno borrado): versión de protocolo → 42; `mount` acepta hasta 17 (el test que rechazaba 15 ahora rechaza 18).
- Rendimiento móvil: 1 carta de papel por dragón a la vista (0–2), 1 aro y 1 plano de niebla. Volando, la cámara se aleja ×2,4 y sube un poco, **sin** más distancia de dibujo ni luces.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: vencer al Cucurucho y esperar una tormenta (≤ 4 días); subir al Pico y ver el dragón morado. ¿Se entiende el aro dorado? ¿1,5 s basta? Las 5 rondas (¿se nota el cambio de sentido?). Fallar a propósito y abrir el planeador. Volar: subir con B, soltar, salir del Pico en picado, ir hasta la niebla. Llevar a un amigo detrás. Constantes: `DRAGON` en `src/shared/dragon.ts`, `FAR_K` en `src/client/camera-rig.ts`.

## Slice 4 · S4-H — tobogán de nieve y visiones de la Montaña — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S4-H-tobogan.md`.
- Commits: 8bd7375 (T1 reglas `src/shared/snowslide.ts` y tope 16 en el servidor, protocolo v43), 60b4677 (T2 visiones de entrada y de la Escalera), a94254c (T3 cliente).
- Tests: npm test 789 (antes 774), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 43** (`'slide'` en `ANIMS`; el servidor acepta deslizadores más rápidos). Sin campos guardados nuevos.
- Cómo funciona:
  - **Tobogán:** en nieve (Montañas con altura > 55 m, o el canal |x| < 5) con pendiente > 15°, **B / Espacio corriendo** → de barriga cuesta abajo, acelera hasta **14 m/s**; el stick lo tuerce ±30°. Termina con B, contra un árbol o roca (se para, sin daño), fuera de la nieve o tras 1 s en llano (< 8°) fuera del canal. Primera vez: "Tobogán. B para levantarte".
  - **El canal** te lleva siempre al sur, Peldaños abajo, y te para en el borde del bosque, a 3 m del Umbral.
  - **Servidor:** con anim `'slide'`, tope **16 m/s** si el principio y el final de la ventana son nieve y no sube más de 3 m; 1 s de gracia después.
  - **Visiones:** la primera vez que alguien entra en las Montañas («Qué alto, <nombre>. Qué frío.») y al alzar la Escalera (nombra a los presentes). Ya no queda ninguna marca `// S4-H`.
- Decidido por Claude — revisar:
  - "Nieve" = altura absoluta > 55 (la cima y la falda del Pico) o el canal; las Faldas fuera del canal no son nieve.
  - En el canal la bajada no depende de la pendiente local (tiene tramos de 7° y baches de 2–3 m); por eso el servidor tolera subir 3 m en la ventana.
  - Del Pico (d = 170) al Umbral son ~15 s a 14 m/s, no ~40 s: se respetó la velocidad del spec.
  - Sin animación de barriga en el kit de robots: la pose es la del salto sostenida (marcada `ponytail`).
  - La visión de las Montañas es una vez por mundo: los mundos que ya tenían `mountainsSeen` no la reciben.
  - Cambios de regla con tests adaptados (ninguno borrado): versión de protocolo → 43 en `protocol.test.ts` y `world-sim.test.ts`.
- Rendimiento móvil: nada nuevo que dibujar.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: subir al Pico, bajar hacia el canal, correr y pulsar B; ¿se entiende que el canal te lleva? ¿14 m/s es divertido o da miedo en móvil? Constantes: `SNOWSLIDE` en `src/shared/snowslide.ts`.

## Slice 5 — resumen (LEER PRIMERO)
- **S5-A a S5-H: todos hechos, ninguno bloqueado.** Rama `aventura/resto`, PR draft #3. Nada mergeado ni desplegado. Con esto **la historia de la Aventura está completa**.
- Tests finales: npm test 979, test:workers 12, check + build verdes. **PROTOCOL_VERSION = 54.** Todos los campos guardados nuevos son opcionales (`fogOpen`, `towerDay0`, `pillars`, `corruptSeen`, `invasion3`, `towerOpen`, `ending`, `endingNames`, `raidsOff`, `credits`, `star`): las partidas viejas cargan.
- **Qué hay:** S5-A las Tierras Corruptas al norte (el Borde, la Ceniza, el Espinar, el Lago Negro), la niebla que abre el dragón y la torre que crece en el horizonte · S5-B rayos marchitos, bestias de ceniza, espinas negras, arma 6 / Capa 4 y la fogata de la Ceniza · S5-C los 4 Pilares-raíz, el agua del Lago Negro, zonas 18–21 y La Flecha · S5-D Invasión 3 en el Corazón y la defensa aérea del dragón · S5-E la Torre (4 pisos, aliados blancos, escalera) · S5-F El Marchito en 3 fases en la Copa · S5-G el final (tarjetas, créditos, zonas limpias, torre blanca, el Guardián, la Grieta, asedios suaves con interruptor) · S5-H el Árbol-torre (mirador, fogata 7, la corriente) y la Estrella (luna llena, 4 rondas, montura de 13 m/s).
- **Decidido por Claude — revisar (lo gordo):**
  - **Asedios tras el final: ENCENDIDOS** (anulación del spec, decidida por el orquestador): ×0,6, sin tenientes, y "Noches de asedio: encendidas / apagadas" en el Menú junto al Corazón. El spec decía apagados con "Noches de desafío" para volverlos.
  - El Marchito: con raíces ×0,1 (no 0,2), núcleo corriendo ×0,1, 1 rayo en solitario; la Llamarada cuenta como golpe al Corazón Negro.
  - La Carrera de ceniza es un disco, no una tira; el agua del Lago Negro no depende del pilar; la Copa es un disco r 22; los suelos de la Torre son planos.
  - La Grieta es una muesca (no una rampa); la Torre ya no se re-entra tras el final (su puerta sube al mirador); el mirador está a 140 m y la subida al planear es "la corriente" (planeador gratis hasta tocar suelo) en vez de un anillo de 4 s.
  - La Estrella **sustituye al ciervo** (una sola montura de tierra por jugador); luna llena = `día % 8 === 0`; da vueltas en un círculo de 20 m en la Ceniza.
- **Balance a revisar en juego:** vida y carga de La Flecha; Invasión 3 (voluntad 390–858, ×1,5 bestias, 6 rayos); El Marchito solo ~6 min (objetivo 8) y en co-op; ×0,6 de los asedios tras el final; rondas de la Estrella (4, última de 0,55 rad) y 13/14 m/s; si desde el mirador se llega planeando a algún sitio útil.
- **Orden de prueba de toda la historia (mundo nuevo → créditos):** Corazón y primer asedio → combate y Raíz-madre (Enredadera) → ciervo → Invasión 1 → Costa: pez, santuarios, ballena, mazmorra (Viento), El Antenón → Invasión 2 y rescate del Tragón → Pantano: rana, santuarios, ámbar/Capa, mazmorra (Fuego), El Zancudo, fogatas → Montañas: Peldaños, frío, santuarios/cuarzo, mazmorra (Piedra), El Cucurucho, la Escalera, dragón en tormenta, tobogán → Tierras: niebla con el dragón, la Ceniza y su fogata, arma 6 / Capa 4, los 4 Pilares, La Flecha → Invasión 3 → la Torre → El Marchito → tarjetas y créditos (y entrar con alguien que no estaba) → el Guardián, la Grieta, el interruptor de asedios → subir al Árbol-torre y planear → esperar una luna llena (día 8, 16…) y domar la Estrella. Atajo: poner `ending: true` en el guardado para probar solo el post-juego.

## Slice 5 · S5-A — las Tierras Corruptas, la niebla del dragón y la torre del horizonte — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S5-A-tierras-niebla-torre.md` (bc3de62).
- Commits: 5d91763 (T1 terreno + nombres), f827b35 (T2 el Borde solo volando), 8c0100f (T3 puerta de niebla, torre por día, protocolo v44), f9b7fc5 (T4 cliente: trozos, colores, niebla), ffcc0c1 (T5 torre del horizonte).
- Tests: npm test 809 (antes 789), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 44**. Campos guardados nuevos opcionales: `SavedWorld.fogOpen`, `SavedWorld.towerDay0` (si falta, se pone el día de hoy al cargar: la torre empieza en 60 m). Las partidas viejas cargan con las Tierras tras la niebla.
- Cómo funciona:
  - **Mapa:** 480 × 200 m al norte de las Montañas (`CORRUPT_LANDS`, `inCorrupt`, `corruptDepth`). **el Borde** (d 0–20, de +90 a +20, roca lisa), **la Ceniza** (llano gris +15…+25), **el Espinar** (+10…+40), **el Lago Negro** (cuenca al oeste, r 40, ~14 m), **los Escalones rotos** (al este, 4 terrazas de 6 m, lisas) y la **meseta de la Torre** (|x| < 30, d > 170, E(0) + 30). Todo lo que está al sur no cambió (test con alturas grabadas antes). Límites = unión de 4 rectángulos.
  - **el Borde:** nadie cruza la línea de la vieja niebla (z = −HALF − 200) hacia el norte a pie, a caballo, en rana, nadando ni planeando: "El Borde no se cruza a pie. Solo volando". La pendiente de 45° también rige en las Tierras (la rana sigue exenta).
  - **La niebla:** un jinete de dragón que la toca: con las 4 Raíces-madre purificadas se abre para todo el mundo (`fogOpen`) con visión «Ya vienes. Bien. Te espero arriba, <nombre>.»; si falta alguna: "La niebla aguanta. Falta la <Raíz-madre>" (orden Bosque → Costa → Pantano → Montaña). Abierta, se vuela hasta el borde norte ("La niebla te devuelve. Ahí no hay nada"). El plano gris de la puerta se desvanece; otro marca el fin del mundo.
  - **La torre:** en (0, −HALF − 400), cono torcido de 12 lados morado oscuro con punta violeta. Altura `60 + min(80, días desde towerDay0)` (`towerHeight`), llega en `snap.towerH`. A menos de 300 m (y dentro del plano lejano) se ve la de verdad; si no, una **copia de cielo** sin niebla, dibujada primero sin escribir profundidad, al 80 % del plano lejano y escalada para ocupar el mismo ángulo: las montañas tapan su base.
- Decidido por Claude — revisar:
  - `snap.fog` es `'closed' | 'ready' | 'open'` (no un booleano): con `'ready'` el cliente deja volar hacia la niebla para que el servidor la abra.
  - El Lago Negro es solo una **cuenca seca** en S5-A: su agua (nivel local) llega con su Pilar en S5-C, donde el pez la necesita.
  - La meseta y los Escalones usan una altura fija (E en su x de referencia), no E(x), para que sean planos de verdad.
  - La roca de las Tierras no se trepa (S4-B solo en las Montañas); los Escalones rechazan con "Demasiado empinado", el Borde con "Roca lisa".
  - El paso por el Borde se bloquea con una línea (`rimCrossBlocked`), no solo con la pendiente: la roca de la cara sur del Borde sí se trepa desde S4-B.
  - La torre de verdad se oculta si queda más allá del plano lejano (gama baja: 120 m), así nunca desaparece entre 120 y 300 m.
  - Sin temporizador de "firstDay con Corazón": `towerDay0` es el día en que el mundo lo vio por primera vez (nuevo o al cargar).
  - Cambios de regla con tests adaptados (ninguno borrado): versión de protocolo → 44; el borde norte del mapa ya no es el de las Montañas (`coast.test`, `mountains.test`); el test de la niebla del S4-G ahora espera el texto de la Raíz-madre que falta; el test de nombres prohíbe `Flecha` salvo "Flechas" (ya había "Flechas" en un texto).
- Rendimiento móvil: 4 trozos (detalle a ≤ 160 m, silueta 16 × 16 si no). Vértices de detalle: 8 856 (gama baja, 2 214 por trozo), 13 872 (media), 19 032 (alta); siluetas 1 156. **Todo el grupo está oculto al sur de z = −HALF − 110 salvo volando: 0 draw calls más desde el bosque, la costa y el pantano**; +4 al norte. La torre: **+1 draw call** siempre (la copia de cielo o la real). Niebla: +1 plano.
- Verificado en navegador: no (el servidor de desarrollo arrancó; sin Playwright en el proyecto no se entró a jugar). Solo tests + check + build.
- Bloqueos: ninguno.
- Qué probar: desde el Corazón, ¿se ve la torre asomando tras las montañas? ¿Al atardecer? Con el dragón y 3 Raíces-madre, tocar la niebla (texto); con las 4, abrirla y bajar en la Ceniza. Intentar bajar el Borde a pie desde el sur. Subir los Escalones con la rana. Constantes: `CORRUPT_LANDS`, `TOWER_FOOT` en `src/shared/terrain.ts`; `TOWER`, `RIM_LINE` en `src/shared/corrupt-lands.ts`; `TOWER_NEAR`, `SKY_AT` en `src/client/scene/villain-tower.ts`.

## Slice 5 · S5-B — rayos marchitos, bestias de ceniza, espinas negras, arma 6 / Capa 4 y la fogata de la Ceniza — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S5-B-rayos-espinas-ceniza.md` (21d2730).
- Commits: f46b2b3 (T1 reglas: espina negra, `upgradeCost`/`capaCost`, `sim/rayo.ts`, fogata 6, protocolo v45), c4667db (T2 servidor: bestias del Espinar, rayos, espinas, mejoras), 164ab1a (T3 llamar monturas en la Ceniza, v46), 88f105c (T4 cliente).
- Tests: npm test 827 (antes 809), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 46**. Sin campos guardados nuevos: `SavedWorld.fogatas` de 6 carga con la Ceniza apagada; `weaponLvl` llega a 6 y `capaLvl` a 4. Las partidas viejas cargan.
- Cómo funciona:
  - **El rayo marchito** (`enemy11.png`, papel morado de 2 m, 60 PV): flota a 6 m del suelo; si ve a alguien a menos de 20 m se acerca, **destella en blanco 0,8 s**, se lanza en picado adonde estabas y muerde una vez (10 × Capa), y vuelve a subir. Uno cada 3 s. Las **flechas** siempre le llegan; la espada solo cuando está bajo ("Vuela alto. Flechas, o viento"). Una **ráfaga de Viento** lo tira al suelo 3 s (se pone pálido) y ahí se le pega.
  - **Bestias del Espinar:** con la niebla abierta, la primera vez cada día de juego que alguien vivo está en las Tierras: 6 bestias de ceniza (1 bruto) y 2–4 rayos (nunca más de 8 vivos) en el Espinar (d 85–165). Al amanecer se van con los lobos de siempre.
  - **Espina negra:** cada lobo o bruto que muere en las Tierras da 1 a quien lo mata; un rayo, la mitad de las veces. Los de asedio no dan.
  - **Arma 6:** en el Corazón, 6 espinas + 3 cuarzo + 10 piedra → +90 % (tope). **Capa 4:** 4 espinas + 2 ámbar → −40 % (tope).
  - **Fogata 6, la Ceniza:** anillo de piedras en (24, d 50). Se enciende igual (Llamarada o antorcha); de día lleva al Corazón y el Menú del Corazón dice "Ir a la Ceniza". **Junto a ella encendida, el Menú** muestra "Llamar al ciervo / a la rana / al pez (al Lago Negro)" por cada montura tuya: aparece aparcada ahí (ciervo 3 m al oeste, rana 3 m al norte, pez en el centro del lago). Mensaje nuevo `{ t: 'call', beast }`.
- Decidido por Claude — revisar:
  - **Llamar va en el Menú, no en A:** A junto a la fogata sigue siendo "Volver al Corazón". Rejilla táctil sin cambios (10).
  - **El pez se llama al centro del Lago Negro, que aún está seco** (el agua llega con su Pilar en S5-C): hasta entonces no sirve de nada allí.
  - Las bestias de día salen una vez por día de juego y solo si alguien está arriba (no hay temporizador de amanecer para una zona vacía). El día ya usado no se guarda: tras reiniciar el servidor pueden salir otra vez ese día.
  - **Sin tinte de ceniza en lobos y brutos:** sus modelos comparten materiales (igual que la Capa). Solo el rayo es de papel.
  - Rayos: el Viento no los empuja más que a un lobo; el Fuego los asusta como a los lobos. Nada les pega desde el aire todavía (el zarpazo del dragón es S5-D).
  - Las etiquetas del cliente (T1) ya miran solo el material clave (perla, cuarzo, espina+cuarzo, ámbar, espina+ámbar), como antes.
  - Cambios de regla con tests adaptados (ninguno borrado): versión de protocolo → 46; nivel 5 del arma sin espinas dice "Faltan materiales" (antes "El arma ya no da más de sí"); la Capa 3 sin espinas igual (antes "La capa ya no admite más corteza"); `weaponMult` topa en 1,9; fogatas 7 (antes 6) en `fogatas.test.ts`, en el protocolo y en los tests del servidor.
- Rendimiento móvil: los rayos son PaperActor (1 tarjeta + 1 sombra), como mucho 8 de día. La Ceniza reutiliza las mallas de fogata (+~9 mallas pequeñas).
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: abrir la niebla, bajar en la Ceniza y encender la fogata con una Llamarada. Esperar a un rayo: ¿se ve el destello a tiempo para rodar? Flechas contra él; Viento y espada. Cazar espinas (¿cuánto cuesta juntar 10?). Mejorar arma 6 y Capa 4. Junto a la fogata, Menú → llamar al ciervo y a la rana. Constantes: `RAYO` en `src/shared/sim/rayo.ts`, `ASH`/`CENIZA_FOGATA` en `src/shared/corrupt-lands.ts`, `UPGRADE`/`CAPA` en `src/shared/items.ts`.

## Slice 5 · S5-C — los 4 Pilares-raíz, el agua del Lago Negro, zonas 18–21 y La Flecha — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S5-C-pilares-flecha.md` (bcd7399).
- Commits: bb34044 (T1 reglas: agua del lago, `src/shared/pillars.ts`, zonas 18–21), 94cd906 (T2 servidor: pilares, `corruptSeen`, agua en el servidor, protocolo v47), 9ec41f6 (T3 La Flecha, v48), 6183078 (T4 cliente).
- Tests: npm test 862 (antes 827), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 48**. Campos guardados nuevos opcionales: `SavedWorld.pillars` (ids rotos), `SavedWorld.corruptSeen`. Las partidas viejas cargan sin pilares rotos y con 18–21 corruptas.
- Cómo funciona:
  - **El Lago Negro tiene agua** (`Terrain.waterAt`, `waterLevel(t, x, z)`): superficie 4 m bajo el borde de la cuenca (~10 m de hondo). Se nada y el pez va por él (cliente y servidor). Siempre lleno, no depende del pilar.
  - **Pilar de Enredadera** (−15, d 115): un espinar negro de r 15 que muerde 10 PV/s. Enredadera junto a cada una de sus 3 raíces desnudas (borde del espinar) → "Una raíz cruza las espinas (n/3)" y un puente de raíz hasta el núcleo. Con 3/3 se arranca. Limpia la zona 19.
  - **Pilar de Viento:** el núcleo está en el fondo del lago, atado a un **ancla** (id 930_001, tipo `anchor`, 150 PV). Solo se le pega **buceando** (≤ 4 m de su altura; desde arriba: "Está en el fondo. Bucea con el pez"): espada, o Viento ×3. Rota: el núcleo encalla en la orilla este envuelto en miasma; **3 ráfagas** lo destapan. Limpia la 20.
  - **Pilar de Fuego** (45, d 105): **la Carrera de ceniza** = un disco de r 35 de ceniza ardiente, 4 PV/s a pie o nadando, 0 a lomos (ciervo, rana, pez, dragón, pasajero). Al acercarse la primera vez salen **3 rayos** de guardia. **3 Llamaradas** queman el capullo. Limpia la 21.
  - **Pilar de Piedra:** arriba de los Escalones rotos (d0 + 34), con **tapa**. Se levanta mientras un pilar de Piedra está a ≤ 1,5 m de la losa (3 m al oeste) o **otro** jugador la pisa. Sin zona propia.
  - **Arrancar:** A junto al núcleo (≤ 2,5 m) → "Tiras del núcleo… (3 s)"; alejarse o morir → "Sueltas el núcleo". Si falta algo, lo dice ("Faltan raíces (1/3)", "Una cadena lo sujeta al fondo del lago", "El capullo de espinas aguanta. Fuego (0/3)", "La tapa no se mueve…"). Al romperse: "El Pilar-raíz de <poder> se parte (n/4)", visión «Eso me dolió, <nombres>…» (una por pilar) y una grieta violeta de la torre se apaga. **El 4.º deja la marca `// S5-D`** (Invasión 3).
  - **Tierras vistas** (`corruptSeen`): el primero que entra oye «Mi casa. Limpien los pies, <nombre>.».
  - **La Flecha** (`lieut3`, `enemy10.png`, 3 m): con `corruptSeen` y la 18 corrupta guía los asedios con **`raidN % 3 === 2`** (la Gata el 0, el Triángulo el 1: nunca coinciden; test de 1 a 30). 360 PV, anda como la Gata, patea 12 / 2 s. **Clavada** cada 7 s: raya roja en el suelo 1 s (`WolfView.aim`), carrera a 20 m/s hasta 4 m más allá de ti (≤ 24 m), 20 de daño a quien pille (rodar esquiva, parar para). Si la raya cruza una construcción (no el Corazón) se **clava** 4 s (`stuck`, se pone pálida). Al caer: el asedio huye, **2 espinas negras** a cada uno a ≤ 40 m y «Mi flecha… Suban, <nombres>. Arriba se acaba.».
- Decidido por Claude — revisar:
  - **La Carrera es un disco, no una tira de 120 m:** una tira se rodea andando; el disco obliga a entrar (≈ 70 m ida y vuelta). Se dibuja solo un anillo de calor a la altura del pecho.
  - **El agua del lago no depende del pilar** (el pilar necesita el agua). Lo que solo pregunta "¿esto está bajo `WATER_LEVEL`?" (lobos, apariciones) ignora el lago; allí arriba nadie camina en manada. Bajarse del pez en medio del lago se permite (el "Aquí es hondo" mira el mar).
  - "A mantenido 3 s" = A empieza un tirón de 3 s en el servidor; la condición se mira al empezar.
  - El ancla usa el tipo `anchor` (sus PV no se guardan: un reinicio la deja a 150, como el nudo del Zarzal). Los avances de raíces/miasma/capullo tampoco se guardan; los pilares rotos sí.
  - La Flecha usa un id normal de lobo (como la Gata y el Triángulo), no 900_008.
  - Puntos fijos (no sembrados) para Enredadera y Fuego; Viento y Piedra siguen al lago y a los Escalones de la semilla.
  - Cambios de regla con tests adaptados (ninguno borrado): versión → 47 y 48; las zonas de la Montaña ya no son las últimas (`slice(-8, -4)`), la lista tras un orbe del Pantano incluye 18–21; `isMountainZone` ya no cubre ≥ 18.
- Rendimiento móvil: todo dentro del grupo de las Tierras (0 draw calls desde el sur): 4 púas + 4 núcleos, 1 malla instanciada de 40 espinas, 3 raíces/puentes, cadena, ancla, miasma, capullo, anillo, tapa y losa, 1 disco de agua (~22 mallas pequeñas). Grietas de la torre: 1 malla instanciada. La Flecha: 1 PaperActor + 1 raya solo en su asedio.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: bajar en la Ceniza, cruzar el espinar sin puentes (¿10 PV/s asusta lo justo?), echar Enredadera en las 3 raíces. Llamar al pez al lago, bucear hasta el ancla (¿se entiende que hay que bajar?), 3 ráfagas en la orilla. Entrar a pie y a caballo en la ceniza; los 3 rayos. Subir los Escalones con la rana, alzar un pilar en la losa. Forzar el 2.º asedio (`raidN: 1`, `corruptSeen: true`): ¿se lee la raya roja?, ¿1 s da para rodar?, ¿se clava en un muro? Constantes: `PILLAR`, `THICKET`, `LAKE_PILLAR`, `ASH_RUN`, `LID` en `src/shared/pillars.ts`, `BLACK_LAKE` en `terrain.ts`, `FLECHA` en `sim/lieutenant.ts`, `CORRUPT_ZONES` en `corruption.ts`.

## Slice 5 · S5-D — Invasión 3 en el Corazón y la defensa aérea del dragón — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S5-D-invasion3-defensa-aerea.md` (a41f105).
- Commits: f18851d (T1 reglas: `stepChanneler`, `heartWill`, `AIR` en `dragon.ts`), efd2390 (T2 la invasión en el servidor, protocolo v49), ca47932 (T3 zarpazo y dragones aparcados, v50), 26095f7 (T4 cliente).
- Tests: npm test 883 (antes 862), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 50**. Campos guardados nuevos opcionales: `SavedWorld.invasion3` ('pending' | 'done') y `SavedWorld.towerOpen`. Las partidas viejas cargan (con los 4 pilares ya rotos y sin campo → 'pending').
- Cómo funciona:
  - **Disparo:** al romper el 4.º Pilar-raíz, `invasion3 = 'pending'` y visión «Ah. Ahora voy yo.» (resuelta la marca `// S5-D`). En la franja del aviso de asedio (atardecer) con Corazón vivo y alguien fuera de las mazmorras, **El Marchito llega del norte** (28 m del Corazón, hacia la torre): "El Marchito viene a por el Corazón del Bosque…".
  - **El asedio de esa noche** viene del norte, **×1,5** bestias y **6 rayos marchitos** delante de la manada. Los rayos del asedio se lanzan a jugadores **y a construcciones** (10 por picado a muros y trampas), nunca al Corazón.
  - **Canaliza:** va al Corazón y lo envuelve **90 s** (barra "El Marchito envuelve el Corazón del Bosque · 40 % · voluntad …"). Zarpazo de 14 a quien esté a 3 m. **Voluntad ×1,3** por jugadores activos al llegar: 390 / 546 / 702 / 858.
  - **Echarlo:** voluntad a 0 → se va, el Corazón intacto, «Mañana, en mi casa. Traigan a sus bichos blancos.».
  - **No echarlo:** al 100 % el Corazón **baja a 1 PV** (no se marchita por él), se ríe 4 s y se va; visión más mala.
  - **Pase lo que pase:** el asedio sigue hasta el amanecer; al amanecer `invasion3 = 'done'`, `towerOpen` y "Amanece. La puerta de la Torre se abre" (una puerta violeta en el pie sur de la torre; `snap.towerOpen` para el S5-E).
  - **Zarpazo:** a lomos del dragón y en el aire, A / clic / la pastilla A = zarpazo a un rayo a ≤ 5 m en 3D, **40**, 1 s. Sin rayo: "Zarpazo al aire. Solo alcanzas a los rayos". El servidor rechaza cualquier otro blanco ("Desde el aire solo alcanzas a los rayos"). Vale también en el Espinar.
  - **Dragones aparcados:** cada dragón domado aparcado a ≤ 30 m del Corazón, de noche, muerde (40) al rayo vivo más cercano a ≤ 12 m cada 3 s. Nunca a bestias de suelo ni al Marchito; no si su dueño va montado. Da igual que el dueño esté conectado.
- Decidido por Claude — revisar:
  - Solo un Marchito a la vez: si la Invasión 2 se debe el mismo atardecer, va primero; la 3 espera al siguiente.
  - Si el Corazón ya estaba en 0 (por las bestias), el Marchito no lo "sube" a 1: se queda marchito. Las bestias del asedio pueden marchitar un Corazón a 1 PV esa noche (la regla de siempre); aun así, la torre se abre al amanecer.
  - Guardar entre el atardecer y el amanecer deja 'pending': vuelve el siguiente atardecer (lo roto sigue roto).
  - Los rayos del asedio usan construcciones como blancos falsos (`#<id>`) en `stepRayo`, sin tocar su lógica; el tope de 8/12 rayos no se fuerza (6 del asedio + los del día que haya).
  - El zarpazo usa el mismo mensaje `attack` (sin mensaje nuevo, rejilla en 10); la "pastilla de ataque" es el botón A. No hay etiqueta "Zarpazo" en el botón: se dice en el toast.
  - Los textos usan `NAMES.heart` ("Corazón del Bosque"), no "Corazón" a secas como el spec.
  - Cambios de regla con tests adaptados (ninguno borrado): versión de protocolo → 49 y 50 en `protocol.test.ts` y `world-sim.test.ts`.
- Rendimiento móvil: sin mallas nuevas de día. De noche en la Invasión 3, 6 cartas de rayo más. La puerta: 1 plano solo cerca de la torre.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: romper los 4 pilares (o cargar con `pillars: [0,1,2,3]`), esperar al atardecer junto al Corazón: ¿se ve venir del norte? ¿La barra asusta lo justo? Echarlo con 1 y 2 jugadores (390 / 546). No echarlo: ¿se entiende que el Corazón queda a 1 PV y hay que curarlo? Volar con el dragón entre los 6 rayos: ¿5 m es fácil de acertar? Aparcar el dragón junto al Corazón antes del atardecer y mirar si muerde. Al amanecer, ir a ver la puerta. Constantes: `MARCHITO.channelFor`, `heartWill` en `src/shared/sim/marchito.ts`, `AIR` en `src/shared/dragon.ts`, `INVASION3` en `src/shared/sim/world-sim.ts`.

## Slice 5 · S5-E — la Torre: cuatro pisos, aliados blancos, La Flecha y la escalera — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S5-E-torre-mazmorra.md` (9e107ad).
- Commits: d9a1539 (T1 reglas: `src/shared/tower-dungeon.ts`, `src/shared/sim/tower-allies.ts`, `boulders`/`rockfallLane` con pasillo opcional), b0c70ca (T2 puerta y cuatro pisos, protocolo v51), 6cfbacf (T3 bestias y aliados blancos), da9b265 (T4 La Flecha, la escalera y la Copa vacía), 403eab6 (T5 cliente), 1dbe626 (a la Torre se entra a pie).
- Tests: npm test 909 (antes 883), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 51**. Sin campos guardados nuevos: todo el estado de la Torre es en vivo (como las demás mazmorras). Las partidas viejas cargan.
- Cómo funciona:
  - **Puerta:** en la cara sur de la torre (`towerEntrance()`). A / E a ≤ 5 m: antes de `towerOpen` dice "Una raíz cierra la puerta. Rompan los Pilares" (o "…Él vendrá antes" con los 4 pilares rotos). Abierta, dentro (a pie: montado dice "Bájate antes de entrar"). Salir: A en la entrada → 4 m al sur de la puerta.
  - **Interior** en `x = HALF + 750`, pasillo de 24 m de ancho hasta z 204 + **la Copa** redonda (r 22, centro z 222). Luz violeta; el piso 3 sin lámpara.
    1. **Piso 1 — Enredadera + Tragón:** foso de espinas (verja 0 en z 18). Dos raíces desnudas en el borde (x ±6, z 15): una Enredadera junto a cada una → "Una raíz cruza el foso (n/2)". Con las dos se cruza para siempre.
    2. **Piso 2 — Viento + Antenón:** 3 bocas de miasma. Una ráfaga despeja una 15 s; las tres a la vez → verja 1 para siempre (el Viento recarga en 6 s: solo se hace).
    3. **Piso 3 — Fuego + Zancudo:** 4 braseros; cada Llamarada enciende uno para siempre; los 4 → verja 2.
    4. **Piso 4 — Piedra + Cucurucho:** corredor de rocas (3 carriles, z 128–148, las reglas del S4-E) y losa sobre repisa de 3 m (x 8, z 156): pesa (pilar o alguien arriba) → verja 3; en cuanto alguien pasa, **se atasca abierta**.
    5. **La Flecha** (id 900_008, 470 PV) en la arena (z 169–193) con 4 columnas: despierta con alguien vivo dentro, se reinicia si la arena se vacía, su clavada se **clava en las columnas**, nunca sale de la arena. Barra "La Flecha 300/470 · ¡raya! / ¡clavada!". Cae → verja 4, **+2 espinas negras** a cada uno en la arena, no vuelve.
    6. **La escalera (z ≥ 198):** morir en la escalera o en la Copa te hace reaparecer en la escalera. Único punto de guardado del juego.
    7. **La Copa:** vacía, "La Copa está vacía. Arriba solo hay cielo" (marca `// S5-F`).
  - **Bestias:** la primera vez que alguien vivo pisa los pisos 1, 2 y 4 salen 2 lobos / 2 lobos / lobo + bruto al fondo del piso (una vez por vida del servidor). Cazan dentro (el interior es "cálido", así que usan objetivos sin fuego), no salen de las paredes ni cruzan verjas, y el amanecer no las borra.
  - **Aliados blancos** (solo si su jefe fue purificado): aparecen en su piso y siguen al jugador más cercano de ese piso a 2,5 m. Tragón: muerde (25) a una bestia a ≤ 4 m de ti cada 1,2 s. Antenón: cada 5 s tira por la cornisa a una bestia a ≤ 6 m de ti ("El Antenón blanco sopla…"). Zancudo: solo lleva el farol (luz). Cucurucho: piedra de 30 a una bestia a ≤ 15 m cada 6 s. No se les puede herir.
- Decidido por Claude — revisar:
  - **Suelos planos:** el "subir" se dibuja (escalones entre pisos), no se anda; todo a y 30 como las otras mazmorras.
  - **La Copa es un disco r 22** después del pasillo (el spec decía 24 × 230 m, pero r 22 no cabe en 24 m).
  - El foso pide **los dos** puentes y luego se cruza por cualquier parte (sin colisión por puente).
  - **Braseros solo con Llamarada** (la antorcha de los Candiles no entra; todo el que llega tiene Fuego).
  - La losa del piso 4 se atasca abierta al pasar alguien (como la del bosque): así un pilar que caduca no encierra a nadie.
  - **Punto de guardado posicional:** sin bandera; mira dónde quedó el cuerpo. Tras reiniciar el servidor se reaparece en el Corazón.
  - Las bestias de la Torre viven en `wolves` pero se mueven en un marco desplazado (`towerFrame`: `stepWolf`/`stepFlecha` recortan al mapa y la Torre está fuera); en la Torre **no huyen del fuego** (no hay adónde).
  - La Flecha de la Torre no arde (como los jefes); usa el id 900_008 del spec (el test de ids lo incluye).
  - Las verjas son un muro de raíz de una sola malla (móvil); 3 luces puntuales siempre en escena, como las otras mazmorras.
  - Cambios de regla con tests adaptados (ninguno borrado): versión de protocolo → 51 en `protocol.test.ts` y `world-sim.test.ts`; los tests que rechazaban el acto 26 ahora rechazan el 28.
- Rendimiento móvil: interior de ~45 mallas pequeñas + 3 luces fijas; 9 rocas movidas por fotograma; aliados = 1 PaperActor cada uno (máx. 4) + 1 esfera de farol. La Flecha: 1 PaperActor + su raya.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: con `towerOpen: true` y las 4 purificaciones, entrar por la puerta. ¿Se entiende que las raíces del foso piden Enredadera? ¿15 s dan para las 3 bocas solo? ¿El piso 3 se ve demasiado oscuro? Pasar las rocas y dejar un pilar en la losa. La Flecha: ¿se clava en las columnas a menudo? ¿470 PV es largo? Morir en la Copa y ver que vuelves a la escalera. Constantes: `TOWER_DUNGEON`, `TOWER_ROCKFALL` en `src/shared/tower-dungeon.ts`, `TOWER_ALLY` en `src/shared/sim/tower-allies.ts`.

## Slice 5 · S5-F — El Marchito, jefe final en la Copa — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S5-F-marchito-final.md` (0ac5ef4).
- Commits: 7d47a58 (T1 reglas puras `src/shared/sim/marchito-final.ts` + simulación en solitario), b5c2d6b (T2 fase 1 en la Copa, protocolo v52), 2651209 (T3 brotes, Corazón Negro y victoria), a891532 (T4 cliente).
- Tests: npm test 939 (antes 909), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 52**. Campo guardado nuevo opcional `SavedWorld.ending`: las partidas viejas cargan (jefe sin vencer).
- Dibujos: El Marchito `enemy12.png` a **9 m**; los brotes el mismo papel a 2 m teñido por poder; **el Corazón Negro `enemy8.png`** (638 × 536, alfa real) a 2,5 m.
- Cómo funciona:
  - **Despierta** cuando entra el primer jugador vivo en la Copa: "El Marchito baja a la Copa. Las raíces lo tapan: que arda el Fuego". PV **1 200 × (1 + 0,35 por cada jugador de más en la Copa)**, fijados al despertar. Barra: "El Marchito 900/1200 · raíces / ¡arde! / sin raíces / raíces verdes / ¡se tambalea!".
  - **Fase 1 — raíces (100 → 60 %):** con raíces le entra el **10 %**. Una **Llamarada a ≤ 5 m** de su cuerpo las prende: 2 s después caen y durante **8 s** le entra todo; luego salen raíces **verdes 24 s** ("Aún no prenden"). **Zarpazo** 18 a ≤ 5 m tras 1 s de aviso (se tiñe rojo): rodar esquiva, **parar lo tambalea 3 s** (daño entero). **Rayas de raíz:** cada 15 s, 3 rayas moradas en el suelo (una hacia cada luchador), 1,2 s después 15 a quien siga encima (rodar esquiva; parar solo bloquea).
  - **Fase 2 — cuatro brotes (60 → 25 %):** se hunde (no le entra nada) y salen 4 brotes en las diagonales: **Enredadera** (2 enredaderas), **Viento** (3 ráfagas), **Fuego** (3 Llamaradas; el capullo queda quemado), **Piedra** (un pilar en su losa, 3 m hacia el centro). Si dejas uno a medias se cierra (enredaderas 30 s, ráfagas 15 s). Abierto: **A / E "Arrancar el brote"** (acto 28) y aguantar **1,5 s** a ≤ 3 m; un golpe lo estropea ("Se te escapa el brote"). Cada brote le quita el **8,75 %**. Cerrado, A dice qué pide ("Lo tapa un miasma. Viento (1/3)"). **Rayos:** 1 si estás solo, 2 con amigos; uno vuelve 10 s después de caer.
  - **Fase 3 — el Corazón Negro (25 → 0 %):** el cuerpo se queda tieso y el núcleo **corre a 7 m/s**, huyendo del más cercano, dejando un **rastro violeta** (4 PV/s si lo pisas). Corriendo, "las patas lo apartan" (×0,1). **Un pilar en su camino lo para 3 s** (cada pilar una vez): daño entero, **flechas ×1,5**. Cada 10 s vuelve a él y **se cura 5 %/s hasta que le pegas**. Barra "El Corazón Negro 200/300 · ¡parado! / ¡se cura!".
  - **Muerte:** reapareces en la escalera (el punto de guardado del S5-E). Si la Copa se queda sin nadie vivo, **la pelea se reinicia** (también en solitario: el spec lo pide así).
  - **Victoria:** `ending = true` (guardado), "El Corazón Negro se parte…" y visión «Yo también era un bosque… <nombres>.». Luego la Copa está en calma. Marca **`// S5-G`** en `winFinal` (visión larga, créditos, torre blanca, zonas limpias, el Guardián, asedios fuera).
- **Presupuesto de tiempo en solitario** (test `marchito-final.test.ts`, jugador guionizado con arma 5: un golpe cada 3 s, flecha cada 2 s con 40 % de acierto al núcleo corriendo, rueda en cada aviso, anda a 4,5 m/s, 3 s para entender cada brote, un rayo le roba 6 s de cada 14, acierta el pilar una vuelta de cada tres): **fase 1 ~2,3 min, fase 2 ~1,5 min, fase 3 ~2,8 min → ~6,7 min** (el test acepta 6–10). Quieto junto a él en la fase 1: ~36 s para perder 100 PV sin Capa.
- Decidido por Claude — revisar:
  - **Con raíces ×0,1** (el spec decía ×0,2): con ×0,2 y arma 5 el golpeteo solo acaba la fase 1 en ~1,5 min y el total no llega ni a 5. **Núcleo corriendo ×0,1** (el spec solo dice que es débil a Piedra y flechas). Las "raíces verdes" 24 s son el mando de ritmo de la fase 1.
  - **Pasos de los brotes** (el spec no los fijaba): 2 / 3 / 3 / 1, y se deshacen si los dejas. **1 rayo en solitario** (el spec decía 2): con dos, quedarse quieto mata en ~23 s.
  - "≤ 5 m" de la Llamarada se mide al borde de su cuerpo (2,5 m). Sin colisión con su cuerpo. Las rayas: una por luchador (hasta 3), el resto al azar.
  - Un golpe durante el tirón = bajar 1 PV o más de salud desde que empezó (sirve para rayos y rastro).
  - La visión de la victoria es corta; la larga y los créditos son del S5-G. No se limpia ninguna zona todavía (la 18 y "todas" van en el S5-G).
  - Sin telón pintado de la Copa (el spec lo pedía: un quad con el mapa); queda para el S5-G o pulido.
  - Cambios de regla con tests adaptados (ninguno borrado): versión de protocolo → 52 en `protocol.test.ts` y `world-sim.test.ts`; el acto rechazado pasa de 28 a 29; el test del S5-E que esperaba "La Copa está vacía…" ahora espera "El Marchito baja a la Copa".
- Rendimiento móvil: 1 papel grande + 4 brotes + 1 núcleo (PaperActor) + 3 tiras + 16 discos del rastro (se ocultan fuera de la pelea). Sin luces nuevas.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: con `towerOpen: true` y las 4 purificaciones, subir hasta la Copa (o poner al jugador en z 222 de la Torre). ¿Se lee que hay que quemar las raíces? ¿24 s de raíces verdes aburren? ¿Las rayas moradas se ven a tiempo? En la fase 2: ¿se entiende qué pide cada brote (color + mensaje)? ¿Un rayo molesta lo justo? En la fase 3: ¿se puede poner un pilar en el camino del núcleo cuando vuelve a curarse? Cronometrar la pelea entera en solitario (objetivo ~8 min) y con 2. Constantes: `FINAL` en `src/shared/sim/marchito-final.ts`.

## Slice 5 · S5-G — el final y el mundo después — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S5-G-final-mundo-despues.md` (e4eb9e9).
- Commits: a354052 (hueco del S5-F: **la Llamarada cuenta como golpe al Corazón Negro** — le hace 6 (×0,1 corriendo) y corta la curación), 80bea40 (T1 reglas puras `src/shared/ending.ts` + la Grieta en `corrupt-lands.ts`), bd4ae99 (T2 el final en el servidor, protocolo v53), eac3cfc (T3 asedios tras el final + interruptor), ae002b3 (T4 cliente).
- Tests: npm test 963 (antes 939), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 53**. Campos guardados nuevos, todos opcionales: `SavedWorld.endingNames`, `SavedWorld.raidsOff`, `SavedPlayer.credits`. Las partidas viejas cargan (una con `ending: true` sin nombres acredita a "vosotros").
- Simulación en solitario del S5-F con la Llamarada al núcleo: **~6,1 min** (fase 3 baja de ~2,8 a ~2,3 min); el test sigue pidiendo 6–10.
- Cómo funciona:
  - **Al caer El Marchito:** "El Corazón Negro se parte…" y "Todas las raíces marchitas se secan a la vez": **las zonas 0–21 quedan limpias**. A todos los conectados, mensaje nuevo `ending`: **4 tarjetas de 5 s** (se encoge; el Corazón Negro se agrieta; «Yo también era un bosque… <nombres>.»; aparece el Guardián) y luego **créditos** que suben 25 s ("Bosque" · los nombres de la Copa · "Dibujos: el sobrino" · "Hecho por Gabriel" · "Gracias por jugar"). ✕ / Enter salta una tarjeta. Quien estaba en la Torre vuelve junto al Corazón (4 m).
  - **Créditos una vez por jugador** (`credits`): quien no estaba conectado los recibe al entrar la próxima vez, encabezados por "Mientras dormías, Ana y Leo vencieron a El Marchito." (o "venció").
  - **La torre se vuelve blanca** con la punta verde (se repintan los colores de vértice de la misma malla; sin draw calls nuevas).
  - **El Guardián** (`enemy6.png`, papel de 3 m) 8 m al este del Corazón. **A / E a ≤ 3 m: "Hablar con el Guardián"**, 6 frases que dan pistas (la Grieta, el interruptor, las espinas, las fogatas…). Solo cliente: no hay nada que validar.
  - **La Grieta:** una muesca de 6 m en `x = 0` cortada a 30° desde el pie del Borde (la Ceniza) hacia el sur hasta dar con la montaña (~75 m). Dentro de la banda el Borde se cruza a pie (servidor y cliente: `rimCrossBlocked(pz, nz, nx, grieta)`), y el terreno se envuelve con `withGrieta` como la Escalera.
  - **Asedios tras el final (anulación del spec, decidido por el orquestador):** siguen **encendidos**, más suaves: **×0,6** de la oleada que ya tocaba, **sin tenientes**, aviso "Quedan bestias sueltas por el norte. Vuelvan al Corazón". **Menú junto al Corazón: "Noches de asedio: encendidas / apagadas"** (mensaje `{t:'raids', on}`; el servidor pide final, vivo y a ≤ 4 m del Corazón; si no, "Eso se decide junto al Corazón"). Apagadas: ni aviso, ni oleada, ni sube el nivel de asedio. Cambiarlo durante un asedio vale para el siguiente atardecer.
  - **Invasiones:** ninguna más (las tres llevan `!ending`).
- Decidido por Claude — revisar:
  - **Asedios encendidos por defecto tras el final** (el spec decía apagados con "Noches de desafío" para volverlos): la defensa de la base es un pilar del juego y sin asedios las estructuras no sirven. El nombre nuevo es `NAMES.raidNights` ("Noches de asedio"); `challengeNights` queda sin usar. ×0,6 se aplica sobre la oleada ya reducida por la purificación (no sobre la completa) y no hay botín ×1,2.
  - La Grieta como muesca (mínimo entre suelo y rampa a 30°), no como rampa elevada: así nunca tapa nada y el suelo de la muesca es ≤ 31°.
  - Los créditos no esperan a que acaben las tarjetas del servidor: el cliente las pone en cola. Si llega otra visión en medio, la pisa.
  - Solo vuelve al Corazón quien estaba dentro de la Torre; el resto se queda donde está.
  - Las Raíces-madre como tocones blancos y la Ceniza verde-gris quedan para pulido (las zonas limpias ya se ven limpias). **El Árbol-torre** (§12, subir a la torre blanca) no está: la torre solo cambia de color. El telón pintado de la Copa sigue pendiente.
  - Cambios de regla con tests adaptados (ninguno borrado): versión de protocolo → 53 en `protocol.test.ts` y `world-sim.test.ts`; el test del S5-F que esperaba una `vision` con los nombres ahora espera el mensaje `ending` (la visión corta `VISION.final` se quitó: la sustituyen las tarjetas).
- Rendimiento móvil: 1 PaperActor (el Guardián) + repintar una vez los colores de la torre + reconstruir una vez los trozos de montaña y Tierras al llegar el final.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: vencer al Marchito (o poner `ending: true` en el guardado) con dos jugadores y uno desconectado; ver las tarjetas, saltarlas con ✕, que los créditos suban legibles en móvil; entrar con el desconectado. ¿Se ve la torre blanca desde lejos? Hablar con el Guardián. Bajar por la Grieta andando y volver a subir. Un atardecer tras el final: ¿×0,6 se nota? Apagar y encender los asedios desde el Menú junto al Corazón. Constantes: `ENDING` en `src/shared/ending.ts`, `GRIETA` en `src/shared/corrupt-lands.ts`.

## Slice 5 · S5-H — el Árbol-torre y la Estrella — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-aventura-S5-H-arbol-torre-estrella.md` (38beb6a).
- Commits: 6acf207 (T1 reglas puras: `src/shared/estrella.ts`, `LOOKOUT`/`withLookout` en `ending.ts`, fogata 7), 6b7c8bc (T2 servidor, protocolo v54), 8283f61 (T3 cliente).
- Tests: npm test 979 (antes 963), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 54**. Campo guardado nuevo opcional: `SavedPlayer.star`. Las partidas viejas cargan; una con `ending: true` enciende la fogata 7 al cargar.
- Cómo funciona:
  - **El Árbol-torre (Idea de Claude):** tras el final, A / E en la puerta de la torre → **"Subir al Árbol-torre"**: apareces en la cima (un disco de 7 m, 140 m sobre la meseta; el terreno se levanta con `withLookout`, así que arriba se anda normal). La torre se dibuja entera (140 m). La cima es la **fogata 7**, encendida por el final: A allí de día → vuelta al Corazón, y el Menú del Corazón dice "Ir a la cima del Árbol-torre". Montado: "Bájate antes de subir".
  - **La corriente:** al salir de la cima (andando o planeando) el planeador no gasta aguante hasta tocar suelo.
  - **La Estrella** (`enemy14.png`, papel de 2,2 m): tras el final, en noches de **luna llena** (`día % 8 === 0`) rueda en un círculo de 20 m en la Ceniza. Al atardecer de ese día, a todos: "Luna llena esta noche. Algo rueda por la Ceniza". A / E a ≤ 4 m → **"Domar la Estrella"** (acto de montura 18): el anillo, **4 rondas** (los amigos cerca calman, como siempre). Ganada, **es tu montura de tierra en lugar del ciervo**: mismos Montar / Bajar / asiento de pasajero / llamada desde la Ceniza, **13 m/s** corriendo (7 al paso), tope del servidor 14.
- Decidido por Claude — revisar:
  - **Estrella = tu ciervo cambiado** ("Tu ciervo vuelve a su claro"): no hay dos monturas de tierra. La llamada desde la Ceniza sigue diciendo "ciervo".
  - **La puerta de la Torre ya no entra** tras el final: sube. La mazmorra está acabada.
  - La cima a 140 m (no 200) y **la corriente** en vez del anillo de 4 s que rellena aguante una vez; desde 140 m se planea ~600 m, pero el Borde se cruza solo por la Grieta, así que no llega al Corazón planeando.
  - Sin luna en el cielo: solo el aviso del atardecer. Ella sigue rodando mientras la domas (el anillo se ancla donde empezó, 6 m de correa).
  - Cambios de regla con tests adaptados (ninguno borrado): versión 53 → 54 en `protocol.test.ts` y `world-sim.test.ts`; fogatas 7 → 8 en `fogatas.test.ts`, `protocol.test.ts` (travel 7 válido, 8 no; acto de montura 18 válido, 19 no) y los arrays de fogatas de `world-sim.test.ts`.
- Rendimiento móvil: 1 PaperActor por Estrella visible; la llama de la cima sin anillo de piedras.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: con `ending: true`, A en la puerta de la torre → cima; saltar y planear hacia el sur; volver con A en la fogata. Poner la hora en la noche del día 8 (o 16…) y buscar la Estrella en la Ceniza; domarla con y sin un amigo al lado; correr con ella. ¿Se ve bien el papel girando? Constantes: `ESTRELLA` en `src/shared/estrella.ts`, `LOOKOUT` en `src/shared/ending.ts`.

## Progresión — resumen (LEER PRIMERO)
Subproyecto #4 hecho en 4 planes (spec `docs/superpowers/specs/2026-09-27-progresion-design.md`). Protocolo 54 → 58, un plan por versión; tests 979 → 1043. Todo va por el Menú: **cero pastillas nuevas**.
- **P4-A — Savia y Rango** (v55): Rango 1–8 por hitos (casi todo primeras veces) + un poco por matar (tope 40/día). Los rangos no dan combate. Las partidas viejas calculan su Savia al cargar.
- **P4-B — Oficios** (v56): 7 puntos para 12 pasivas de utilidad en 3 ramas; olvidar en el Corazón por 5 bayas.
- **P4-C — Aspecto** (v57): 8 colores (copia de `Main` por jugador) y sombreros en la cabeza; se ven para todos.
- **P4-D — Libro y Proezas** (v58): página Libro en el Menú; contadores; 6 Proezas que solo dan sombrero o sello.
- **Decidido por Claude — revisar (lo más gordo):**
  - Los niveles no dan daño, vida ni defensa: arma y Capa siguen siendo lo único de combate (así no se re-afina ningún jefe).
  - Varios oficios cambiaron de efecto porque la mecánica del spec no existe (Pies ligeros, Pulmón, Mano amiga, Mochila honda; ver P4-B).
  - Las Proezas de peleas únicas del mundo (Tragón, El Marchito) solo se pueden ganar en esa pelea.
  - Zonas limpias y días del Libro son del mundo, no de cada jugador.
- **Balance a comprobar — la curva de Savia:** umbrales 0 / 80 / 220 / 420 / 680 / 980 / 1300 / 1650 (`PROGRESS.ranks`). Toda la historia sin contar lo vivo da ~1270 (Rango 6); tenientes, zonas, pilares, asedios y el tope de caza deberían llevar a Rango 8 cerca de El Marchito, no antes. Si llega antes, subir los últimos umbrales; si no llega, bajar el 8.
- **Orden de prueba:** (1) partida vieja avanzada → Rango correcto en la mochila y en el Libro; (2) matar lobos hasta el tope; (3) subir a Rango 2 → tarjeta, destello, Hoja en Aspecto, un oficio; (4) planear con Planeo largo y galopar con Pastor (que el servidor no te devuelva); (5) color y sombrero con otro jugador delante; (6) Libro: contadores tras un jefe y un asedio; (7) Proezas: carrera del pez rápida, Nenúfares sin mojarse, noche en la Cumbre sin fuego, asedio con el Corazón sobre la mitad.

## Progresión · P4-A — Savia y Rango — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-progresion-P4-A-savia-rango.md` (a1c3f2f).
- Commits: 45d0c5f (T1 reglas puras: `src/shared/progression.ts`, `NAMES.xp`/`NAMES.rank`), 117c315 (T2 servidor, protocolo v55), 081f5b0 (T3 cliente).
- Tests: npm test 991 (antes 979), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 55**. Campos guardados nuevos, opcionales: `SavedPlayer.xp`, `SavedPlayer.killDay`. Las partidas viejas cargan y salen con su Rango.
- Cómo funciona:
  - **Savia = hitos que el guardado ya sabe + `xp` guardado.** `milestoneXp` cuenta santuarios ×30, cofres ×10, monturas ×40 (ciervo, pez, rana, dragón, Estrella), poderes ×110 (60 del altar + 50 del jefe de su mazmorra), niveles de arma y Capa ×10, el final 150. Nadie empieza en Rango 1 con media historia hecha.
  - **`xp` guardado:** matar con golpe o flecha (lobo 1, bruto 3, rayo 2; **tope 40 por día de juego**), tenientes y La Flecha de la Torre 50 a los vivos a ≤ 40 m, ballena 40 a cada tripulante, zona limpia 15 a quien está a ≤ radio + 10 m, Pilar-raíz roto 40 a ≤ 40 m, asedio aguantado 15 a cada conectado.
  - **Rangos:** 0 / 80 / 220 / 420 / 680 / 980 / 1300 / 1650 (`PROGRESS.ranks`). Al subir, mensaje `rankUp` a todos: tarjeta **"Rango N. Un punto de oficio."** para ti y un **destello verde** (esfera translúcida 1,2 s) en tu robot para todos. En la mochila: "Rango 3 · 300/420 Savia · …". Los rangos no dan daño, vida ni defensa.
- Decidido por Claude — revisar:
  - Los 4 jefes de mazmorra (Tragón, Antenón, Zancudo, Cucurucho) no dan Savia en la pelea: van con el poder de su altar (así no se cuentan dos veces). Quien ayuda en la pelea pero no coge el poder los cobra al cogerlo.
  - El final (150) se da a todos los jugadores del mundo, no solo a los que estaban en la pelea (el guardado no sabe quién estaba).
  - Solo las muertes por golpe o flecha dan Savia; viento, fuego, trampas y los aliados del Corazón no. "Bestia de ceniza" = el rayo.
  - Con toda la historia sin contar lo vivo salen ~1270 (Rango 6); tenientes, zonas, pilares y asedios lo llevan a 8 cerca del final. Calibrar en juego.
  - No hay puntos de oficio que gastar todavía (P4-B).
  - Cambios de regla con tests adaptados (ninguno borrado): versión 54 → 55 en `protocol.test.ts`, `world-sim.test.ts` y `world-sim-s5h.test.ts`.
- Rendimiento móvil: 1 esfera por jugador creada la primera vez que sube, oculta el resto del tiempo.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: cargar una partida avanzada y mirar el Rango en la mochila; matar lobos hasta el tope; romper un pilar con un amigo al lado; ver la tarjeta y el destello (también desde el otro jugador). Constantes: `PROGRESS` en `src/shared/progression.ts`.

## Progresión · P4-B — Oficios — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-progresion-P4-B-oficios.md` (4667365).
- Commits: bde6a53 (T1 reglas puras: `SKILLS`/`BRANCHES`, `canLearn`, `hasSkill`, `SKILL_FX` en `src/shared/progression.ts`; nombres en `names.ts`), 2f131e2 (T2 servidor, protocolo v56), 60fe281 (T3 cliente: movimiento), a18d779 (T4 pantalla Oficios).
- Tests: npm test 1017 (antes 991), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 56**. Campo guardado nuevo, opcional: `SavedPlayer.skills`. Las partidas viejas cargan sin oficios y con todos sus puntos libres.
- Cómo funciona:
  - Cada Rango 2–8 da 1 punto → 7 puntos para 12 oficios en 3 ramas de 4 (**Andar**, **Oficio**, **Compañía**), en orden dentro de la rama. Mensajes `{ t: 'learn', id }` y `{ t: 'forget' }`; el servidor comprueba puntos, orden, Corazón y bayas.
  - **Menú → Oficios:** 3 columnas × 4 botones de 48 px (verde = aprendido, borde = se puede, gris = aún no). Tocar uno enseña su frase y "Aprender (1 punto)". Arriba "Puntos: N". Junto al Corazón sale **"Olvidar oficios · 5 bayas"** (devuelve todos los puntos, sin límite).
  - Efectos: **Pies ligeros** aliento vuelve ×1,25 · **Planeo largo** se hunde ×0,8 · **Pulmón** nadar rápido gasta la mitad · **Trepador** trepar gasta −25 % y con lluvia se trepa a media velocidad · **Mano buena** +1 madera/piedra/bayas · **Fogatero** viaje de fogata 2 s · **Trampero** estacas y red +30 % de vida · **Buen ojo** ámbar y cuarzo vuelven en 1 día · **Mano amiga** levantar desde el doble de lejos · **Silbido** llamar monturas desde cualquier fogata encendida · **Mochila honda** la tumba vuelve a ti desde 10 m · **Pastor** ciervo/Estrella/rana +10 %.
  - Validación del servidor: el tope de velocidad de montura sube con Pastor; la roca mojada se deja pisar a quien tiene Trepador; el planeo lento pasa (el servidor nunca comprobó la caída). Tests de que esos movimientos no se rechazan (y sí sin el oficio).
- Decidido por Claude — revisar:
  - Andar a pie no gasta aliento en este juego → **Pies ligeros** = el aliento vuelve más rápido.
  - No hay buceo a pie → **Pulmón** = nadar rápido gasta la mitad.
  - Levantar a un amigo es instantáneo → **Mano amiga** = desde el doble de lejos (5 m).
  - La tumba ya guarda toda la mochila → **Mochila honda** = solo el radio (10 m).
  - **Trampero** = +30 % de vida de la trampa (dura más porque el desgaste va por toque).
  - **Pastor** cuenta el ciervo, la Estrella y la rana.
  - Cambio de regla con tests adaptados (ninguno borrado): versión 55 → 56 en `protocol.test.ts`, `world-sim.test.ts`, `world-sim-s5h.test.ts` y `world-sim-p4a.test.ts`.
- Rendimiento móvil: nada nuevo en escena; el panel es HTML del Menú. Cero pastillas nuevas.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: subir a Rango 3, aprender Pies ligeros y Planeo largo, planear; trepar con lluvia con Trepador; olvidar en el Corazón con 5 bayas; montar con Pastor y galopar (que no te devuelva el servidor). Constantes: `SKILL_FX` en `src/shared/progression.ts`.

## Progresión · P4-C — Aspecto — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-progresion-P4-C-aspecto.md` (8195f7f).
- Commits: 0a4f53f (T1 reglas puras: `COLORS`, `HAT_IDS`, `hatUnlocked`, `unlockedHats`, `isLook`, `HAT_HINTS` en `src/shared/progression.ts`; nombres en `names.ts`), 755d6fb (T2 servidor, protocolo v57), 35e2f93 (T3 cliente: tinte, sombreros, pantalla Aspecto), 0204173 (sombrero bien puesto tras verlo en navegador).
- Tests: npm test 1026 (antes 1017), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 57**. Campo guardado nuevo, opcional: `SavedPlayer.look`. Las partidas viejas cargan en naranja y sin sombrero.
- Cómo funciona:
  - **Menú → Aspecto:** fila de 8 círculos de color y botones de sombrero ("Sin sombrero" + 6; los bloqueados en gris con su pista, "Se gana con Piedra"). Tocar aplica al momento. Mensaje `{ t: 'look', color, hat }`; el servidor valida rango y que el sombrero esté ganado (si no, lo dice con la pista).
  - Sombreros: **Hoja** Rango 2 · **Caracola** Viento · **Corona de ámbar** Capa 3 · **Cuernos de cuarzo** Piedra · **Aureola blanca** El Marchito vencido en el mundo · **Estrella** la Estrella domada. Nunca se vuelven a bloquear.
  - Los demás reciben `look` en el snapshot solo si no es el de por defecto; el propio lleva `look` y `hats` (los ganados).
- Modelo: `robot.glb` tiene `Grey` (juntas, 1 594 vértices), `Main` (naranja, 5 056) y `Black`. El color vive en `Main`: **solo se clona `Main`** (una copia por jugador, solo si elige otro color que el naranja). Visto en navegador: todo el cuerpo cambia; las juntas grises siguen grises, que queda bien.
- Rendimiento móvil: clonar el material no añade draw calls; cada sombrero es **una malla fusionada con un material** (1 draw call) → ≤4 más con 4 jugadores. Geometrías y materiales de sombrero compartidos; la copia de `Main` se libera cuando el jugador se va (`Actor.dispose`). Cero luces, cero pastillas.
- Decidido por Claude — revisar:
  - Los 8 colores: Naranja (el original), Azul, Verde, Rojo, Morado, Hueso, Carbón, Rosa.
  - Formas: Hoja (hoja plana + rabito), Caracola (cono + anillo), Corona de ámbar (aro + 2 puntas), Cuernos de cuarzo (2 conos), Aureola (aro flotante, sin sombra de luz), Estrella (octaedro aplastado).
  - El sombrero va en el nodo `Head` a la altura de la cúpula (`Head_end` × 1,3) y a tamaño ×2 (la cabeza mide ~0,8 m).
  - "Aureola blanca" usa el `ending` del mundo (El Marchito vencido), igual que la Savia de P4-A.
  - Cambio de regla con tests adaptados (ninguno borrado): versión 56 → 57 en `protocol.test.ts`, `world-sim.test.ts`, `world-sim-s5h.test.ts`, `world-sim-p4a.test.ts` y `world-sim-p4b.test.ts`.
- Verificado en navegador (Chromium headless, `npm run dev:server`): Ana azul con Hoja y Bea roja con Cuernos de cuarzo, una junto a la otra; los colores y sombreros se ven sobre la cabeza y siguen al robot. El panel Aspecto se ve bien a 900 px. No probado en móvil real.
- Bloqueos: ninguno.
- Qué probar: elegir color con otro jugador delante; ganar Rango 2 y ponerse la Hoja; tocar un sombrero bloqueado (sale la pista). Constantes: `COLORS`, `HAT_IDS` en `progression.ts`; formas en `src/client/actors/hats.ts`.

## Progresión · P4-D — Libro y Proezas — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-progresion-P4-D-libro-proezas.md` (fc81afe).
- Commits: bdf1b83 (T1 reglas puras: `FEATS`, `FEAT_HAT`, `BOSS_KINDS`, `bossesOf`, sombreros 7–9 en `src/shared/progression.ts`; nombres en `names.ts`), b8cfe10 (T2 servidor, protocolo v58), d931d60 (T3 cliente: Libro y formas de los 3 sombreros).
- Tests: npm test 1043 (antes 1029 tras T1; 1026 al empezar), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 58**. Campos guardados nuevos, opcionales: `SavedPlayer.bosses`, `kills`, `raidsHeld`, `feats`. Las partidas viejas cargan con ceros; los jefes y élites de mazmorra se deducen de los poderes.
- Cómo funciona:
  - **Menú → Libro:** "Rango 5 · 712 / 980 Savia" con barra; "Arma +4 (×1,6) · Capa 2 (−20 %) · Aliento N"; poderes y monturas (grises los que faltan); santuarios x/12 · cofres x/6 · jefes x/11 · zonas limpias x/22 · día N; lobos, brutos, rayos, asedios aguantados; las 6 Proezas (hechas en verde con ✔). Abajo: Oficios, Aspecto, Volver.
  - **Proezas** (las vigila el servidor donde ya pasa lo que miden): **Sin un rasguño** (vencer al Tragón sin recibir daño → sombrero *Papel doblado*) · **Pez veloz** (carrera de anillos en ≤ 80 % del tiempo) · **Pies secos** (Nenúfares del primero al último sin tocar el agua ni ir en rana) · **Solo contra el frío** (llegar a la Cumbre de noche sin haber estado junto a fuego desde que anocheció → *Gorro de nieve*) · **Noche entera** (asedio sin que el Corazón baje de la mitad) · **Corazón quieto** (estar en la caída de El Marchito con arma ≤ +4 → *Corona marchita*). Toast "Proeza: X." (+ "Nuevo sombrero: …").
  - **Jefes (11):** Tragón, Antenón, Zancudo, Cucurucho, sus 4 élites y los 3 tenientes (Gata, Triángulo, La Flecha); cuentan con el golpe final, para todos los vivos a ≤ 40 m.
- Decidido por Claude — revisar:
  - No se añade `SavedPlayer.hats`: todos los sombreros salen de flags que ya se guardan (hitos y `feats`).
  - Zonas y días son del mundo (`cleansed`, tiempo), no contadores por jugador.
  - Solo las muertes por golpe o flecha cuentan en el Libro (como la Savia); un jefe muerto por otra vía no suma.
  - Tragón y El Marchito se vencen una vez por mundo: su Proeza solo sale en esa pelea. Pez veloz solo en la doma del pez (luego ya no hay carrera).
  - "Cumbre" = más de 120 m montaña adentro (`MOUNTAINS.cumbre`); cualquier fogata, refugio, hoguera o el Corazón cuentan como calentarse. "Mojarse" = estar a altura de nado.
  - Formas: Papel doblado (dos hojas en V), Gorro de nieve (cono + pompón), Corona marchita (aro morado + 2 puntas torcidas); cada uno 1 malla, 1 draw call.
  - Cambios de regla con tests adaptados (ninguno borrado): versión 57 → 58 en los tests de versión; el sombrero fuera de rango pasa de 7 a 10 (`protocol`/`world-sim-p4c`, `progression-look`), 6 → 9 sombreros (`progression-look`, `hats`), 7 → 10 botones de sombrero (`look-ui`).
- Rendimiento móvil: el Libro es HTML del Menú; contadores enteros en el guardado; `self.book` son ~12 números por snapshot. Cero luces, cero pastillas.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: abrir el Libro con una partida avanzada; ganar cada Proeza (la del frío: anochecer en las Faldas y subir sin fuego); ponerse los 3 sombreros nuevos. Constantes: `FEAT_FAST`, `FEAT_HEART` en `progression.ts`; formas en `src/client/actors/hats.ts`.

## Tiendas — resumen (LEER PRIMERO)
#6 Tiendas y economía está hecho en 4 planes (spec `docs/superpowers/specs/2026-09-27-tiendas-design.md`; planes `docs/superpowers/plans/2026-09-27-tiendas-T6-*.md`). Sin moneda: trueque de los 7 materiales; Rango, oficios, sombreros, poderes, monturas y niveles no se comercian.
- **T6-A** (v59): reglas puras en `src/shared/shop.ts`, el Puesto (8 madera, 4 piedra; uno por jugador; sin vida, los asedios no lo ven), 4 estantes, reponer/quitar/recoger.
- **T6-B** (v60): comprar con el dueño fuera, Caja (tope 200), registro de 10 ventas, aviso al conectar, Menú → Puestos, 1 compra cada 0,5 s.
- **T6-C** (v61): trueque directo con A (Cambiar), ventana de dos columnas, dos Vale, atómico, guardado inmediato.
- **T6-D** (v62): el Buhonero junto al Corazón tras el rescate del Tragón (tabla fija, 20 tratos/día, nunca vende lo raro), +1 al amanecer del material del bioma, Encargos (Busco) con la paga apartada.
- **Decidido por Claude — revisar (lo más gordo):** el Puesto es un mensaje propio (`stallPlace`), no una `Structure`; no hay mapa, "Puestos" es una lista con distancia y rumbo; eventos `stall` a todos; los trueques viven solo en memoria; la paga de un Encargo es el `stock` del estante (mismo movimiento que una venta vista del otro lado); el Buhonero llega al amanecer después del rescate, 6 m al este del Corazón; reposición = 1 unidad por Puesto y amanecer; `found` solo cuenta lo recogido del mundo (partidas viejas: se deduce de la mochila y los niveles de arma/Capa); precios del Buhonero = tabla del spec §5.2 sin tocar.
- **Conservación:** cada plan tiene tests de propiedad (puros y por `handle()`) que suman mochilas + tumbas + Puestos tras cada paso; solo mueven la cuenta construir/recoger el Puesto, los tratos del Buhonero y la reposición, y se contabilizan explícitamente.
- **Orden de prueba (2–3 jugadores):** 1) poner el Puesto, fijar precios, reponer, quitar, recoger. 2) Ana vende perlas; Bea compra; Ana vacía la Caja; Ana sale, Bea compra, Ana vuelve y ve el aviso. 3) Menú → Puestos. 4) Cambiar con A: Ver, ofrecer, dos Vale; alejarse a mitad; tres "No". 5) Con una partida tras el rescate del Tragón: esperar al amanecer, A junto al Buhonero, hacer tratos hasta el tope. 6) Ana pone un Encargo "Busco 3 cuarzo, pago 12 piedra", apartar paga, sale; Bea entrega y cobra. 7) Puesto en la Montaña vendiendo cuarzo (tras haber picado cuarzo): al amanecer, +1.

## Tiendas · T6-A — Reglas y el Puesto — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-tiendas-T6-A-reglas-puesto.md` (2e216a0).
- Commits: fdd90f0 (T1 reglas puras en `src/shared/shop.ts`: `STALL`, `newStall`, `setShelf`, `restock`, `takeShelf`, `pickUp`, `stallGoods`, `canPlaceStall`; nombres `stall`/`till` en `names.ts`), 298ef37 (T2 servidor, protocolo v59), 2b575e2 (T3 cliente: malla, Menú, A y panel del dueño).
- Tests: npm test 1062 (antes 1043), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 59**. Campo guardado nuevo, opcional: `SavedWorld.stalls`. Las partidas viejas cargan sin Puestos.
- Cómo funciona:
  - **Menú → "Poner puesto (8 madera, 4 piedra)"** (solo si no tienes uno): sale 2,5 m delante. Uno por jugador, a ≥15 m de otro, en tierra seca dentro del mapa (en cualquier bioma, no solo el bosque).
  - **A junto a tu Puesto** (≤4 m) abre el panel: 4 estantes "Vendo N X por M Y · quedan S"; botones de material (rotan entre los 7), − / +, **Reponer +N** (una tanda sale de la mochila), **Quitar** (todo el estante vuelve) y **Recoger puesto** (estantes, Caja y el coste completo vuelven). A junto al de otro: "Puesto de Ana." (comprar llega en T6-B).
  - El Puesto no es una `Structure`: sin vida, los asedios no lo ven. Colisiona con jugadores.
- **Conservación:** cada operación comprueba todo y luego aplica todo, sin mutar; si falla, no cambia nada. Tests de propiedad: 500 secuencias aleatorias de 40 operaciones puras y 40 × 60 mensajes por `handle()` (dueño y extraño, válidos e inválidos) mantienen mochilas + tumbas + Puestos iguales; solo construir (−8 madera −4 piedra) y recoger (+coste) mueven la cuenta.
- Decidido por Claude — revisar:
  - Mensaje propio `stallPlace` en vez de un `StructureKind` nuevo (el Puesto no es estructura; evita tocar todas las tablas por tipo).
  - No se puede cambiar el material de un estante con género ("Quita el género primero."); el precio sí, gratis.
  - Reponer = una tanda (N unidades) por toque; topes 60 por estante y 120 por Puesto.
  - Los eventos `stall` van a todos (3–4 jugadores; el filtro de 60 m del spec no compensa aún).
  - Estante por defecto: "Vendo 1 madera por 1 bayas". Etiquetas en plural fijo ("1 perlas"): seco, a pulir en #7.
  - Cambio de regla con tests adaptados (ninguno borrado): versión 58 → 59 en los tests de versión.
- Rendimiento móvil: 1 malla fusionada (mostrador, 2 postes, toldo), 1 material, 1 draw call por Puesto. Panel en HTML. Cero luces, cero pastillas.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: poner el Puesto con 8 madera y 4 piedra; A → subir precios, reponer, quitar; recoger y ver que todo vuelve; intentar un segundo Puesto; que un asedio lo ignore. Constantes: `STALL` en `src/shared/shop.ts`; malla en `src/client/scene/stalls.ts`.
- Lo siguiente: T6-B (comprar, Caja, registro, mapa, ritmo; v60).

## Tiendas · T6-B — Comprar, Caja y registro — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-tiendas-T6-B-comprar-caja.md` (77baddc).
- Commits: 1406ea5 (T1 reglas puras: `buy`, `canBuy`, `collectTill`, `tillTotal`, `LOG_MAX` en `src/shared/shop.ts`), a0fed22 (T2 servidor, protocolo v60), 912e100 (T3 cliente: panel de compra, Caja y registro en el panel del dueño, lista "Puestos" en el Menú).
- Tests: npm test 1077 (antes 1062), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 60**. Campo guardado nuevo, opcional: `SavedPlayer.soldSince`. Mensajes nuevos: `buy {stall, shelf}`, `stallTill`. Las partidas viejas cargan igual.
- Cómo funciona:
  - **A junto al Puesto de otro** (≤4 m) abre "Puesto de Ana": los estantes con género, "1 perlas por 6 bayas · quedan 3" y **Comprar** (una tanda). Gris con el motivo: "No te llega: bayas.", "No queda.", "Caja llena.".
  - La paga cae en la **Caja** (tope 200: una venta que la pasaría se rechaza entera). El dueño ve "Caja: 12 bayas", **Vaciar caja** y las **10 últimas ventas** ("Bea · 1 perlas · 6 bayas · día 14").
  - Dueño conectado: "Bea compró 1 perlas en tu puesto." Dueño fuera: se cuenta y al conectar le sale "Tu puesto vendió N veces desde que te fuiste.".
  - **Menú → Puestos** (si hay alguno): "Puesto de Ana · vende perlas, madera · 40 m al norte".
  - Ritmo: 1 compra cada 0,5 s por jugador (el resto se ignora).
- **Conservación:** test puro de 300 × 60 operaciones con el dueño y dos compradores, y 30 × 80 mensajes por `handle()` con Ana, Bea y Cai (comprar, vaciar, reponer, cambiar precio, quitar; ids malos incluidos): mochilas + tumbas + Puestos no cambian, la Caja nunca pasa de 200, ninguna mochila baja de 0.
- Decidido por Claude — revisar:
  - El dueño no puede comprar en su propio Puesto ("Es tu puesto.").
  - El aviso al conectar es un toast, no una entrada del Libro (el registro completo está en el panel).
  - No hay mapa en el Menú: "puntos en el mapa" es una lista con dueño, lo que vende, distancia y rumbo (−z = norte).
  - El límite de ritmo usa el tiempo de la simulación y no se guarda.
  - Cambio de regla con tests adaptados (ninguno borrado): versión 59 → 60 en los tests de versión.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: con dos jugadores, Ana pone perlas a la venta; Bea compra hasta vaciar el estante; Ana vacía la Caja; Ana sale, Bea compra, Ana entra y ve el aviso; Menú → Puestos.
- Lo siguiente: T6-C (trueque directo; v61).

## Tiendas · T6-C — Trueque directo — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-tiendas-T6-C-trueque.md` (c79692b).
- Commits: bb9a206 (T1 reglas puras: `TRADE`, `linesOk`, `offerInv`, `trade` en `src/shared/shop.ts`), 3669170 (T2 servidor, protocolo v61, guardado inmediato), 35e35bf (T3 cliente: Cambiar con A y ventana de dos columnas).
- Tests: npm test 1091 (antes 1077), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 61**. Sin campos guardados nuevos: los trueques abiertos viven solo en memoria. Mensajes nuevos: `tradeAsk {to}`, `tradeAnswer {yes}`, `tradeOffer {lines}`, `tradeOk`, `tradeCancel`; servidor: `trade {tr}`. Las partidas viejas cargan igual.
- Cómo funciona:
  - **A junto a otro jugador** (≤4 m) cuando no hay nada más que hacer con A (cosechar, montar, Puesto… ganan) → le pregunta. El otro ve "Ana quiere cambiar." con **Ver** / **No**.
  - Ventana: "Tú das" / "Bea da". Hasta **3 líneas** (materiales distintos, 1–99), con − / material / + / Quitar / Añadir. **Vale**. Cualquier cambio quita los dos Vale. Regalar = poner algo solo en un lado.
  - Con los dos Vale el servidor vuelve a comprobarlo todo (mochilas, ≤6 m, vivos, fuera de mazmorras) y mueve todo de golpe, o cancela sin tocar nada ("A Ana no le llega: perlas."). Tras un trueque la sala **guarda la fila en el acto** (`takeSave()` → `persist()`).
  - Se cancela solo: >6 m, muerte, desconexión, mazmorra, 60 s, o Cancelar.
  - Ritmo: 1 petición cada 5 s; tras 3 "No" seguidos del mismo, 60 s sin poder preguntarle ("Bea no quiere cambiar ahora.").
- **Conservación:** test puro de 500 pares aleatorios, y 40 × 120 pasos por `handle()` con 2–3 jugadores (pedir, contestar, ofrecer, Vale, cancelar, moverse, irse, volver, morir, saltos de tiempo): mochilas + tumbas + Puestos no cambian; cada mochila o no cambia o cambia exactamente por un trueque entero; nada baja de 0. El decodificador solo acepta los 7 materiales (probado con `rank`, `hat`…).
- Decidido por Claude — revisar:
  - Los 60 s cuentan desde la petición, ventana incluida.
  - Materiales distintos por lado y 1–99 por línea.
  - La oferta se comprueba al ponerla ("No tienes tanto.") y otra vez al cerrar.
  - Trueques solo en memoria: un reinicio de la sala los cancela (nada se movió aún).
  - El contador de "No" es por pareja y solo en memoria; se reinicia con un "Ver" o tras la espera.
  - Solo impiden cambiar estar muerto, fuera o en mazmorra; montado se puede.
  - `NAMES.trade = 'Cambiar'` añadido a `names.ts` (el spec lo pedía; faltaba).
  - Los tests puros van en `src/shared/trade.test.ts` (no en `shop.test.ts`).
  - Cambio de regla con tests adaptados (ninguno borrado): versión 60 → 61 en los tests de versión.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: dos jugadores juntos; A → pregunta; Ver; poner perlas contra bayas; cambiar una línea y ver que se quitan los Vale; los dos Vale; alejarse a mitad; decir No tres veces.
- Lo siguiente: T6-D (Buhonero, biomas y Encargos; v62).

## Tiendas · T6-D — Buhonero, biomas y Encargos — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-tiendas-T6-D-buhonero.md` (5e414ca).
- Commits: 41f5a1a (T1 reglas puras: `MERCHANT`, `RARE`, `merchantDeal`, `biomeItem`, `biomeRestock`, `canDeliver`, `deliver`, `setShelf` con modo; `NAMES.merchant`, `NAMES.order`), 357dd19 (T2 servidor, protocolo v62), f3b0ab0 (T3 cliente: Buhonero de papel, su panel, Busco/Entregar en los paneles del Puesto).
- Tests: npm test 1111 (antes 1091), test:workers 12, check + build verdes. **PROTOCOL_VERSION = 62**. Campos guardados nuevos, opcionales: `SavedWorld.merchant`, `SavedPlayer.found`, `SavedPlayer.merchant {day, used}`. Mensajes nuevos: `deal {id}`, `deliver {stall, shelf}`; `stallSet` acepta `mode` opcional. Snapshot: `merchant {x,z} | null`, `self.deals`. Las partidas viejas cargan igual.
- Cómo funciona:
  - **El Buhonero** aparece el amanecer siguiente a `invasion2 === 'rescued'` ("Con el Tragón volvió alguien…"), 6 m al este del Corazón, y se queda. A a ≤4 m (después del Puesto, antes de cosechar y de Cambiar) abre su tabla: compra todo (5 madera → 1 baya, 1 perla → 4 bayas, 1 espina → 6 bayas…), vende madera y piedra por bayas (6 → 5) y bayas por piedra (10 → 5). **20 tratos por jugador y día de juego** ("Te quedan N tratos hoy."). Nunca vende perlas, ámbar, cuarzo ni espinas. Ningún ciclo con él gana nada (probado).
  - **Reposición por bioma:** al amanecer, un Puesto en la Costa (perla), Pantano (ámbar), Montaña (cuarzo), Ceniza/Tierras Corruptas (espina) o Bosque (bayas) con un estante Vendo de ese material recibe +1 (el estante no pasa de 10 así). Lo raro solo si el dueño lo **recogió** alguna vez (`found`).
  - **Encargos:** en el panel del dueño, el botón Vendo/Busco (solo con el estante vacío; 2 como mucho). "Busco 3 cuarzo, pago 12 piedra": **Apartar +12** saca la paga de la mochila. Quien llega ve "Busca 3 cuarzo, paga 12 piedra · 1 veces" y **Entregar**: cobra al momento, el cuarzo va a la Caja, aunque el dueño esté fuera (cuenta en "vendió N veces"). Menú → Puestos dice "busca cuarzo".
- **Conservación:** test puro de 500 × 60 operaciones (Vendo/Busco, reponer, quitar, comprar, entregar, vaciar, tratos, reposición) y 30 × 100 pasos por `handle()` con Ana, Bea y Cai (más moverse, irse, volver, amaneceres): mochilas + tumbas + Puestos = inicio + libro de tratos del Buhonero + reposiciones; nada baja de 0; nunca más de 2 Busco.
- Decidido por Claude — revisar:
  - La paga del Encargo vive en el `stock` del estante (unidades del material con que se paga); se quitó el campo `escrow` que no se usaba. Así los topes 60/120, Apartar y Quitar funcionan igual y nada se cuenta dos veces.
  - Vendo/Busco solo se cambia con el estante vacío ("Quita el género primero."); tercer Busco: "Solo dos encargos.".
  - Entregar comparte el límite de 0,5 s con Comprar; el dueño no entrega en su Puesto; se apunta en el registro como una venta.
  - Los tratos del Buhonero también usan ese límite de 0,5 s.
  - Buhonero = papel del Tragón con tinte cálido (placeholder para #2). Sin Corazón no está.
  - Reposición: 1 unidad por Puesto y amanecer, en el primer estante que encaje. Bosque → bayas sin `found`. La Costa es todo lo que queda al sur del borde del bosque fuera del Pantano.
  - `found` se marca en los puntos de recogida (cosechar, cofres, ámbar, cuarzo, orbes, espinas de bestias, La Flecha, tenientes); comprar, cambiar, tumbas y el Buhonero no cuentan. Un jugador nuevo sin nada raro no guarda el campo.
  - Cambio de regla con tests adaptados (ninguno borrado): versión 61 → 62 en los tests de versión.
- Rendimiento móvil: el Buhonero es un actor de papel más; panel en HTML. Cero luces, cero pastillas.
- Verificado en navegador: no (solo tests + check + build).
- Bloqueos: ninguno.
- Qué probar: ver "Tiendas — resumen", pasos 5–7. Constantes: `MERCHANT`, `RESTOCK_MAX`, `STALL.wantMax` en `src/shared/shop.ts`.
- Lo siguiente: #2 Mundo y visuales → #7 Pulido.

## Visuales — resumen (LEER PRIMERO)
#2 Mundo y visuales está hecho en 5 planes (spec `docs/superpowers/specs/2026-09-27-visuales-design.md`; planes `docs/superpowers/plans/2026-09-27-visuales-V2-*.md`). **Nada de protocolo, servidor, colisiones ni balance cambió: PROTOCOL_VERSION sigue en 62.** Todo procedural/shader, cero descargas.
- **V2-A** arnés `npm run perf` (llamadas/triángulos por parada y gama), `?fps=1`, prueba de FPS en la primera partida y bajada automática de gama.
- **V2-B** recorte por cercanía (−80 % triángulos), `BiomeLook` por bioma/hora, cúpula con sol/nubes/estrellas, noches oscuras, niebla por altura, puntos de brillo sin luces, discos de sombra en baja.
- **V2-C** hierba por trozos con viento en todos los biomas, copas/toldos al viento, suelos por bioma, zonas marchitas en el shader, la ola que sana y las Tierras purificadas.
- **V2-D** agua (profundidad, espuma, aguas bravas, olas en media/alta, bajo el agua, cáusticas, Lago Negro que se limpia) y vida ambiente (pájaros, luciérnagas, cangrejos, peces, partículas).
- **V2-E** ciervo/pez/rana/ballena low-poly (1 llamada cada uno, huesos en el shader), color por tipo de enemigo + marca de carga, poses de rodar/bloquear/arco/trepar/planear/deslizar, papel iluminado con borde, borde de luna en actores de noche, modelos "suelta y listo".
- **Decidido por Claude — revisar (lo más gordo):** recorte por cercanía en vez de regiones 4×4; hierba = una malla por trozo con alturas horneadas (sin texturas en el vértice); profundidad del agua en un mapa leído en el fragmento; noches muy oscuras (hemisférica 0,08) compensadas con brillos y el borde de luna; las poses son offsets de hueso resueltos numéricamente sobre el robot (se ven "de robot", aceptables, no bonitas); los enemigos zorro se recolorean (textura a gris × color del tipo); el Corazón y los muros no llevan borde de luna (solo actores); los papeles nunca bajan de 0,35 de luz.
- **Cifras finales** (llamadas / triángulos, de día; noche igual o menos):

| Parada | Baja | Media | Alta |
|---|---|---|---|
| Bosque | 61 / 186 k | 142 / 437 k | 187 / 846 k |
| Costa | 59 / 76 k | 95 / 126 k | 97 / 198 k |
| Bajo el agua | 53 / 70 k | 75 / 118 k | 77 / 188 k |
| Pantano | 53 / 89 k | 82 / 196 k | 87 / 402 k |
| Montañas | 71 / 105 k | 95 / 166 k | 103 / 252 k |
| Tierras | 50 / 22 k | 68 / 35 k | 68 / 45 k |
| Purificado | 54 / 56 k | 76 / 116 k | 84 / 235 k |
| Lago Negro / limpio | 47 / 18 k · 52 / 55 k | 65 / 28 k · 75 / 122 k | 66 / 36 k · 83 / 253 k |
| Mazmorra | 89 / 67 k | 112 / 116 k | 130 / 225 k |
| Presupuesto §3 | 120 / 250 k | 180 / 500 k | 260 / 1 200 k |

  Antes de #2 la baja iba a ~530 k triángulos en todas partes (el doble del presupuesto); ahora todo cabe. Lo más justo: bosque en media (437 k; mando: `grassPerChunk`).
- **Qué mirar en teléfonos reales (Gabriel, con `?fps=1`):** fps en Baja en el bosque, la Costa y el Pantano (1 min cada uno); ¿salta "Bajé los gráficos."?; un ciclo día/noche entero (¿se leen lobos, el Corazón y el robot de noche?); hierba que no "salte" al caminar; bucear; limpiar una zona y ver la ola; montar el ciervo, el pez y la rana; rodar, bloquear y planear cerca de un compañero; que el teléfono no se caliente en 10 min.
- **Modelos para soltar:** la lista está en el spec §9 y en `public/models/CREDITS.md` (`deer/fish/frog/whale/wolf/brute.glb`); sin archivo → procedural/zorro.

## Visuales · V2-A — Arnés y gamas — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-visuales-V2-A-arnes-gamas.md` (d184d0f).
- Commits: 761f42e (T1 puro: campos nuevos de `TierSettings`, `probeVerdict`, `FpsGuard`, `lowerTier`), e73123f (T2 cliente: `?fps=1`, prueba de FPS, bajada automática, gancho `?perf=1`), 0fb394d (T3 arnés `npm run perf` + `scripts/perf/baseline.json`).
- Tests: npm test 1126 (antes 1111), test:workers 12, check + build verdes. **PROTOCOL_VERSION sigue en 62.** Sin cambio visual ni de juego.
- Cómo funciona:
  - **`npm run perf`** (no entra en `npm test`; ~16 min las 3 gamas): construye con `--mode perf` en `scratch/perf/dist`, arranca `wrangler dev` (puerto 8799, estado desechable), crea el mundo `perf` con semilla 42, y en Chromium headless recorre 7 paradas × mediodía/medianoche × 3 gamas leyendo `renderer.info` tras 30 fotogramas. Compara con la base: falla si algo sube >10 % o si una lectura pasa el presupuesto de §3 **y además** empeora. `-- --update` reescribe la base, `-- --tier low` una gama, `-- --shots` PNG en `scratch/perf/shots/`.
  - **`?fps=1`**: contador arriba a la izquierda ("58 fps · Media", "· ×0,85" si bajó la resolución). También en producción.
  - **Prueba de FPS** (solo la primera partida, sin gama guardada): 4 s tras entrar, sin los 20 primeros fotogramas; > 33 ms en media/alta → baja un escalón y lo guarda; < 12 ms en baja con táctil → "Esto va sobrado: prueba gráficos Media en el Menú." una vez. Nunca sube sola.
  - **Bajada en juego:** media de 10 s bajo 24 fps → resolución ×0,85 (hasta 0,7 en baja; un paso en media/alta), luego "Bajé los gráficos." y una gama menos. Un cambio por minuto como mucho. Se aplica al momento resolución, distancia y sombras; hierba y detalle del terreno al volver a entrar.
  - `window.__perf` solo existe en builds de desarrollo y `--mode perf` (módulo `perf-hook.ts` cargado aparte; el build de producción no lo contiene, comprobado).
- **Cifras de hoy** (llamadas / triángulos; día = noche en todas: la noche no añade nada hoy):

| Parada | Baja | Media | Alta |
|---|---|---|---|
| Bosque | 67 / 529 k | 150 / 1 041 k | 189 / 1 119 k |
| Costa | 67 / 533 k | 109 / 1 043 k | 109 / 1 123 k |
| Bajo el agua | 62 / 533 k | 94 / 1 043 k | 94 / 1 123 k |
| Pantano | 51 / 535 k | 77 / 1 045 k | 77 / 1 125 k |
| Montañas | 68 / 548 k | 99 / 1 064 k | 107 / 1 152 k |
| Tierras | 54 / 486 k | 79 / 969 k | 79 / 1 015 k |
| Mazmorra | 92 / 530 k | 118 / 1 040 k | 134 / 1 118 k |
| Presupuesto §3 | 120 / 250 k | 180 / 500 k | 260 / 1 200 k |

  - **Llamadas: dentro en todo. Triángulos: baja y media ya pasan del doble** (≈ 530 k y ≈ 1 M en todas partes, casi igual en todos los biomas → es algo que se dibuja entero siempre: la hierba de 2 500/6 000 instancias por todo el mapa y los `InstancedMesh` de árboles sin recorte, spec §5.3). Lo baja V2 de hierba/vegetación. Alta cabe (Montañas 1,15 M, justo).
  - Montañas: 600 puntos (la nieve de `weather.ts`). Programas 24–41, texturas 8 en todas.
- Decidido por Claude — revisar:
  - Playwright como devDependency fija **`playwright-core@1.56.1`** (su Chromium 1194 es el de `/opt/pw-browsers`) en vez de `npm i playwright` en `scratch/perf` como decía el spec: una versión en el lockfile y cero descargas (`playwright-core` no baja navegadores). Chromium: `PERF_CHROMIUM` → `PLAYWRIGHT_BROWSERS_PATH` → `/opt/pw-browsers`; sin ninguno dice "Sin Chromium…" y sale con 0.
  - Las cifras de hoy son la base aunque ya pasen el presupuesto (spec §3: el plan que toque ese bioma lo baja); por eso "pasa el presupuesto" solo falla si además empeora.
  - Paradas: sin "hogar" ni "Tierras purificadas simuladas" (no hay look purificado que simular; lo añade su plan). Cámara a 960×540, ratio 1.
  - Campos nuevos (`grassRadius`, `grassPerChunk`, `waterGrid`, `clouds`, `stars`, `heightFog`, `glowPoints`, `ambient` = luciérnagas, `particles`, `triplanar`, `shadowRadius`) declarados con los números de §3; nadie los lee aún. `grassPerChunk` 2 100/2 700/3 600 ≈ 8 k/30 k/90 k briznas en vista.
  - Si la prueba no baja nada, guarda la gama adivinada para no volver a probar. Con el almacenamiento bloqueado no prueba.
  - La bajada de gama en juego no reconstruye el mundo (sería un tirón): aplica lo barato ya y el resto al volver a entrar.
- Verificado en navegador: sí, el arnés entra al mundo en Chromium headless y hace las 42 lecturas (capturas revisadas: el robot en cada parada). La prueba de FPS y la bajada automática no se vieron en vivo (SwiftShader va a ~2 fps y el arnés las apaga); tienen tests puros.
- Bloqueos: ninguno.
- Qué probar (Gabriel, teléfono): entrar con `?fps=1`; en un teléfono nuevo (sin gama guardada) mirar si a los 4 s sale "Bajé los gráficos."; jugar 1 min en el bosque y apuntar los fps de Baja; en el Menú probar Media.
- Lo siguiente: V2-B (según el mapa del spec §12).

## Visuales · V2-B — Recorte por cercanía, cielo, luz y niebla — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-visuales-V2-B-cielo-luz.md` (16a0634).
- Commits: 3be3d67 (T1 rendimiento: `NearInstances`, árboles/arbustos fusionados, arnés `--stop`/`--top`, base nueva), edd17cb (T2 puro: `BiomeLook` en `scene/looks.ts`), 23d41e0 (T3 cúpula `scene/sky-dome.ts` + `DayLight` con el look, noches oscuras), e776f87 (T4 `scene/patches.ts`: niebla por altura y puntos de brillo), 216acd3 (T5 discos de sombra en baja), y el de cierre (base final + este texto).
- Tests: npm test 1146 (antes 1126), test:workers 12, check + build verdes. **PROTOCOL_VERSION sigue en 62.** Nada nuevo en red ni guardado.
- **El tragón de triángulos era `ResourceMeshes`** (`--top` en baja: árboles 147 k + 84 k + 84 k, arbustos 78 k + 39 k, rocas 17 k, hierba 15 k; todo `frustumCulled = false` por el mapa entero). Arreglo: cada `InstancedMesh` se rellena solo con lo que está a `drawDistance × 0,9` de la cámara y no más de 20 m detrás, y se rehace solo tras moverse 6 m o girar 0,3 rad. Más allá de `drawDistance × 0,8` la niebla ya es opaca: no se pierde nada visible (capturas: los árboles siguen hasta la niebla). Tronco + 2 copas y arbusto + bayas van fusionados con color por vértice (6 → 3 mallas, −3 llamadas). La hierba usa lo mismo con radio 70 m.
- **Cifras antes → después** (llamadas / triángulos, de día; la noche da lo mismo):

| Parada | Baja | Media | Alta |
|---|---|---|---|
| Bosque | 67 / 529 k → 66 / 113 k | 150 / 1 041 k → 145 / 314 k | 189 / 1 119 k → 184 / 568 k |
| Costa | 67 / 533 k → 62 / 69 k | 109 / 1 043 k → 97 / 109 k | 109 / 1 123 k → 97 / 153 k |
| Bajo el agua | 62 / 533 k → 57 / 69 k | 94 / 1 043 k → 82 / 109 k | 94 / 1 123 k → 82 / 153 k |
| Pantano | 51 / 535 k → 47 / 71 k | 77 / 1 045 k → 71 / 135 k | 77 / 1 125 k → 71 / 258 k |
| Montañas | 68 / 548 k → 63 / 84 k | 99 / 1 064 k → 87 / 131 k | 107 / 1 152 k → 95 / 182 k |
| Tierras | 54 / 486 k → 49 / 22 k | 79 / 969 k → 67 / 35 k | 79 / 1 015 k → 67 / 45 k |
| Mazmorra | 92 / 530 k → 87 / 67 k | 118 / 1 040 k → 110 / 108 k | 134 / 1 118 k → 128 / 193 k |
| Presupuesto §3 | 120 / 250 k | 180 / 500 k | 260 / 1 200 k |

  - **Todo dentro del presupuesto en las 3 gamas.** La cúpula suma 1 llamada y ~350 triángulos; las nubes 1 textura (media/alta). Programas 28–34 (baja) y 40–45 (media/alta): la variante de niebla/brillo de cada material Lambert.
- Cómo funciona:
  - **`BiomeLook`** (`scene/looks.ts`): por bioma (bosque, costa, pantano, montañas, tierras) 4 claves (noche 0, alba 0,25, día 0,5, ocaso 0,75) con cenit, horizonte, niebla, sol (color, fuerza), hemisférica (cielo, suelo, fuerza) y luna. Se mezcla con 5 muestras a 15 m (≈ 30 m de transición) y se suaviza en 1 s. Retocar colores = tocar la tabla.
  - **Cúpula** (`scene/sky-dome.ts`): una esfera que sigue a la cámara, degradado cenit/horizonte, disco de sol con halo (más ancho y cálido al ocaso), luna, **nubes** (media: 1 capa 256², alta: 2 capas 512²; ruido FBM hecho una vez, se desplaza con el tiempo), **estrellas** titilantes en alta.
  - **Noches oscuras:** cenit 0x05080f, hemisférica 0,08, luna 0,35. Asedio, tormenta y Pantano siguen tiñendo encima.
  - **Niebla por altura** (media/alta): la lineal de siempre, más fina en alto y más cálida mirando al sol; más allá de `far` sigue siendo opaca (sin saltos al borde del recorte).
  - **Puntos de brillo** (`scene/patches.ts`, único sitio con `onBeforeCompile`): las 4 (baja) u 8 fuentes más cercanas — fogatas encendidas, fogatas/hogueras construidas, el Corazón — iluminan en el shader de todo material Lambert (`(1 − d/r)²`), más fuerte de noche. Cero luces nuevas.
  - **Discos de sombra** bajo jugadores, lobos y brutos en baja (una geometría y un material compartidos). Los de papel ya lo tenían.
- Decidido por Claude — revisar:
  - Recorte por cercanía en vez de las 4×4 regiones del spec §5.3: baja llamadas en vez de subirlas y quita ~80 % de triángulos (el umbral del spec era 30 %).
  - Radio de la hierba 70 m (sus matas de 0,9 m son puntos más allá). La hierba de verdad (trozos, viento) sigue siendo V2-C.
  - Biomas del look = los mismos que `biomeItem` (Costa = al sur del borde). Sin look Purificado (V2-C).
  - El parche se aplica barriendo la escena cada 2 s a todo `MeshLambertMaterial` (opt-out con `userData.noWorld`); los `MeshBasic` (llamas, cuarzo) ya brillan solos.
  - La cúpula no pasa por el tone mapping (así el cielo de día se parece al fondo de antes).
  - El arnés ahora también apunta los errores de consola (shaders que no compilan). **Ojo:** en una pasada larga el jugador de pruebas puede morir de noche en la 2.ª/3.ª gama y cambian las texturas (tumba, dibujos); la base final se tomó con media y alta por separado (mismas llamadas/triángulos, 11 texturas).
- Verificado en navegador: sí, capturas del arnés (SwiftShader): bosque de día igual que antes con los árboles hasta la niebla; Costa de día con nubes y degradado; Montañas con valles en niebla; Tierras moradas/granate; Pantano verde grisáceo con nubes; de noche el bosque es casi negro con estrellas en alta y un brillo cálido en el suelo junto a los fuegos de la mazmorra. **De noche el robot en la Costa se ve como silueta negra**: se lee, pero muy oscuro (el borde de luna para actores del spec §4 queda para V2-E).
- Bloqueos: ninguno.
- Qué probar (Gabriel, teléfono, `?fps=1`): fps en Baja en el bosque (debería subir: ~5× menos triángulos); un ciclo día/noche entero; de noche ¿se ven bien los lobos y el Corazón?; encender una fogata de noche y ver el suelo iluminado; ir del bosque a la Costa y al Pantano mirando que el cielo cambie sin saltos.
- Lo siguiente: V2-C (terreno, hierba y viento).

## Visuales · V2-C — Hierba, viento, suelo y la ola que sana — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-visuales-V2-C-hierba-viento.md` (60d2331).
- Commits: c65b817 (T1 arnés: import seguro, el jugador de pruebas ya no muere), ba15054 (T2 puro: `scene/ground.ts` hierba por bioma, trozos, nieve/arena mojada/ruido; `scene/heal.ts` olas de sanación), 4498a78 (T3 `scene/grass.ts` hierba por trozos con viento; copas, arbustos, pinos y toldos al viento), 05e0ed1 (T4 colores de suelo; zonas marchitas en el shader y la ola), 75f43e7 (T5 las Tierras purificadas), y el de cierre (base nueva + este texto).
- Tests: npm test 1164 (antes 1146), test:workers 12, check + build verdes. **PROTOCOL_VERSION sigue en 62.** Nada nuevo en red ni guardado; alturas y colisiones iguales (solo colores y shaders).
- **Arnés arreglado:** antes de cada gama (y cada 100 s) exporta el mundo, lo pone a media mañana con todos vivos y llenos, y lo importa (endpoint admin que ya existía; la página se reconecta sola y el arnés espera a `__perf.online()`). Pasada entera de 3 gamas estable: texturas 8 (baja) / 11 (media, alta) en todas las paradas. Nada cambia en producción.
- **Cifras antes → después** (llamadas / triángulos; día = noche):

| Parada | Baja | Media | Alta |
|---|---|---|---|
| Bosque | 66 / 113 k → 73 / 185 k | 145 / 314 k → 154 / 429 k | 184 / 568 k → 199 / 813 k |
| Costa | 62 / 69 k → 64 / 76 k | 97 / 109 k → 99 / 118 k | 97 / 153 k → 101 / 165 k |
| Bajo el agua | 57 / 69 k → 58 / 70 k | 82 / 109 k → 85 / 109 k | 82 / 153 k → 86 / 155 k |
| Pantano | 47 / 71 k → 51 / 89 k | 71 / 135 k → 80 / 188 k | 71 / 258 k → 85 / 369 k |
| Montañas | 63 / 84 k → 70 / 105 k | 87 / 131 k → 94 / 158 k | 95 / 182 k → 102 / 219 k |
| Tierras | 49 / 22 k → 49 / 22 k | 67 / 35 k → 67 / 35 k | 67 / 45 k → 67 / 45 k |
| Purificado (nueva) | — → 53 / 56 k | — → 75 / 116 k | — → 83 / 235 k |
| Mazmorra | 87 / 67 k → 87 / 67 k | 110 / 108 k → 110 / 108 k | 128 / 193 k → 128 / 193 k |
| Presupuesto §3 | 120 / 250 k | 180 / 500 k | 260 / 1 200 k |

  - **Todo dentro del presupuesto.** Lo más justo: bosque en media (429 k de 500 k). Si hay que bajar, `grassPerChunk` de media (2 700) es el mando. Programas +3/+4 (hierba, balanceo, suelo). Base actualizada con esta pasada.
- Cómo funciona:
  - **Hierba** (`scene/grass.ts`): trozos de 32 m sembrados por posición (siempre los mismos), una malla por trozo con la altura del suelo ya puesta (sin texturas en el vértice), un solo material. Se ven los trozos dentro de `grassRadius` (35/60/90 m) y se desvanecen en el último 30 %. Brizna = 7 vértices / 5 triángulos, color raíz→punta por bioma: bosque verde (más rala bajo copas densas), Costa pasto de duna pálido (no en la arena mojada), Pantano juncos oscuros también en el agua poco honda, Montañas corta hasta ~50 m (nada en la nieve, el tobogán, los Peldaños ni pendientes > 35°), Tierras nada (purificadas: pradera pálida con 8 % de flores blancas). Iluminada por arriba en las dos caras.
  - **Viento** (`scene/patches.ts`, un solo juego de uniforms): baja 1 onda; media/alta 2 ondas + ráfagas; alta además la hierba se aparta de hasta 4 jugadores. Más fuerte con lluvia/tormenta en las Montañas. Las copas de los árboles (sobre 4,5 m), los arbustos, los pinos y el toldo de los Puestos (aletea por delante) usan el mismo viento.
  - **Suelo:** nieve también por altura (> 55 m sobre el agua) y pendiente (< 35°), arena mojada oscura en la orilla, manchas de barro negro en la ciénaga, tierra pisada bajo las copas más densas, ±6 % de ruido por vértice. Todo en el color de vértice (coste cero en el píxel).
  - **Zonas marchitas en el shader:** `zones[22]` (x, z, radio, frente) que leen el suelo (morado como antes, mismo decaimiento de `taintAt`), la hierba (ceniza y al 30 % de alto) y las copas (gris violeta). Ahora se ven también en Montañas y Tierras (antes solo bosque/Costa/Pantano). Se quitó `tintTerrain` (recolor en CPU).
  - **La ola que sana** (`scene/heal.ts`): una zona que se limpia mientras miras sana en 20 s como un frente desde su raíz, con una franja clara en el suelo y puntas blancas (flores) en la hierba del frente. Lo que ya estaba limpio al entrar, limpio. Al caer El Marchito todas las zonas que quedaban hacen la ola a la vez y las Tierras pasan al **look Purificado** en 60 s desde la Torre hacia fuera: suelo de pradera con vetas doradas donde había pizarra/grietas, crece su hierba, cielo y luz de `PURIFIED` en `looks.ts`. Si entras después del final, ya está purificado.
- Decidido por Claude — revisar:
  - Hierba = una malla por trozo con alturas horneadas en CPU, no un `InstancedMesh` de trozos leyendo una textura de alturas (spec §5.3): sin lectura de texturas en el vértice (riesgo de móviles viejos, §13), recorte por trozo gratis y alturas exactas. Cuesta 1 llamada por trozo visible (+7 baja, +9 media, +15 alta en el bosque). Memoria: ~0,5 MB por trozo en baja, ~0,9 MB en alta; caché de los visibles + 16.
  - Las Tierras no tienen hierba hasta purificarse (no se dibujan briznas invisibles). La hierba vieja de conos (`buildGrass`) se fue; `TierSettings.grass` queda sin uso.
  - Nieve: se suma la regla por altura/pendiente a la de profundidad que ya había (> 130 m). Senderos: "tierra pisada bajo copas densas" (no hay caminos de verdad en el mapa).
  - Las espinas negras de las Tierras siguen igual tras purificar; el Lago Negro limpio espera al shader de agua (V2-D).
  - Arnés: parada nueva `purificado` (las Tierras con `purify = 1`, solo en el arnés) y `--ola` (captura una zona del bosque sanando a los 0/5/10/20 s con una limpieza solo en el cliente).
- Verificado en navegador: sí, capturas del arnés (SwiftShader): bosque con hierba densa verde-amarilla y sombras en alta; Costa con pasto de duna pálido y ralo; Pantano con juncos oscuros en el agua; Montañas con hierba corta y nieve en la cima; bosque de noche oscuro con la hierba apenas visible; zona marchita con suelo morado y hierba ceniza baja, y a los 10 s ya verde tras la ola (la franja clara se ve a los 0–5 s; la raíz seca sigue porque la limpieza fue solo del cliente); Tierras moradas → purificadas: pradera verde con hierba pálida y cielo claro. El viento no se puede ver en una captura; no se probó en movimiento.
- Bloqueos: ninguno.
- Qué probar (Gabriel, teléfono, `?fps=1`): fps en Baja en el bosque (hay +70 k triángulos de hierba); caminar y mirar que la hierba no "salte" al cargar trozos (se construyen 2 por fotograma); limpiar una zona con Enredadera y ver la ola; ¿la hierba tapa bayas o avisos del suelo?; con lluvia en las Montañas, ¿se mueve más?
- Lo siguiente: V2-D (agua y vida ambiente).

## Visuales · V2-D — Agua y vida ambiente — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-visuales-V2-D-agua-vida.md` (6676d22).
- Commits: 9db0058 (T1 puro: `scene/water-data.ts` mapa de profundidad, olas, bajo el agua; `scene/life.ts` cantidades por gama, dónde/cuándo, bandadas, cangrejos), c5989b5 (T2 `scene/water.ts` shader de agua), a3a4b74 (T3 bajo el agua, cáusticas en alta, Lago Negro, paradas `lago`/`lago-limpio`), 39fff4c (T4 `scene/ambient.ts` vida), y el de cierre (base nueva + este texto).
- Tests: npm test 1176 (antes 1164), test:workers 12, check + build verdes. **PROTOCOL_VERSION sigue en 62.** Nada nuevo en red ni guardado; `WATER_LEVEL`, nadar y bucear iguales (las olas solo se dibujan).
- **Cifras antes → después** (llamadas / triángulos, de día; de noche igual o −1/−2: sin pájaros ni cangrejos, con luciérnagas):

| Parada | Baja | Media | Alta |
|---|---|---|---|
| Bosque | 73 / 185 k → 75 / 185 k | 154 / 429 k → 156 / 437 k | 199 / 813 k → 201 / 846 k |
| Costa | 64 / 76 k → 65 / 76 k | 99 / 118 k → 101 / 126 k | 101 / 165 k → 103 / 198 k |
| Bajo el agua | 58 / 70 k → 59 / 70 k | 85 / 109 k → 87 / 118 k | 86 / 155 k → 89 / 188 k |
| Pantano | 51 / 89 k → 53 / 89 k | 80 / 188 k → 82 / 196 k | 85 / 369 k → 87 / 402 k |
| Montañas | 70 / 105 k → 71 / 105 k | 94 / 158 k → 95 / 166 k | 102 / 219 k → 103 / 252 k |
| Tierras | 49 / 22 k → 50 / 22 k | 67 / 35 k → 68 / 35 k | 67 / 45 k → 68 / 45 k |
| Purificado | 53 / 56 k → 54 / 56 k | 75 / 116 k → 76 / 116 k | 83 / 235 k → 84 / 235 k |
| Lago Negro (nueva) | — → 47 / 18 k | — → 65 / 28 k | — → 66 / 36 k |
| Lago limpio (nueva) | — → 52 / 55 k | — → 75 / 122 k | — → 83 / 253 k |
| Mazmorra | 87 / 67 k → 89 / 67 k | 110 / 108 k → 112 / 116 k | 128 / 193 k → 130 / 225 k |
| Presupuesto §3 | 120 / 250 k | 180 / 500 k | 260 / 1 200 k |

  - **Todo dentro.** Bosque en media sigue lo más justo: 156 / 437 k (+2 llamadas, +8 k de la rejilla de olas 64²). En alta la rejilla 128² suma 33 k en todas partes. Textura nueva: el mapa de profundidad (256² = 256 KB en baja, 512² = 1 MB en media/alta). Aparecen "puntos" (luciérnagas/partículas) donde antes había 0: por eso la base se actualizó a propósito.
- Cómo funciona:
  - **Agua** (`scene/water.ts`, un `ShaderMaterial`, mismo quad): profundidad leída de un mapa horneado al cargar (R profundidad, G Pantano, B aguas bravas) en el **fragmento** (no en el vértice); turquesa en bajíos → azul hondo; Pantano marrón verdoso opaco sin espuma; **espuma** con ruido en la orilla (< 0,45 m) y en las **aguas bravas** alrededor de la isla de la mazmorra; fresnel hacia los colores de la cúpula + brillo del sol; ondas en la normal en todas las gamas; **olas en el vértice** solo en media (64²) y alta (128²), 0,15 m, ×0,2 en el Pantano.
  - **Bajo el agua:** velo HTML azul (0,35) + niebla 2–28 m del color hondo; la superficie se ve por debajo como una lámina clara. **Cáusticas** en alta: líneas brillantes en el fondo bajo el nivel del mar (`patchCaustics`), de día.
  - **Lago Negro:** mismo shader (disco polar con la profundidad por vértice), casi negro con brillo morado en la orilla; con `purify` pasa a azul limpio con espuma blanca.
  - **Vida** (`scene/ambient.ts`, 1 llamada por sistema, oculto si no toca): pájaros (1/2/3 bandadas de 12; oscuros en bosque y Tierras purificadas, gaviotas en la Costa, 3 águilas grandes en Montañas; solo de día, aleteo en el vértice); luciérnagas (40/120/250; bosque de noche, Pantano siempre, doradas en las Tierras purificadas); partículas (200/400/600: hojas en el bosque de día, mosquitos en el Pantano, nieve suelta en Montañas si no llueve/nieva ya, ceniza en las Tierras sin purificar); cangrejos (media/alta, 10 en la arena de la Costa de día, huyen de lado a < 4 m); peces (alta, 20 en círculos bajo el mar de la Costa si hay > 2,5 m de fondo).
- Decidido por Claude — revisar:
  - Profundidad con textura en el fragmento (funciona en cualquier móvil); la regla "nada de texturas en el vértice" de V2-C se mantiene. Baja usa mapa 256² (hornear 512² tarda ~0,2 s en PC; en móvil sería más).
  - El agua no pasa por la niebla por altura de media/alta (es un `ShaderMaterial`, usa la lineal). No se nota en las capturas.
  - Pájaros, cangrejos y peces mueven sus matrices en CPU (≤ 36/10/20 por fotograma); solo el aleteo va en el shader. Luciérnagas y partículas: 0 CPU (se envuelven alrededor del jugador en el vértice).
  - Sin lagos helados (no existen en el terreno). El lago limpio no tiene olas (spec).
- Verificado en navegador: sí, capturas del arnés (SwiftShader): Costa de día con el mar azul claro, gaviotas y un cangrejo en la arena; bajo el agua con velo azul y cáusticas en el fondo (alta); Lago Negro morado oscuro y, purificado, azul limpio entre la pradera; bosque de día con hojas en el aire; bosque y Pantano de noche con luciérnagas verdes. La espuma se ve fina desde lejos; las olas y el aleteo no se ven en una captura.
- Bloqueos: ninguno.
- Qué probar (Gabriel, teléfono, `?fps=1`): fps en Baja en la Costa y el Pantano; bucear y mirar el velo y que se vea la salida; ¿la espuma de las aguas bravas avisa bien?; de noche en el bosque, luciérnagas; acercarse a un cangrejo (Media).
- Lo siguiente: V2-E (criaturas y animaciones).

## Visuales · V2-E — Criaturas, poses, papel, borde de luna y "suelta y listo" — HECHO
- Plan: `docs/superpowers/plans/2026-09-27-visuales-V2-E-criaturas-poses.md` (ff6594d).
- Commits: 3063b14 (T1 puro: `scene/creature-rig.ts`, `actors/poses.ts`, `actors/enemy-look.ts`, `actors/drop-ins.ts`), 2644301 (T2 criaturas con huesos en el shader + arnés `--vitrina`), 69e5f52 (T3 color por tipo, marca de carga, poses), 226730a (T4 papel iluminado, borde de luna, cargador de modelos), y el de cierre (base nueva + este texto).
- Tests: npm test 1204 (antes 1176), test:workers 12, check + build verdes. **PROTOCOL_VERSION sigue en 62.** Alturas de montura, tiempos de carga y colisiones iguales.
- **Cifras antes → después:** llamadas bajan donde había cajas (bosque 75→61 baja, 156→142 media, 201→187 alta; Costa −6; bajo el agua −6/−12); triángulos iguales (±1 k); +1 programa en todas (rim/papel). La tabla final está en "Visuales — resumen". Sin errores de página en la pasada completa.
- Cómo funciona:
  - **Criaturas** (`creature-rig.ts` + `creature-mesh.ts`): una sopa de triángulos por especie (ciervo 4 patas/astas, pez con aletas, rana con ojos saltones, ballena con percebes) con atributo `part`; `patchRig` gira cada parte sobre su pivote y aplica una onda en S (pez, ballena). Ciervo: trote en pares diagonales, pasta quieto, corcovea al domar. Pez: ondula más rápido con velocidad. Rana: patas plegadas, salta al moverse, garganta brillante (malla propia sin niebla, como antes). Ballena: onda lenta y cola.
  - **Enemigos zorro:** material compartido por tipo (lobo gris frío, bestia de ceniza en las Tierras con brasas, bruto morado, reforzado casi negro, escudado azul, turba oliva, roca gris) con la textura pasada a gris × color. Tablas/manto/losa igual. **Marca de carga:** anillo rojo + flecha bajo el bruto de cada mazmorra mientras `elite.charging`.
  - **Poses** (`poses.ts`, se aplican tras el mixer): rodar = salto quieto + vuelta de 360° en 0,45 s encogido; bloquear = brazos cruzados + torso 10°; arco = brazo izq. al frente, der. junto a la cara; trepar = torso 25° y brazos alternos; planear = brazos abiertos + tela 4×2 que aletea con el viento (adiós cono); deslizar = tumbado con brazos por delante.
  - **Papel:** color × luz del look (suelo 0,35 de noche) y borde blanco de papel en media/alta. **Borde de luna:** `patchRim` en robot, zorros y criaturas, 0 de día, 0,55 de noche.
  - **Suelta y listo:** `loadDropIns()` hace HEAD de `/models/<nombre>.glb` (rechaza la respuesta HTML de la SPA); si llega, `DropInPuppet` (ciervo/pez/rana/ballena) o `Actor` con sus clips (lobo/bruto); si no, procedural/zorro. Probado solo el camino "falta" (no hay archivos).
- Decidido por Claude — revisar: la sombra de las criaturas (media/alta) es la de la pose quieta (el pase de sombra no lleva los huesos); las poses se ven toscas en las capturas (el arco apunta algo bajo, deslizar es aproximado): retocar números en la tabla de `poses.ts`; los drop-ins de enemigo conservan sus colores (sin tinte por tipo); la vitrina del arnés es un módulo aparte que solo carga `?perf=1`.
- Verificado en navegador: sí, capturas del arnés `npm run perf -- --vitrina` (SwiftShader, `scratch/perf/shots/*_vitrina_*`): las cuatro criaturas de día y de noche (se ven con forma, el ciervo con astas y la rana con garganta dorada); los 7 colores de enemigo distintos y el anillo rojo; cada pose (se leen bloquear, arco, rodar, deslizar; trepar y planear menos claros de perfil); los dibujos con luz de día/noche y el borde de papel; **el robot en la Costa de noche ya tiene contorno de luna** (antes silueta negra). El movimiento (patas, ondas, aleteo) no se ve en capturas.
- Bloqueos: ninguno.
- Qué probar (Gabriel, teléfono, `?fps=1`): montar el ciervo al trote y ver las patas; el pez y la rana; rodar/bloquear/planear; un bruto de mazmorra cargando (¿se ve el anillo?); de noche en la Costa, ¿se lee el robot?
- Lo siguiente: #7 Pulido (con el tutorial).

## Pulido · P7-A — Impacto: golpes, sacudida, barra flotante, borde rojo y cámara — HECHO
- Plan: `docs/superpowers/plans/2026-09-28-pulido-P7-A-impacto.md`.
- Commits: T1 servidor (`fx`, `self.hurt`, visiones por jugador, **protocolo 63**), T2 puro (`impact.ts`, `settings.ts`, `camera-clip.ts`), T3 en pantalla, T4 cámara, y este texto.
- Tests: npm test 1224 (antes 1204), test:workers 12, check + build verdes. Los tests que fijaban `PROTOCOL_VERSION` 62 ahora fijan 63 (cambio a propósito). Partidas viejas cargan (`seen` opcional). Sin cambios de balance.
- Rendimiento: arnés en baja (20 lecturas) **igual que la base**, todo dentro; no se tocó `baseline.json`. La pasada de 3 gamas no cabe en 10 min en el contenedor: media/alta sin medir (las barras solo existen tras un golpe; el parpadeo cambia material, no añade llamadas).
- Cómo funciona:
  - **Servidor:** cada golpe que entra (`strike`, anclas) apunta `{ id, dmg, kind: hit|kill, by, hp }`; en `bite`, `parry` y `block`. Lista con número de secuencia (2 s) y cada jugador guarda el último que recibió: nada se pierde entre ticks ni se repite. ≤ 6 por snapshot, solo a ≤ 40 m. `self.hurt` = lo que pasó por `hurt()` desde el último snapshot.
  - **Pantalla:** tu golpe → el enemigo parpadea blanco 80 ms (un material blanco compartido; el papel ×2 de color y se aplasta 10 %), hit-stop 60 ms (110 en parada o golpe final) del enemigo, tu robot y la cámara; golpe final → sale despedido 0,6 m. Golpe de un amigo: solo parpadeo. Recibes daño → borde rojo (CSS) según el daño, tu robot parpadea rojo, sacudida ≤ 0,2; bajo 25 % de vida el borde late. Vibración con `navigator.vibrate` (iOS no tiene).
  - **Barra flotante** sobre lobos, brutos y rayos 3 s tras cada golpe (4 como mucho). Los jefes siguen con su barra de arriba.
  - **Ajustes en el Menú:** "Sacudida de cámara" (Normal / Suave / Nada; Suave por defecto en táctil) y "Vibración" (Sí/No), en `localStorage['bosque.settings']`. El corcoveo del ciervo pasa por la misma sacudida.
  - **Cámara:** rayo contra los `colliders` (rocas, muros, pilares, estructuras) y el terreno entre medias; se acerca al momento y vuelve despacio. 3,5 m dentro de mazmorras. Fijar objetivo con τ 0,15 s.
  - **Visiones de entrada por jugador** (Pantano, Montañas, Tierras): el primero del mundo la da a todos los conectados; quien llegue después la recibe él solo, con su nombre.
- Decidido por Claude — revisar:
  - `fx` lleva también `hp` (0–1): la barra es exacta aunque el asedio cambie la vida.
  - Daño de zona (ciénaga, zarzal, espesura, ceniza) y de caída **no** cuentan en `hurt` (un borde rojo continuo no dice nada).
  - El "empujón hacia delante" de tu golpe es la misma sacudida, pequeña (0,05).
  - Golpes desviados ("El papel doblado aguanta") y las peleas especiales (El Marchito, el final, el Corazón Negro) no mandan `fx`.
  - No se hace "enemigo en el tercio superior" al fijar: el pitch sigue siendo del jugador.
  - Las verjas de mazmorra no son círculos: la cámara no choca con ellas (los 3,5 m ayudan).
  - Un veterano de antes del 63 verá cada visión de entrada una vez más (no hay forma de saber si la vio).
  - Las barras usan 4 materiales de frente (uno por barra, para el color) + 1 de fondo.
- NO verificado: nada de esto se vio en un navegador ni en móvil (Chromium headless a 2 fps no sirve para juzgar el impacto); la vibración; que el borde rojo no tape nada en pantallas pequeñas.
- Bloqueos: ninguno.
- Qué probar (Gabriel, teléfono, `?fps=1`): 5 golpes, 1 parada, 1 lobo muerto: ¿se nota cada uno? ¿Marea la sacudida en Suave? ¿Y en Normal? Dejarse morder: borde rojo y vibración. Pegarse a una roca o un muro girando la cámara. Un sobrino entra al Pantano después de otro: ¿le sale su visión?
- Lo siguiente: P7-B Sonido.

## Pulido · P7-B — Sonido: sintetizador, 57 efectos, avisos, ambiente, música "suelta y listo" y volumen — HECHO
- Plan: `docs/superpowers/plans/2026-09-28-pulido-P7-B-sonido.md`.
- Commits: 4c322b9 (plan), d81f036 (T1 puro: `audio/synth.ts` + tabla `audio/sfx.ts`), a62f994 (T2 puro: `audio/mix.ts`, `audio/cues.ts`, volúmenes en `settings.ts`), d9dbeb7 (T3 motor `audio/engine.ts` + cableado), y este texto.
- Tests: npm test 1309 (antes 1224), test:workers 12, check + build verdes. Sin cambios de protocolo (sigue 63), de balance ni de reglas. Sin dependencias nuevas ni descargas.
- Rendimiento: **P7-A media y alta medidas ahora** (cada gama por separado, < 10 min): media 20 lecturas y alta 20 lecturas, **igual que la base** y dentro del presupuesto. Tras P7-B, baja 20 lecturas igual que la base (el sonido no dibuja nada). `baseline.json` sin tocar. El test de propiedad del Buhonero se pasó de 5 s una vez con el arnés corriendo en paralelo (CPU); solo y en la pasada final, verde.
- Cómo funciona:
  - **Sintetizador** propio (~150 líneas, estilo zzfx): onda, ataque/sostén/caída, barrido, ruido, paso bajo/alto, trémolo, vibrato, acordes y un eco. Cada efecto es una fila en `audio/sfx.ts` (57: pasos ×5, salto, aterrizaje, rodar, golpes, arco, bloqueo, parada, daño, planeador, trepar, nadar, tobogán, los 4 poderes, talar/picar/bayas, construir, muro roto, cofre, orbe, zona, fogata, viaje, trueno, avisos de lobo/bruto/rayo/jefe, papel, doma, galope, UI, cuerno, risa del Marchito, latido). Se renderizan una vez al primer toque, en trozos para no parar un fotograma; se tocan con ±6 % de tono.
  - **Buses** general → efectos / interfaz / ambiente / música; ≤ 12 voces (se corta la más vieja de su clase); `StereoPannerNode` + caída por distancia (0 a 40 m). **Los avisos nunca se cortan y se oyen fuera de cámara**: mínimo 0,5 hasta 60 m, 0,3 más lejos.
  - **Cuándo suena:** golpes/parada/bloqueo desde `fx` (los tuyos centrados, los de amigos en el enemigo), daño desde `self.hurt`, el aviso cuando un enemigo pasa a `attack` (el mismo fotograma que el aviso visual), avisos de jefes (Antenón `tell`, Cucurucho `windup`, élites cargando, La Flecha apuntando), cuerno al aviso de asedio, risa cuando el Marchito ríe, latido cada 1,1 s bajo 25 %. Lo que envías suena al salir (golpe al aire, talar/picar/bayas según el recurso, construir, poder, cofre, fogata, viaje, venta, tic de doma). Pasos por distancia recorrida (hierba/arena/roca/nieve/agua, trepar, nadar, galope).
  - **Ambiente** procedural: 7 capas de ruido filtrado en bucle (hojas de día, grillos de noche, olas, pantano, viento que sube con la altura y la tormenta, grave de las Tierras que tras el final suena a bosque, lluvia) mezcladas con `biomeWeights` (el mismo fundido que el cielo), + pájaros, ranas y burbujas al azar y truenos en tormenta. En mazmorras las capas se apagan y los efectos pasan por una reverberación sintética.
  - **Música "suelta y listo":** HEAD a `/audio/musica-<bosque|costa|pantano|montanas|tierras|asedio|jefe>.ogg` tras el primer toque; si no hay, silencio (sin errores). jefe > asedio > bioma, fundido de 3 s.
  - **Ajustes en el Menú:** Sonido (Con sonido / 🔇 Silencio) y cuatro barras (Volumen general, Efectos, Ambiente, Música), en `bosque.settings`. Tecla **`.`** = silencio ("Silencio" / "Con sonido"). Pestaña oculta → silencio y `suspend()`.
  - **iOS:** el `AudioContext` nace en el primer toque/clic/tecla con un búfer mudo; si tras 2 toques sigue suspendido: "Sin sonido: revisa el interruptor del móvil" (una vez, solo en táctil). Pantalla de entrada: "Bosque. Juego cooperativo. Con auriculares se oye mejor."
- Decidido por Claude — revisar:
  - 57 efectos en vez de ~40 (salen solos de la lista del §4.2); se retocan en la tabla.
  - Fundido de ambiente con `biomeWeights` (~30 m) en vez de 20 m: reutiliza el del cielo.
  - No hay relámpago visual que seguir: el trueno suena al azar cada 8–25 s en tormenta.
  - Los pasos de los amigos no suenan (presupuesto de voces).
  - "No puedes" = avisos que empiezan por "Aún no", "No ", "Nada", "Falta", "Te falta", "Necesitas"; el resto de avisos, un tintineo suave.
  - Jefes con aviso: cualquier jefe/élite que pase a `attack` suena a `jefe-aviso`; la música "jefe" suena si hay un jefe o el Marchito a la vista.
  - El golpe al aire suena al pulsar aunque luego acierte (se oyen los dos: vuelo + impacto).
  - Las barras de volumen son de 5 en 5; la curva es cuadrática (50 → 25 %).
- NO verificado: nada se ha oído (el contenedor no tiene salida de audio; Chromium headless sin sonido). No se probó en iOS. El coste real de CPU en móvil (≤ 0,3 ms/fotograma del §4.1) no se midió: el arnés no mide audio.
- Bloqueos: ninguno.
- Qué probar (Gabriel, con auriculares y con altavoz): ¿se oye el aviso del lobo antes del mordisco, también con el lobo a tu espalda? ¿Algún sonido cansa en 10 min (pasos, tintineo de avisos, grillos)? Silenciar con `.` y desde el Menú; bajar Ambiente a 0. En el iPhone: interruptor de silencio puesto → ¿sale el aviso? Volver de otra app → ¿vuelve el sonido? Dejar un `musica-bosque.ogg` en `public/audio/` y ver que entra con fundido.
- Lo siguiente: P7-C UI / UX.

## Pulido · P7-C — UI y textos: qty(), HUD de móvil, 🎒, avisos agrupados, Menú con pestañas y Ayuda por temas — HECHO
- Plan: `docs/superpowers/plans/2026-09-28-pulido-P7-C-ui-textos.md`.
- Commits: d6a6527 (plan), 9625cc3 (T1 `qty()`/`costText` y barrido de plurales), 8e83930 (T2 modelos puros `hud-model.ts`, `menu-ui.ts`, ajustes nuevos), 2d16c47 (T3 HUD de móvil: zonas seguras, 🎒, avisos ≤ 3 con ×N, pastillas por progreso, panel de muerte), 72db21a (T4 Menú con pestañas), y este texto.
- Un reinicio del contenedor cortó T4 a medias; el trabajo sin commit (Menú con pestañas en `hud.ts`, `openMenu()` en `game.ts`, estilos) era coherente con T4 y se terminó: el botón de cámara ahora alterna bien su texto tras varios toques, y la fila de ámbar en la 🎒 ya no dice "de ámbar" (test nuevo).
- Tests: npm test 1339 (antes 1309), test:workers 12, check + build verdes. Tests actualizados por texto cambiado a propósito: los que fijaban "1 perlas" (T1). Sin cambios de protocolo, balance ni reglas.
- Rendimiento: baja 20 lecturas, **igual que la base** y dentro del presupuesto. `baseline.json` sin tocar.
- Capturas (Chromium headless, táctil, 390×844 y 844×390): HUD, 🎒 y las cinco pestañas. Sin solapes vistos; en vertical Ajustes se desplaza (es largo), en apaisado se oculta el título "Menú" para ganar alto. Sin errores de página.
- Decidido por Claude — revisar:
  - Pestañas: Jugar (Seguir, 🎒, viajes, llamadas, trampa, asedios, puestos) · Libro (Libro, Oficios, Aspecto) · Ajustes (calidad, cámara, sensibilidad 0,5–2, sacudida, vibración, sonido, tamaño de texto, marcas de forma) · Ayuda (tarjetas según lo visto y el dispositivo) · Salir (con confirmación).
  - El Menú recuerda la última pestaña (`bosque.settings.tab`). Libro, Oficios, Aspecto y Puestos vuelven al Menú con "Volver".
  - En PC la 🎒 está en Menú › Jugar; no hay tecla nueva.
  - Los textos largos de ayuda del Menú viejo se sustituyen por las tarjetas de Ayuda: solo sale lo que ya has visto (nada del Pantano antes de entrar).
- NO verificado: panel de muerte en captura (no hay forma limpia de morir en el arnés); en un teléfono real (muescas, iOS Safari); tamaño de texto Grande en todas las pantallas.
- Bloqueos: ninguno.
- Qué probar (Gabriel, teléfono): abrir Menú, cambiar de pestaña, cerrar y volver (¿recuerda la pestaña?). Ajustes › Tamaño de texto Grande: ¿cabe todo? Sensibilidad al mínimo y al máximo. 🎒 con cosas. Ayuda con un sobrino nuevo: ¿solo Moverse? Morir: ¿se entiende la causa y el botón?
- Lo siguiente: lo que diga Gabriel.

## Pulido · P7-D — Guía: "Qué sigue", flecha de borde, consejos, puntos de nuevo y El eco del bosque — HECHO
- Plan: `docs/superpowers/plans/2026-09-28-pulido-P7-D-guia.md`.
- Commits: b97ac51 (plan), f5ef06f (T1 servidor: `snap.story`, registro del eco, `SavedPlayer.left`, **protocolo 64**), 86a89ce (T2 `src/shared/guide.ts`), 86dc01e (T3 `guide-model.ts`: consejos, puntos, ajustes), a0c2ead (T4 cableado en HUD/Menú/táctil), un arreglo de colocación tras las capturas, y este texto.
- Tests: npm test 1371 (antes 1339), test:workers 12, check + build verdes. Los tests que fijaban `PROTOCOL_VERSION` 63 ahora fijan 64 (cambio a propósito). Partidas viejas cargan (`left` opcional). Sin cambios de balance ni de reglas.
- Rendimiento: baja 20 lecturas, **igual que la base** y dentro del presupuesto (la línea y la flecha son DOM: cero llamadas de dibujo). `baseline.json` sin tocar.
- Cómo funciona:
  - **`nextStep(view)`** (pura) recorre 28 pasos en orden de historia: Corazón → santuarios del Bosque → Raíz-madre → Enredadera → ciervo → Invasión 1 → pez → santuarios de la Costa → Invasión 2 (dos textos: "vuelve al Corazón" / "rompe las anclas") → ballena → Viento → El Antenón → rana → santuarios del Pantano → Fuego → El Zancudo → nudo del Zarzal → santuarios de la Montaña → Piedra → El Cucurucho → Escalera → dragón → niebla → fogata de la Ceniza → Pilares-raíz → Invasión 3 → la Torre → la Estrella. El primero sin hacer gana. **Pasos del mundo** (jefes, invasiones, ballena, Zarzal, Escalera, niebla, pilares, final) cuentan si los hizo cualquiera; **pasos del jugador** (orbes, poderes, monturas) solo si los hiciste tú. Un test recorre una partida simulada de mundo nuevo a créditos y otro la de un recién llegado a un mundo terminado (solo le salen pasos suyos).
  - Secundarios (uno como mucho): puntos de oficio, luna llena, zona morada a ≤ 150 m (esta última también si el paso de historia está a > 300 m).
  - **Línea** arriba al centro: "✨ Santuario del Bosque · 90 m ↑ (Bea está allí)"; el rumbo es relativo a la cámara (8 flechas), "aquí" a < 8 m. Se atenúa al 40 % a los 8 s; tocarla abre Menú › Ayuda. **Flecha de borde** (▲ girada) cuando el objetivo no se ve; en táctil se queda por encima de los botones.
  - **Consejos** (25, uno cada vez, 6 s, una vez por dispositivo en `bosque.tips`): mirar, bayas, fogata, planeador, noche, frío, parada, rodar, arco, poca vida, Corazón, asedio, orbe, cambiar poder, cada poder, montura, mazmorra, fogata de viaje, Puesto, El Marchito, barro, Zarzal. Un veterano (Rango > 1 u orbe) los recibe todos como vistos la primera vez.
  - **Puntos ●** en MENÚ, en las pestañas Libro (puntos de oficio) y Ayuda (tarjeta nueva) y en una pastilla que acaba de aparecer; se quitan al abrir/tocar (`bosque.ack`). La primera carga lo da todo por visto.
  - **El eco del bosque:** el DO guarda en memoria los últimos 20 hitos (zona limpia, jefe, montura, ballena, asedio aguantado, invasión, pilar, Rango, final) con quién estaba. Al entrar, si faltabas > 30 min de reloj real y otros hicieron algo (o tu Puesto vendió), sale una tarjeta verde "Mientras no estabas:" + ≤ 3 líneas agrupadas ("Bea limpió 2 zonas del Pantano.", "Tu puesto vendió 4 veces."), ✕ o 6 s. Sustituye al aviso suelto de ventas cuando sale.
  - Ajustes: "Mostrar Qué sigue" y "Consejos" (Sí/No).
- Decidido por Claude — revisar:
  - **Protocolo 63 → 64** (el spec decía "campos en 63", pero 63 ya salió en P7-A). **El tutorial (P7-F) pasa a 65.**
  - `snap.story` = invasiones 1–3 y los 4 jefes purificados (lo único que el cliente no veía); el resto ya llegaba.
  - Rumbo relativo a la cámara, no brújula (no hay mapa donde leer el norte).
  - La flecha es DOM, no un sprite.
  - No hay "Tu Caja tiene 12 bayas" (el contenido de la Caja no llega al cliente) ni el "brillo de 1 minuto" de los sitios que cambiaron (coste 3D; queda pendiente).
  - El registro del eco se pierde si el DO se reinicia; una partida vieja (sin `left`) no ve eco la primera vez.
  - Varios nombres de un mismo hito van juntos ("Bea y Leo aguantaron un asedio."); lo que hiciste tú, aunque fuera con otros, no sale.
  - Objetivo en mazmorra = su puerta; ciervo = el salvaje a la vista o su claro de la semilla.
- Capturas (Chromium headless, táctil, 390×844 y 844×390, mundo con Corazón importado): la línea "✨ Santuario del Bosque · 90 m ↑" arriba al centro bajo MENÚ/🎒 sin tapar las barras; consejo "De noche atacan el Corazón. 🧱 pone muros." debajo de las barras en vertical (antes las tapaba: arreglado) y centrado en apaisado; tras girar la cámara, "90 m ↓" y la flecha en el borde (abajo en vertical por encima de los botones, arriba a la derecha en apaisado). Ajustes se ve bien; los dos interruptores nuevos quedan al final de la lista (hay que desplazar). Sin errores de página propios (solo `setPointerCapture` de los arrastres sintéticos del arnés).
- NO verificado: la tarjeta del eco en pantalla (necesita 30 min reales entre dos jugadores; cubierta por tests del servidor); los puntos ● en captura; el consejo "mirar" de un jugador nuevo (a los 6 s ya se ha ido cuando el arnés está listo); nada en un móvil real; el recorrido de 20 min siguiendo la línea (§12.7).
- Bloqueos: ninguno.
- Qué probar (Gabriel, teléfono): partida nueva → ¿la línea dice qué hacer y la flecha lleva? Seguirla 20 min. Girar: ¿la flecha cambia de borde con sentido? Con un sobrino más adelantado: ¿te sigue pidiendo tu orbe/montura pero no su jefe? Salir 31 min mientras otro juega y volver: ¿tarjeta del eco? Ajustes › Consejos No.
- Lo siguiente: P7-E Bug-bash.

## Pulido · P7-E — Bug-bash: la Estrella por su nombre, luna llena, telón de la Copa, Raíces-madre blancas, poses y balance — HECHO
- Plan: `docs/superpowers/plans/2026-09-28-pulido-P7-E-bug-bash.md` (3f7ffd0).
- Commits: 1aa78f5 (T1 la Estrella al silbar y en las fogatas), 1eb2fd6 (T2 luna llena), 8ae7f1c (T3 telón de la Copa y Raíces-madre blancas), 1dc9f19 (T4 poses y robot de noche), c3c8ed0 + 26c3de2 (T5 **balance, commit aparte**), y el de cierre (este texto).
- Tests: npm test 1380 (antes 1371), test:workers 12, check + build verdes. **Sin cambio de protocolo** (sigue 64), sin campos guardados nuevos. Tests actualizados a propósito por el balance: los que fijaban 1200 PV / núcleo 300 / 720 del Marchito en solitario (`marchito-final.test.ts`, `world-sim-s5f.test.ts`); ninguno borrado ni aflojado (la simulación en solitario ahora pide además > 7 min).
- **Arreglado:**
  - **La Estrella por su nombre:** con la Estrella, silbar en la Ceniza dice "Silbas. La Estrella llega rodando por la ceniza"; el Menú de fogatas, "Llamar a la Estrella"; A sin montura cerca, "La Estrella no está cerca" (`landMount`, `callText`, `callNone`, `callLabel`).
  - **Luna llena:** la luna ya existía (V2-B, pequeña); en luna llena (`día % 8 === 0`, la misma regla que la Estrella) el disco es 2,5× más ancho y con halo (`moonLook`, uniformes del cielo, 0 llamadas nuevas). El arnés acepta `day` en la parada.
  - **Telón de la Copa:** un cilindro abierto de 70 m alrededor de la Copa con un lienzo pintado una vez (degradado violeta → ámbar, montañas azul-gris, copas del bosque y el árbol del Corazón al sur). 1 llamada; tapa lo que hay detrás (antes se veían otras mazmorras en el vacío).
  - **Raíces-madre blancas tras el final:** el tronco del Bosque, la Costa y el Pantano pasa a blanco hueso con la misma purificación de 60 s de las Tierras, y el haz de luz se apaga. La Montaña es una cueva: no cambia.
  - **Poses:** arco con el codo a la altura del hombro y la mano 0,3 m por encima (antes apuntaba bajo); deslizar tumbado a ~0,3 m del suelo (flotaba a 1,25 m). Números resueltos contra `robot.glb` con un script en `scratch/pose/` (no se publica).
  - **Robot de noche:** el borde de luna suma una luz propia pequeña (~0,05 a noche cerrada), también en el tuyo.
- **Balance (commit aparte, fácil de revertir):**
  - **El Marchito en solitario ×1,3** (`FINAL.soloFactor`): 1 560 PV y núcleo 390 (antes 1 200 / 300). Simulación en solitario: **6,1 → 7,7 min** (fase 1 139 → 177 s, fase 2 92 s igual, fase 3 135 → 196 s). Con 2 o más sigue 1 + 0,35 por jugador (2 = ×1,35).
  - **Pez: 7 → 8 s** entre anillos (el hueco más largo son ~5,4 s nadando normal; ahora sobran > 2 s para girar).
- Decidido por Claude — revisar:
  - **"Voluntad +30 %" del spec §10.2 se leyó como PV del jefe final en solitario:** la voluntad es de las Invasiones; lo que duraba ~6 min era la pelea de la Copa. La fase 2 no depende de los PV (son 4 brotes), así que el mando son los PV de las fases 1 y 3. Con 2 jugadores el factor (1,35) queda casi igual que solo: dos pegan el doble, así que con amigos va más rápido; si se quiere, subir `perPlayer`.
  - **Curva de Savia sin tocar:** §10.2 pide moverla solo si la simulación de historia completa llega a Rango 8 antes del Marchito o no llega nunca; no hay tal simulación con caza/asedios (la de hitos da ~1 270, Rango 6). Queda para la prueba de Gabriel.
  - El telón es fijo (no sigue la hora del día) y es el mismo en cada mundo; el árbol del Corazón está dibujado al sur del lienzo, no en su sitio real.
  - Tocones "blancos" sin cortar: el tronco se queda entero y la copa verde (como el Árbol-torre).
- Aplazado: **Cornisa** (repisas vs el salto de 9 m de la rana) y **ancho de la Escalera**: no están en el triaje §10.1 y no hay prueba de que fallen; van a la lista §12 de Gabriel. El "brillo de 1 minuto" de P7-D sigue pendiente.
- No se arregla: sombra de las criaturas en pose quieta (spec), trueques en memoria, asedios tras el final (hay interruptor).
- Verificado en navegador: capturas Chromium headless (SwiftShader): luna llena en el día 8 frente al 9 (disco con halo arriba a la izquierda; el 9 sin nada visible en ese encuadre); la Copa mirando al este y al sur con montañas y copas en el telón; la Raíz-madre del Bosque blanca con `purified`; `--vitrina pose:bow,pose:slide` (arco a la altura del hombro, deslizar en el suelo) y el robot de noche en la Costa (se lee, con contorno). Rendimiento `npm run perf -- --tier low`: todo dentro de la base y del presupuesto.
- NO verificado: nada en un móvil real; la luna llena en movimiento (solo capturas fijas); el telón con la pelea encendida (rayos, brotes); la transición de 60 s del blanco (solo el estado final).
- Qué probar (Gabriel): con `ending: true`, esperar a la noche del día 8 y mirar al cielo; silbar a la Estrella desde la Ceniza; subir a la Copa y mirar alrededor; pasar junto a la Raíz-madre del Bosque tras el final. **Cronometrar El Marchito en solitario (objetivo ~8 min)** y con 2. Disparar el arco y deslizar por la nieve. El pez: ¿8 s se sienten justos? Constantes: `FINAL.soloFactor` en `src/shared/sim/marchito-final.ts`, `FISH.ringTime` en `src/shared/fish.ts`, `moonLook` en `src/client/scene/sky-dome.ts`, `BACKDROP` en `src/client/scene/backdrop.ts`, tabla de `src/client/actors/poses.ts`.
