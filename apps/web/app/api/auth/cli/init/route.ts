import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { createCliDeviceSecret, hashCliDeviceSecret } from "@/lib/api/cli-auth";
import { rateLimit } from "@/lib/rate-limit";
import { getServiceClient } from "@/lib/supabase/service";

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

  const limited = await rateLimit("cli-auth-init", ip, { limit: 5 });
  if (limited) return limited;

  const supabase = getServiceClient();
  const code = generateCode();
  const pollSecret = createCliDeviceSecret();
  const verifySecret = createCliDeviceSecret();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabase.from("cli_auth_codes").insert({
    code,
    poll_secret_hash: hashCliDeviceSecret(pollSecret),
    verify_secret_hash: hashCliDeviceSecret(verifySecret),
    status: "pending",
    expires_at: expiresAt,
  });

  if (error) {
    return NextResponse.json({ error: "Failed to create auth code" }, { status: 500 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://straude.com").replace(/\/+$/, "");
  const params = new URLSearchParams({ code, verify_secret: verifySecret });
  const verifyUrl = `${appUrl}/cli/verify?${params.toString()}`;

  return NextResponse.json({ code, verify_url: verifyUrl, poll_secret: pollSecret });
}
