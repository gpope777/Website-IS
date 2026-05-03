const WINDOW_MS = 60_000;
const MAX_REQUESTS = 3;

const buckets = new Map<string, number[]>();

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (buckets.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS) {
    buckets.set(ip, timestamps);
    return false;
  }

  timestamps.push(now);
  buckets.set(ip, timestamps);

  // Periodic cleanup: every ~100 calls, sweep for stale empty buckets
  if (Math.random() < 0.01) {
    for (const [k, v] of buckets) {
      const fresh = v.filter((t) => now - t < WINDOW_MS);
      if (fresh.length === 0) buckets.delete(k);
      else if (fresh.length !== v.length) buckets.set(k, fresh);
    }
  }

  return true;
}

export function resetRateLimit(): void {
  buckets.clear();
}
