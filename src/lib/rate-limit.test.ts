import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit, resetRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimit();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("allows up to 3 requests per minute from the same IP", () => {
    expect(checkRateLimit("1.1.1.1")).toBe(true);
    expect(checkRateLimit("1.1.1.1")).toBe(true);
    expect(checkRateLimit("1.1.1.1")).toBe(true);
  });

  it("blocks the 4th request within the same minute", () => {
    checkRateLimit("1.1.1.1");
    checkRateLimit("1.1.1.1");
    checkRateLimit("1.1.1.1");
    expect(checkRateLimit("1.1.1.1")).toBe(false);
  });

  it("tracks IPs independently", () => {
    checkRateLimit("1.1.1.1");
    checkRateLimit("1.1.1.1");
    checkRateLimit("1.1.1.1");
    expect(checkRateLimit("2.2.2.2")).toBe(true);
  });

  it("resets after 60 seconds", () => {
    checkRateLimit("1.1.1.1");
    checkRateLimit("1.1.1.1");
    checkRateLimit("1.1.1.1");
    vi.advanceTimersByTime(61_000);
    expect(checkRateLimit("1.1.1.1")).toBe(true);
  });
});
