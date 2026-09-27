# Aventura C — Tumba y revivir en co-op — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dying finally costs something, and friends matter. When you fall, a teammate has 30 s to walk up and press the action button to get you back on your feet with your backpack intact. If nobody comes (or you give up and respawn), everything you carried drops into a **tumba** where you fell, and you have to walk back to pick it up.

**Architecture:** All rules live in `WorldSim` (`src/shared/sim/world-sim.ts`, pure TS, vitest). Graves are a small saved list (`SavedWorld.graves`, optional so old saves load). Each tick the sim hands a grave's contents back to its owner when they are alive and standing on it: pickup is automatic, so it needs no button. The death time is live-only state (`Live.deadAt`); revive is a new client message `{ t: 'revive'; name }` that the server validates (reviver alive, target dead, inside the window, in reach). Graves ride on the 10 Hz `snap` (a tiny list, contents not shown). On the client, revive is **contextual on the existing action button** (E / touch "A"), so no new pill is added to the 10-pill grid.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-26-bosque-aventura-design.md` §10 ("Death") and §12. Foundation: `docs/superpowers/specs/2026-09-26-bosque-online-design.md` (§8: the old "keep your inventory on death" rule; §10 of the Aventura spec replaces it). Plan map: top of `2026-09-26-aventura-A-corazon-asedios.md` (this is Plan C).

## Global Constraints

- All player-facing text in **Spanish**, dry and short.
- **Phones first:** revive uses the existing action button (E / touch "A"), and it takes priority over punching and harvesting when a fallen teammate is in reach. Grave pickup is automatic (walk onto it). No new pills.
- **Trust boundary:** `revive` goes through `decodeClient` (name must match `NAME_RE`). The server checks that the reviver is alive, the target is dead, the target is not the reviver, the death is still inside `REVIVE.window`, and the reach.
- **Protocol:** `PROTOCOL_VERSION` goes 3 → 4. `SavedWorld.version` stays `1`; `graves` is optional (`saved.graves ?? []`). `SelfState` gains `reviveLeft` (whole seconds left to be revived, 0 otherwise).
- **Behaviour change (recorded):** the foundation rule "death keeps your inventory" is replaced by spec §10. The existing test "respawn restores and keeps inventory" is updated to the new rule (inventory goes to the grave and comes back on pickup); it is not deleted.
- **Decisions (simplest reading of the spec):**
  - Only the owner can open their grave (no stealing in co-op).
  - The grave is created when you respawn (not at the moment of death), so a revived player never has to walk back. A player who closes the tab while dead keeps the items on the body until they respawn.
  - Revive is one press, no channel/hold. The revived player gets up where they fell with 40 health, and hunger/warmth raised to at least 30 so starvation does not kill them again at once.
  - After a reconnect (new `Live`) the window is gone: `deadAt` is live-only.
  - Several graves per player are allowed; the world keeps at most `GRAVE.max = 50` (oldest removed first).
- Run `npm test`, `npm run test:workers`, `npm run check` and `npm run build` before every commit.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01LAtHShjMw8Viwtk2XHSyPs
  ```

---

### Task 1: Protocol v4 + graves in the sim

**Files:**
- Modify: `src/shared/protocol.ts`
- Modify: `src/shared/sim/world-sim.ts`
- Test: `src/shared/protocol.test.ts`, `src/shared/sim/world-sim.test.ts`

**Interfaces:**
- Produces:
  - `PROTOCOL_VERSION = 4`
  - `GraveView = { id: number; owner: string; x: number; y: number; z: number }`
  - `snap` gains `graves: GraveView[]`; `SelfState` gains `reviveLeft: number`
  - `ClientMsg` gains `{ t: 'revive'; name: string }` (decoded here, handled in Task 2)
  - `Grave = GraveView & { inv: Inventory }`, `SavedWorld.graves?: Grave[]`
  - `GRAVE = { pickup: 2, max: 50 }`, `REVIVE = { window: 30, reach: 2.5, health: 40, floor: 30 }`

- [ ] **Step 1: Write failing tests**

`protocol.test.ts`: version test → `toBe(4)`, plus:

```ts
describe('revive protocol', () => {
  it('decodes revive with a valid name only', () => {
    expect(decodeClient('{"t":"revive","name":"Ana"}')).toEqual({ t: 'revive', name: 'Ana' });
    expect(decodeClient('{"t":"revive","name":""}')).toBeNull();
    expect(decodeClient('{"t":"revive","name":5}')).toBeNull();
  });
});
```

`world-sim.test.ts`: change the old "keeps inventory" test so that after `respawn` `p.inv` is `{}` and one grave owned by Ana with `wood: 2` sits where she fell. Add:

```ts
describe('graves', () => {
  it('respawning drops the backpack in a grave where you fell', () => {
    const sim = setup('Ana');
    put(sim, 'Ana', 20, 20);
    const p = sim.getPlayer('Ana')!;
    p.inv = { wood: 3, berries: 1 };
    p.vitals = { ...p.vitals, health: 0 };
    sim.step(0.1);
    expect(p.dead).toBe(true);
    sim.handle('Ana', { t: 'respawn' });
    expect(p.inv).toEqual({});
    const g = snap(sim, 'Ana').graves;
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ owner: 'Ana', x: 20, z: 20 });
    expect(sim.save().graves![0]!.inv).toEqual({ wood: 3, berries: 1 });
  });

  it('an empty backpack leaves no grave', () => { /* die with inv {} → respawn → graves [] */ });

  it('the owner picks it up by walking onto it; others cannot', () => {
    // Ana dies at (20,20) with wood 3 and respawns; Leo stands on the grave → still there;
    // Ana stands on it → inv wood 3, grave gone, toast 'Recuperaste tus cosas'.
  });

  it('graves survive save/load and old saves without graves load', () => {
    // save → new WorldSim(saved) → snapshot shows the grave; delete saved.graves → loads with [].
  });

  it('keeps at most GRAVE.max graves, dropping the oldest', () => { /* 51 deaths */ });
});
```

- [ ] **Step 2: Run** `npx vitest run src/shared` — FAIL.
- [ ] **Step 3: Implement**

`protocol.ts`:

```ts
export const PROTOCOL_VERSION = 4;
export interface GraveView { id: number; owner: string; x: number; y: number; z: number }
// SelfState: + reviveLeft: number   (whole seconds a teammate still has to revive you)
// snap: + graves: GraveView[]
// ClientMsg: + { t: 'revive'; name: string }
case 'revive':
  return typeof m.name === 'string' && NAME_RE.test(m.name) ? { t: 'revive', name: m.name } : null;
