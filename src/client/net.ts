import { encode, type ClientMsg, type ErrorCode, type ServerMsg } from '../shared/protocol';

export type NetStatus =
  | { kind: 'connecting' }
  | { kind: 'online' }
  | { kind: 'reconnecting'; attempt: number }
  | { kind: 'fatal'; code: ErrorCode };

export function backoffMs(attempt: number): number {
  return Math.min(10_000, 500 * 2 ** attempt);
}

export function wsUrl(loc: { protocol: string; host: string }, world: string): string {
  return `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}/ws/${world}`;
}

/** One WebSocket that says hello on every (re)connect and retries with backoff until told a fatal error. */
export class Connection {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private closed = false;
  private timer = 0;

  constructor(
    private readonly url: string,
    private readonly hello: ClientMsg,
    private readonly onMsg: (m: ServerMsg) => void,
    private readonly onStatus: (s: NetStatus) => void,
  ) {
    this.open();
  }

  send(m: ClientMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(encode(m));
  }

  close(): void {
    this.closed = true;
    clearTimeout(this.timer);
    this.ws?.close();
  }

  private open(): void {
    this.onStatus(this.attempt === 0 ? { kind: 'connecting' } : { kind: 'reconnecting', attempt: this.attempt });
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => ws.send(encode(this.hello));
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data)) as ServerMsg;
      if (m.t === 'error') {
        this.closed = true;
        this.onStatus({ kind: 'fatal', code: m.code });
        return;
      }
      if (m.t === 'welcome') {
        this.attempt = 0;
        this.onStatus({ kind: 'online' });
      }
      this.onMsg(m);
    };
    ws.onclose = (e) => {
      if (this.closed || this.ws !== ws) return;
      if (e.code === 4000) {
        this.closed = true;
        this.onStatus({ kind: 'fatal', code: 'replaced' });
        return;
      }
      this.attempt++;
      this.onStatus({ kind: 'reconnecting', attempt: this.attempt });
      this.timer = window.setTimeout(() => this.open(), backoffMs(this.attempt - 1));
    };
  }
}
