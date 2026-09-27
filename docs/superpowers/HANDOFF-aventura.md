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
