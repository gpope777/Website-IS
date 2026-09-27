# Sub-project #1 — deferred follow-ups

Minor findings from task and final reviews, deliberately deferred (triaged as safe to defer by the final review).

- Task 1: minor (deferred): build script no longer typechecks until Task 8 wires `check` (plan-mandated)
- Task 2: minor (deferred): resource spawn probabilities are unnamed magic numbers (plan-mandated)
- Task 6: minor (deferred): no tests for away-player protection (vitals frozen, not bitten)
- Task 6: minor (deferred): all players away at nightfall → no wolves that night (errs safe)
- Task 6: minor (deferred): SavedWorld.version not checked on load
- Task 6: minor (deferred): structures can be placed on top of resources/players
- Task 8: minor (deferred): "inventory is saved" test reads in-memory sim, not SQLite round-trip; no tests for socket replace/full/import-kicks
- Task 8: minor (deferred): import validates only top-level shape of SavedWorld
- Task 8: minor (deferred): bad-strike map never decays/cleared on replace
- Task 8: minor (deferred): any valid world code instantiates a DO (empty table)
- Task 10: minor (deferred): Connection.onmessage JSON.parse unguarded; Connection state machine untested (only pure helpers)
- Task 13: minor (deferred): Actor.play re-trigger mid-crossfade may leave partial weight
- Task 14: minor (deferred): dispose doesn't free GPU geometries/actors on Salir→rejoin; no `disposed` guard for in-flight messages; unused myName; stale touch.ts comment + dead CSS rules
- Task 8: minor (deferred): hello() keeps a stale `sim` reference if admin /import replaces it during await hashPin
- Task 6b (cooldown EPS): complete (commit 7732fd8; 5-line diff inspected by controller — correct; RED/GREEN + 3x workers runs in task-6b-report.md; final review will cover). minor (deferred): anchor re-check '> 1' has same float exposure, delays re-anchor ≤1 tick
- Final #3: PIN rate limiter is in-memory and resets when the room is evicted — persist it in the kv table before sharing world codes widely.

## Not verified live (browser pane throttled to 1 fps)
- Wolf chase/bite on screen (covered by unit tests).
- One-Esc menu under real pointer lock (synthetic events can't take pointer lock).
- Defense in depth: WorldRoom.fetch() trusts /admin/* paths (only index.ts can route them there, after a constant-time token check). Add a second ADMIN_TOKEN check inside the DO, and strip pinHash from /admin/export.
- Live test world has a leftover player "Prueba" (PIN 4242) from the deploy smoke test.
