import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { getServiceClient } from "@/lib/supabase/service";

// Simple in-process rate limiter: max 5 requests per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 for readability
  let part1 = "";
  let part2 = "";
  const bytes = randomBytes(8);
  for (let i = 0; i < 4; i++) {
    part1 += chars[bytes[i]! % chars.length];
    part2 += chars[bytes[i + 4]! % chars.length];
  }
  return `${part1}-${part2}`;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429 }
    );
  }

  const supabase = getServiceClient();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabase.from("cli_auth_codes").insert({
    code,
    status: "pending",
    expires_at: expiresAt,
  });

  if (error) {
    return NextResponse.json({ error: "Failed to create auth code" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://straude.com";
  const verifyUrl = `${appUrl}/cli/verify?code=${code}`;

  return NextResponse.json({ code, verify_url: verifyUrl });
}
