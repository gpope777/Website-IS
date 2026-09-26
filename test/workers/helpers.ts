import { exports } from 'cloudflare:workers';
import { PROTOCOL_VERSION, type ClientMsg, type ServerMsg } from '../../src/shared/protocol';

export const BASE = 'http://bosque.test';
export const ADMIN = { Authorization: 'Bearer test-admin' };

export function createWorld(world: string, seed = 42): Promise<Response> {
  return exports.default.fetch(`${BASE}/admin/${world}/create`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ seed }) });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Client {
  readonly msgs: ServerMsg[] = [];
  private constructor(readonly ws: WebSocket) {
    ws.addEventListener('message', (e) => {
      this.msgs.push(JSON.parse(String(e.data)) as ServerMsg);
    });
  }

  static async open(world: string): Promise<Client> {
    const res = await exports.default.fetch(`${BASE}/ws/${world}`, { headers: { Upgrade: 'websocket' } });
    const ws = res.webSocket;
    if (!ws) throw new Error(`no websocket, status ${res.status}`);
    ws.accept();
    return new Client(ws);
  }

  send(m: ClientMsg): void {
    this.ws.send(JSON.stringify(m));
  }

  /** Waits for (and removes) the first message of type t. */
  async next<T extends ServerMsg['t']>(t: T, timeout = 3000): Promise<Extract<ServerMsg, { t: T }>> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const i = this.msgs.findIndex((m) => m.t === t);
      if (i >= 0) return this.msgs.splice(i, 1)[0] as Extract<ServerMsg, { t: T }>;
      await sleep(20);
    }
    throw new Error(`timeout waiting for ${t}; got ${this.msgs.map((m) => m.t).join(',')}`);
  }

  async join(name: string, pin = '1234') {
    this.send({ t: 'hello', v: PROTOCOL_VERSION, name, pin });
    return this.next('welcome');
  }

  close(): void {
    this.ws.close(1000, 'bye');
  }
}
