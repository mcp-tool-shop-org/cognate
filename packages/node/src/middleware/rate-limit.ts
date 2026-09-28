/**
 * Token-Bucket Rate Limiting
 *
 * Pure-function rate limiter. Callers maintain the bucket state.
 * No clock access — the timestamp is provided by the caller.
 */

export interface RateLimitConfig {
  readonly maxTokens: number;
  readonly refillRate: number; // tokens per second
}

export interface RateLimitState {
  tokens: number;
  lastRefill: number; // timestamp in ms
}

export function createRateLimitState(): RateLimitState {
  return { tokens: 0, lastRefill: 0 };
}

/**
 * Check if a request is allowed under the rate limit.
 * Returns { allowed, newState }.
 */
export function checkRateLimit(
  state: RateLimitState,
  config: RateLimitConfig,
  nowMs: number
): { allowed: boolean; state: RateLimitState } {
  const elapsedMs = nowMs - state.lastRefill;
  const tokensToAdd = (elapsedMs / 1000) * config.refillRate;
  const newTokens = Math.min(config.maxTokens, state.tokens + tokensToAdd);

  if (newTokens < 1) {
    return { allowed: false, state: { tokens: newTokens, lastRefill: nowMs } };
  }

  return {
    allowed: true,
    state: { tokens: newTokens - 1, lastRefill: nowMs },
  };
}
