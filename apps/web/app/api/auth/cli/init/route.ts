import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
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

export async function POST() {
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