```

`world-sim.ts`:

```ts
export const GRAVE = { pickup: 2, max: 50 } as const;
export const REVIVE = { window: 30, reach: 2.5, health: 40, floor: 30 } as const;
export interface Grave extends GraveView { inv: Inventory }
// SavedWorld: graves?: Grave[]
// Live: deadAt: number | null   (live-only; null after a reconnect)
// constructor: this.graves = (saved.graves ?? []).map((g) => ({ ...g, inv: { ...g.inv } }));
//              this.nextGraveId = 1 + max id
// save(): graves: this.graves.map(...)
// snapshotFor: graves: this.graves.map(({ id, owner, x, y, z }) => ({ id, owner, x, y, z }))
// kill(): l.deadAt = this.time
// onRespawn(): this.dropGrave(p) before moving the player
private dropGrave(p: SavedPlayer): void {
  if (!Object.values(p.inv).some((n) => (n ?? 0) > 0)) return;
  this.graves.push({ id: this.nextGraveId++, owner: p.name, x: r2(p.x), y: r2(p.y), z: r2(p.z), inv: p.inv });
  if (this.graves.length > GRAVE.max) this.graves.shift();
  p.inv = {};
  this.tell(p.name, 'Tus cosas quedaron en una tumba donde caíste');
}
// step(): for each live, alive, not-away player → stepGraves(p)
private pickUpGraves(p: SavedPlayer): void {
  for (const g of this.graves.filter((x) => x.owner === p.name && Math.hypot(x.x - p.x, x.z - p.z) <= GRAVE.pickup)) {
    for (const [item, n] of Object.entries(g.inv) as [ItemId, number][]) p.inv = addItem(p.inv, item, n);
    this.graves.splice(this.graves.indexOf(g), 1);
    this.tell(p.name, 'Recuperaste tus cosas');
  }
}
// selfState: reviveLeft = p.dead && l.deadAt !== null ? Math.max(0, Math.ceil(REVIVE.window - (this.time - l.deadAt) - EPS)) : 0
```

`handle()` gets `case 'revive': return;` for now (Task 2 fills it) so the switch stays exhaustive.

- [ ] **Step 4: Run everything** — PASS (`npm test && npm run test:workers && npm run check && npm run build`).
- [ ] **Step 5: Commit** — `feat(aventura): graves hold your backpack when you respawn + protocol v4`

---

### Task 2: Co-op revive in the sim

**Files:**
- Modify: `src/shared/sim/world-sim.ts`
- Test: `src/shared/sim/world-sim.test.ts`

**Interfaces:**
- Consumes: `REVIVE`, `Live.deadAt`, `{ t: 'revive'; name }` from Task 1.
- Produces: `WorldSim.onRevive` behaviour.

- [ ] **Step 1: Write failing tests**

```ts
describe('revive', () => {
  const down = (sim: WorldSim, name: string) => {
    const p = sim.getPlayer(name)!;
    p.vitals = { ...p.vitals, health: 0 };
    sim.step(0.1);
    return p;
  };

  it('a teammate in reach gets you up with your backpack', () => {
    const sim = setup('Ana', 'Leo');
    put(sim, 'Ana', 10, 10);
    put(sim, 'Leo', 11, 10);
    const ana = sim.getPlayer('Ana')!;
    ana.inv = { stone: 4 };
    down(sim, 'Ana');
    expect(snap(sim, 'Ana').self.reviveLeft).toBe(30);
    sim.handle('Leo', { t: 'revive', name: 'Ana' });
    expect(ana.dead).toBe(false);
    expect(ana.vitals.health).toBe(REVIVE.health);
    expect(ana.inv).toEqual({ stone: 4 });
    expect(ana.x).toBe(10);
    expect(snap(sim, 'Ana').graves).toEqual([]);
  });

  it('too far, too late, self, dead reviver or live target: nothing happens', () => {
    // Leo at 5 m → still dead. Leo dead too → still dead. Ana revives Ana → still dead.
    // Reviving a live Leo → no change. After REVIVE.window + 0.1 s in reach → still dead, toast 'Ya es tarde'.
    // reviveLeft reads 0 after the window.
  });

  it('a starved player does not drop again right away', () => {
    // hunger 0 at death → revived with hunger >= REVIVE.floor.
  });
});
```

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**

```ts
private onRevive(p: SavedPlayer, name: string): void {
  const t = this.players.get(name);
  const tl = this.live.get(name);
  if (p.dead || !t || !t.dead || !tl || name === p.name || tl.deadAt === null) return;
  if (Math.hypot(t.x - p.x, t.z - p.z) > REVIVE.reach) return;
  if (this.time - tl.deadAt > REVIVE.window + EPS) return this.tell(p.name, 'Ya es tarde');
  t.dead = false;
  t.vitals = { health: REVIVE.health, hunger: Math.max(t.vitals.hunger, REVIVE.floor), warmth: Math.max(t.vitals.warmth, REVIVE.floor) };
  tl.deadAt = null;
  tl.guard = newGuard();
  tl.anchorX = t.x; tl.anchorZ = t.z; tl.anchorAt = this.time; tl.lastAcceptedAt = this.time;
  this.say(`${p.name} levantó a ${t.name}`);
}
```

`onRespawn` also clears `l.deadAt`.

- [ ] **Step 4: Run everything** — PASS.
- [ ] **Step 5: Commit** — `feat(aventura): co-op revive within 30 s`

---

### Task 3: Client — grave meshes, revive on the action button, death panel

**Files:**
- Create: `src/client/scene/graves.ts`
- Modify: `src/client/game.ts`, `src/client/hud.ts`

No new unit tests (DOM/Three wiring). Verification is `npm run check`, `npm run build` and the in-browser check.

- [ ] **Step 1: `GraveMeshes`** — `sync(graves: GraveView[], me: string)`: adds a grey headstone + a stick cross for new ids, removes missing ones; your own graves also get a tall thin glowing violet beam (`MeshBasicMaterial`, transparent, 12 m) so you can find them from afar.
- [ ] **Step 2: Snap** — `onSnap` calls `this.graves.sync(m.graves, this.me)`; `applySelf` passes `self.reviveLeft` to `hud.setReviveLeft`.
- [ ] **Step 3: Death panel** — `showDeath` text: `Si reapareces, tu mochila se queda en una tumba aquí.` plus `<p id="revive-left"></p>`; `setReviveLeft(n)` writes `Un compañero puede levantarte: n s` (or `Nadie vino.` at 0).
- [ ] **Step 4: Action** — `act()` first looks for the nearest remote player with `anim === 'dead'` within `REVIVE.reach`; if found, sends `{ t: 'revive', name }`. `updatePrompt` shows `E · Levantar a <name>` first.
- [ ] **Step 5: Verify** — `npm test && npm run test:workers && npm run check && npm run build`.
- [ ] **Step 6: Commit** — `feat(aventura): graves and revive on the client`

---

### Task 4: Ship

- [ ] **Step 1:** `git push origin aventura/slice-1`.
- [ ] **Step 2:** Plan C section in `docs/superpowers/HANDOFF-aventura.md` and a short note on draft PR #2 with the playtest checklist: die with materials → respawn → violet beam where you fell → walk onto it → "Recuperaste tus cosas"; with two players: one falls, the other presses A/E next to them within 30 s → up with the backpack. No merge: merge to `main` deploys.

---

## Self-review notes

- **Spec coverage (§10):** materials you carried drop in a grave you must go back to (Task 1); the base is safe (structures are untouched; there is no storage yet, so "what's in the base" is the structures). Co-op revive within ~30 s (Task 2), reachable from phones through the existing action button (Task 3).
- **Trust:** the client only says *whom* to revive; the server checks alive/dead, self, reach and the window with server time. Pickup is server-side and owner-only.
- **Save compat:** `graves` optional; `deadAt` never saved; `SavedWorld.version` stays 1.
- **Types:** `GraveView`, `Grave`, `GRAVE`, `REVIVE`, `reviveLeft`, `deadAt` used consistently across Tasks 1–3.
