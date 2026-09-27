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
