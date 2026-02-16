import { NextResponse } from "next/server";
import { createCliToken } from "@/lib/api/cli-auth";
import { getServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { code } = body;
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: authCode, error } = await supabase
    .from("cli_auth_codes")
    .select("*")
    .eq("code", code)
    .single();

  if (error || !authCode) {
    return NextResponse.json({ status: "expired" });
  }

  // Check if expired
  if (new Date(authCode.expires_at) < new Date()) {
    // Mark as expired if still pending
    if (authCode.status === "pending") {
      await supabase
        .from("cli_auth_codes")
        .update({ status: "expired" })
        .eq("id", authCode.id);
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
    // Fetch username for the token payload
    const { data: user } = await supabase
      .from("users")
      .select("username")
      .eq("id", authCode.user_id)
      .single();

    const token = createCliToken(authCode.user_id, user?.username ?? null);

    return NextResponse.json({
      status: "completed",
      token,
      username: user?.username ?? null,
    });
  }

  return NextResponse.json({ status: "expired" });
}
