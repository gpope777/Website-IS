import { describe, expect, it } from 'vitest';
import { hashPin, RateLimiter } from './auth';

describe('hashPin', () => {
  it('is stable, salted and not the PIN', async () => {
    const a = await hashPin('1234', 'salt-a');
    expect(a).toBe(await hashPin('1234', 'salt-a'));
    expect(a).not.toBe(await hashPin('1234', 'salt-b'));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('RateLimiter', () => {
  it('allows 4 failures, blocks on the 5th, backs off, and resets on success', () => {
    const r = new RateLimiter(5, 1000, 8000);
    for (let i = 0; i < 4; i++) r.fail('Ana', 0);
    expect(r.blocked('Ana', 0)).toBe(false);
    r.fail('Ana', 0);
    expect(r.blocked('Ana', 999)).toBe(true);
    expect(r.blocked('Ana', 1000)).toBe(false);
    r.fail('Ana', 1000); // 6th → 2000 ms
    expect(r.blocked('Ana', 2999)).toBe(true);
    expect(r.blocked('Ana', 3000)).toBe(false);
    expect(r.blocked('Leo', 0)).toBe(false);
    r.succeed('Ana');
    expect(r.blocked('Ana', 1001)).toBe(false);
  });
});
