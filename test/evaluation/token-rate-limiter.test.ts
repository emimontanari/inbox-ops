import { describe, expect, it } from "vitest";
import { createTokenRateLimiter } from "../../src/evaluation/token-rate-limiter.js";

// Fake time: sleeping advances the clock instead of waiting.
function fakeTime(start = 0) {
  let current = start;
  const sleeps: number[] = [];
  return {
    now: () => current,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      current += ms;
    },
    advance: (ms: number) => {
      current += ms;
    },
    sleeps,
  };
}

describe("TokenRateLimiter", () => {
  it("does not wait while the next request fits in the per-minute budget", async () => {
    const time = fakeTime();
    const limiter = createTokenRateLimiter({ tokensPerMinute: 1000, now: time.now, sleep: time.sleep });
    limiter.record(300);

    await limiter.waitForCapacity(500);

    expect(time.sleeps).toEqual([]);
  });

  it("waits until the oldest usage leaves the one-minute window", async () => {
    const time = fakeTime();
    const limiter = createTokenRateLimiter({ tokensPerMinute: 1000, now: time.now, sleep: time.sleep });
    limiter.record(700);
    time.advance(10_000);

    await limiter.waitForCapacity(500);

    expect(time.sleeps).toEqual([50_000]);
  });

  it("does not wait forever when one request alone exceeds the budget", async () => {
    const time = fakeTime();
    const limiter = createTokenRateLimiter({ tokensPerMinute: 1000, now: time.now, sleep: time.sleep });

    await limiter.waitForCapacity(2000);

    expect(time.sleeps).toEqual([]);
  });
});
