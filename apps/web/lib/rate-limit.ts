import { NextResponse } from "next/server";

/**
 * In-memory sliding window rate limiter keyed by user ID.
 *
 * Each limiter instance maintains its own request map, so different
 * endpoints can have independent limits. Timestamps older than the
 * window are pruned on every check to bound memory growth.
 */

interface RateLimitConfig {
  /** Maximum requests allowed within the window. */
  limit: number;
  /** Window size in seconds (default: 60). */
  windowSeconds?: number;
}

interface CheckResult {
  allowed: boolean;
  /** Seconds until the earliest request in the window expires. */
  retryAfterSeconds: number;
}

class RateLimiter {
  private requests = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(config: RateLimitConfig) {
    this.limit = config.limit;
    this.windowMs = (config.windowSeconds ?? 60) * 1000;
  }

  check(userId: string): CheckResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.requests.get(userId);
    if (timestamps) {
      // Prune expired entries
      timestamps = timestamps.filter((t) => t > windowStart);
      this.requests.set(userId, timestamps);
    } else {
      timestamps = [];
    }

    if (timestamps.length >= this.limit) {
      const oldestInWindow = timestamps[0]!;
      const retryAfterMs = oldestInWindow + this.windowMs - now;
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }

    timestamps.push(now);
    this.requests.set(userId, timestamps);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

// Shared limiter instances (one per endpoint group)
const limiters = new Map<string, RateLimiter>();

function getLimiter(name: string, config: RateLimitConfig): RateLimiter {
  let limiter = limiters.get(name);
  if (!limiter) {
    limiter = new RateLimiter(config);
    limiters.set(name, limiter);
  }
  return limiter;
}

/** Reset all limiter state. Useful in tests. */
export function resetRateLimiters(): void {
  limiters.clear();
}

/**
 * Check rate limit for a user. Returns a 429 NextResponse if the limit
 * is exceeded, or `null` if the request is allowed.
 *
 * Usage:
 * ```ts
 * const limited = rateLimit("upload", userId, { limit: 10 });
 * if (limited) return limited;
 * ```
 */
export function rateLimit(
  name: string,
  userId: string,
  config: RateLimitConfig,
): NextResponse | null {
  const limiter = getLimiter(name, config);
  const result = limiter.check(userId);

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(result.retryAfterSeconds) },
      },
    );
  }

  return null;
}
