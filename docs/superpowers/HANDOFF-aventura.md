# Handoff — Aventura, Plan A (2026-09-26)

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
