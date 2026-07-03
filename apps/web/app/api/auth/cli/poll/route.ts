import { NextResponse } from "next/server";
import { createCliToken, hashCliDeviceSecret } from "@/lib/api/cli-auth";
import { getServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  let body: { code?: unknown; poll_secret?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }
  const pollSecret = typeof body.poll_secret === "string" ? body.poll_secret.trim() : "";
  if (!pollSecret) {
    return NextResponse.json({ error: "Missing poll_secret" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const pollSecretHash = hashCliDeviceSecret(pollSecret);

  const { data: authCode, error } = await supabase
    .from("cli_auth_codes")
    .select("*")
    .eq("code", code)
    .eq("poll_secret_hash", pollSecretHash)
    .neq("status", "expired")
    .single();

  if (error || !authCode) {
    return NextResponse.json({ status: "expired" });
  }

  // Check if expired
  if (new Date(authCode.expires_at) < new Date()) {
    if (authCode.status === "pending" || authCode.status === "completed") {
      await supabase
        .from("cli_auth_codes")
        .update({ status: "expired" })
        .eq("id", authCode.id)
        .eq("poll_secret_hash", pollSecretHash);
    }
    return NextResponse.json({ status: "expired" });
  }

  if (authCode.status === "expired") {
    return NextResponse.json({ status: "expired" });
  }

  if (authCode.status === "pending") {
    return NextResponse.json({ status: "pending" });
  }

  if (authCode.status === "completed" && authCode.user_id) {
    const redeemedAt = new Date().toISOString();
    const { data: redeemed, error: redeemError } = await supabase
      .from("cli_auth_codes")
      .update({ status: "used", redeemed_at: redeemedAt })
      .eq("id", authCode.id)
      .eq("status", "completed")
      .eq("poll_secret_hash", pollSecretHash)
      .is("redeemed_at", null)
      .select("user_id")
      .single();

    if (redeemError || !redeemed?.user_id) {
      return NextResponse.json({ status: "expired" });
    }

    // Fetch username for the token payload
    const { data: user } = await supabase
      .from("users")
      .select("username")
      .eq("id", redeemed.user_id)
      .single();

    const token = createCliToken(redeemed.user_id, user?.username ?? null);

    return NextResponse.json({
      status: "completed",
      token,
      username: user?.username ?? null,
    });
  }

  return NextResponse.json({ status: "expired" });
}
