import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const limit = Math.min(
    Number(request.nextUrl.searchParams.get("limit") ?? 20),
    50
  );

  if (q.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .not("username", "is", null)
    .ilike("username", `%${q}%`)
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: users ?? [] });
}
