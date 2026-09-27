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
