import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username") ?? "";

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json({ available: false, reason: "invalid" });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  return NextResponse.json({ available: !data });
}
