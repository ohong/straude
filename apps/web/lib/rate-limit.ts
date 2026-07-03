import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";

/**
 * Durable fixed-window rate limiter backed by Supabase.
 *
 * The database function owns the atomic counter update so limits are shared
 * across serverless instances instead of resetting with each process.
 */

interface RateLimitConfig {
  /** Maximum requests allowed within the window. */
  limit: number;
  /** Window size in seconds (default: 60). */
  windowSeconds?: number;
}

interface RateLimitRpcResult {
  allowed: boolean;
  retry_after_seconds: number;
}

/** Reset all limiter state. Useful in tests. */
export function resetRateLimiters(): void {
  // Durable limiter state lives in Supabase. Tests mock the service client
  // instead of clearing production state.
}

/**
 * Check rate limit for a user. Returns a 429 NextResponse if the limit
 * is exceeded, or `null` if the request is allowed.
 *
 * Usage:
 * ```ts
 * const limited = await rateLimit("upload", userId, { limit: 10 });
 * if (limited) return limited;
 * ```
 */
export async function rateLimit(
  name: string,
  subject: string,
  config: RateLimitConfig,
): Promise<NextResponse | null> {
  const db = getServiceClient();
  const { data, error } = await db.rpc("check_rate_limit", {
    p_name: name,
    p_subject: subject,
    p_limit: config.limit,
    p_window_seconds: config.windowSeconds ?? 60,
  });

  if (error) {
    return NextResponse.json(
      { error: "Rate limit check failed" },
      { status: 503 },
    );
  }

  const row = Array.isArray(data)
    ? (data[0] as RateLimitRpcResult | undefined)
    : (data as RateLimitRpcResult | null);
  const allowed = row?.allowed ?? false;
  const retryAfterSeconds = Math.max(1, row?.retry_after_seconds ?? config.windowSeconds ?? 60);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      },
    );
  }

  return null;
}
