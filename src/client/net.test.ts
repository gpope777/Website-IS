import { describe, expect, it } from 'vitest';
import { backoffMs, wsUrl } from './net';

describe('net helpers', () => {
  it('backs off exponentially up to 10 s', () => {
    expect([0, 1, 2, 3].map(backoffMs)).toEqual([500, 1000, 2000, 4000]);
    expect(backoffMs(20)).toBe(10_000);
  });

  it('builds ws urls on the same host', () => {
    expect(wsUrl({ protocol: 'https:', host: 'bosque.x.workers.dev' }, 'familia')).toBe('wss://bosque.x.workers.dev/ws/familia');
    expect(wsUrl({ protocol: 'http:', host: 'localhost:5173' }, 'test')).toBe('ws://localhost:5173/ws/test');
  });
});
