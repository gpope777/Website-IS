import { DurableObject } from 'cloudflare:workers';
import { decodeClient, encode, PROTOCOL_VERSION, type ClientMsg, type ErrorCode, type ServerMsg } from '../shared/protocol';
import { MAX_ONLINE, newWorld, TICK_DT, WorldSim, type SavedWorld } from '../shared/sim/world-sim';
import { hashPin, RateLimiter } from './auth';

const SAVE_EVERY = 5; // seconds of play between saves
const MAX_MSG = 2048;
const MAX_BAD = 20;

/** One world = one instance. Owns the WorldSim, the sockets, the 10 Hz loop, and a single JSON row of storage. */
export class WorldRoom extends DurableObject<Env> {
  private sim: WorldSim | null = null;
  private readonly names = new Map<WebSocket, string>();
  private readonly pending = new Set<WebSocket>();
  private readonly bad = new Map<WebSocket, number>();
  private readonly limiter = new RateLimiter();
  private loop: ReturnType<typeof setInterval> | null = null;
  private sinceSave = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
  }

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/admin/create') return this.adminCreate(request);
    if (path === '/admin/export') {
      const sim = this.load();
      return sim ? Response.json(sim.save()) : Response.json({ error: 'noworld' }, { status: 404 });
    }
    if (path === '/admin/import') return this.adminImport(request);
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected websocket', { status: 426 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const msg = typeof raw === 'string' && raw.length <= MAX_MSG ? decodeClient(raw) : null;
    if (!msg) return this.strike(ws);
    const name = this.names.get(ws);
    if (!name) {
      // A hello is already in flight (hashing) for this socket: a second one is either a
      // buggy/malicious client or a stale duplicate — never let it race the first.
      if (this.pending.has(ws)) return this.strike(ws);
      return msg.t === 'hello' ? this.hello(ws, msg) : this.strike(ws);
    }
    this.sim?.handle(name, msg);
    this.flush();
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.drop(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.drop(ws);
  }

  // ---------------------------------------------------------------- admin

  private async adminCreate(request: Request): Promise<Response> {
    if (this.load()) return Response.json({ error: 'exists' }, { status: 409 });
    const body = (await request.json().catch(() => ({}))) as { seed?: unknown };
    const seed = Number.isInteger(body.seed) ? (body.seed as number) : Math.floor(Math.random() * 2 ** 31);
    this.sim = new WorldSim(newWorld(seed, crypto.randomUUID()));
    this.persist();
    return Response.json({ ok: true, seed });
  }

  private async adminImport(request: Request): Promise<Response> {
    const data = (await request.json().catch(() => null)) as SavedWorld | null;
    if (!data || data.version !== 1 || !Number.isInteger(data.seed) || typeof data.salt !== 'string' || !Array.isArray(data.players) || !Array.isArray(data.structures)) {
      return Response.json({ error: 'invalid' }, { status: 400 });
    }
    for (const ws of this.ctx.getWebSockets()) ws.close(1012, 'restore');
    this.names.clear();
    this.stopLoop(false);
    this.sim = new WorldSim(data);
    this.persist();
    return Response.json({ ok: true });
  }

  // ---------------------------------------------------------------- sessions

  private async hello(ws: WebSocket, msg: Extract<ClientMsg, { t: 'hello' }>): Promise<void> {
    const fail = (code: ErrorCode) => {
      this.send(ws, { t: 'error', code });
      ws.close(1008, code);
    };
    if (msg.v !== PROTOCOL_VERSION) return fail('version');
    const sim = this.load();
    if (!sim) return fail('noworld');
    // Cheap pre-check to fail fast; the authoritative check is after the await below, once
    // this call is the only one that can act on `msg.name`'s outcome.
    if (this.limiter.blocked(msg.name, Date.now())) return fail('rate');
    this.pending.add(ws);
    try {
      const hash = await hashPin(msg.pin, sim.salt);
      // The socket closed, or another hello already claimed it, while we were hashing.
      if (!this.pending.has(ws) || this.names.has(ws)) return;
      const now = Date.now();
      if (this.limiter.blocked(msg.name, now)) return fail('rate');
      const existing = sim.getPlayer(msg.name);
      if (existing && existing.pinHash !== hash) {
        this.limiter.fail(msg.name, now);
        return fail('pin');
      }
      this.limiter.succeed(msg.name);
      if (!sim.onlineNames().includes(msg.name) && sim.activeCount() >= MAX_ONLINE) return fail('full');
      // Same name on a new device/tab replaces the old socket (phone reconnects often).
      for (const [other, n] of this.names) {
        if (n !== msg.name) continue;
        this.names.delete(other);
        other.close(4000, 'replaced');
      }
      if (!existing) sim.createPlayer(msg.name, hash);
      this.names.set(ws, msg.name);
      this.send(ws, sim.connect(msg.name));
      this.startLoop();
    } finally {
      this.pending.delete(ws);
    }
  }

  private drop(ws: WebSocket): void {
    const name = this.names.get(ws);
    this.names.delete(ws);
    this.pending.delete(ws);
    this.bad.delete(ws);
    if (!name || !this.sim) return;
    this.sim.markAway(name);
    if (this.sim.activeCount() === 0) this.persist();
  }

  private strike(ws: WebSocket): void {
    const n = (this.bad.get(ws) ?? 0) + 1;
    this.bad.set(ws, n);
    if (n <= MAX_BAD) return;
    this.drop(ws);
    ws.close(1008, 'bad');
  }

  // ---------------------------------------------------------------- loop

  private startLoop(): void {
    if (!this.loop) this.loop = setInterval(() => this.tick(), TICK_DT * 1000);
  }

  private stopLoop(save = true): void {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
    if (save) this.persist();
  }

  private tick(): void {
    try {
      const sim = this.sim;
      if (!sim) return this.stopLoop(false);
      sim.step(TICK_DT);
      for (const [ws, name] of this.names) {
        const snap = sim.snapshotFor(name);
        if (snap) this.send(ws, snap);
      }
      this.flush();
      this.sinceSave += TICK_DT;
      if (this.sinceSave >= SAVE_EVERY) {
        this.sinceSave = 0;
        this.persist();
      }
      // Everyone left and the away grace period ran out: stop so the object can sleep.
      if (sim.onlineNames().length === 0) this.stopLoop();
    } catch (err) {
      console.error('tick failed', err);
    }
  }

  private flush(): void {
    if (!this.sim) return;
    for (const { to, msg } of this.sim.drain()) {
      for (const [ws, name] of this.names) if (to === null || to === name) this.send(ws, msg);
    }
  }

  private send(ws: WebSocket, msg: ServerMsg): void {
    try {
      ws.send(encode(msg));
    } catch {
      this.drop(ws);
    }
  }

  // ---------------------------------------------------------------- storage

  private load(): WorldSim | null {
    if (this.sim) return this.sim;
    const row = this.ctx.storage.sql.exec<{ v: string }>('SELECT v FROM kv WHERE k = ?', 'world').toArray()[0];
    if (row) this.sim = new WorldSim(JSON.parse(row.v) as SavedWorld);
    return this.sim;
  }

  // ponytail: whole world as one JSON row, 1 write per 5 s. Split per section if the blob nears the 2 MB row limit.
  private persist(): void {
    if (this.sim) this.ctx.storage.sql.exec('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', 'world', JSON.stringify(this.sim.save()));
  }
}
