const WINDOW_MS = 60_000;

type Usage = { at: number; tokens: number };

export type TokenRateLimiter = {
  // Resolves once a request of the estimated size fits in the last minute's budget.
  waitForCapacity(estimatedTokens: number): Promise<void>;
  record(tokens: number): void;
};

// Sliding one-minute window over tokens actually used, to stay under a provider's
// tokens-per-minute limit. Time is injected so tests do not wait for real.
export function createTokenRateLimiter(deps: {
  tokensPerMinute: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): TokenRateLimiter {
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let usages: Usage[] = [];

  const usedInWindow = (): number => {
    const windowStart = now() - WINDOW_MS;
    usages = usages.filter((usage) => usage.at > windowStart);
    return usages.reduce((total, usage) => total + usage.tokens, 0);
  };

  return {
    async waitForCapacity(estimatedTokens) {
      // An empty window is the best we can do, even if one request exceeds the budget alone.
      while (usedInWindow() + estimatedTokens > deps.tokensPerMinute && usages.length > 0) {
        const oldest = usages[0];
        if (oldest === undefined) return;
        await sleep(oldest.at + WINDOW_MS - now());
      }
    },
    record(tokens) {
      usages.push({ at: now(), tokens });
    },
  };
}
