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
