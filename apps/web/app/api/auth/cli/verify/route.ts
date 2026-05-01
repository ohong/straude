import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from("cli_auth_codes")
    .update({ user_id: user.id, status: "completed" })
    .eq("code", code)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Authorization code is invalid or expired" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
