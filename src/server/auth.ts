/**
 * ponytail: 4-digit PIN + per-world salt + SHA-256. Online guessing is rate-limited; the hash only lives in
 * admin-only storage. Upgrade to PBKDF2 or real accounts if worlds ever go public.
 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Per-name backoff: the Nth failure (N >= free) locks for base * 2^(N-free), capped. In-memory: resets if the room restarts. */
export class RateLimiter {
  private readonly state = new Map<string, { fails: number; until: number }>();

  constructor(
    private readonly free = 5,
    private readonly baseMs = 30_000,
    private readonly maxMs = 15 * 60_000,
  ) {}

  blocked(key: string, now: number): boolean {
    const s = this.state.get(key);
    return !!s && now < s.until;
  }

  fail(key: string, now: number): void {
    const s = this.state.get(key) ?? { fails: 0, until: 0 };
    s.fails++;
    if (s.fails >= this.free) s.until = now + Math.min(this.maxMs, this.baseMs * 2 ** (s.fails - this.free));
    this.state.set(key, s);
  }

  succeed(key: string): void {
    this.state.delete(key);
  }
}
