import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Safe public fields only — never expose email, private settings, etc.
const PUBLIC_USER_FIELDS = "id, username, display_name, bio, avatar_url, is_public";

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

  // Search by username or github_username
  const { data: users, error } = await supabase
    .from("users")
    .select(PUBLIC_USER_FIELDS)
    .not("username", "is", null)
    .eq("is_public", true)
    .or(`username.ilike.%${q}%,github_username.ilike.%${q}%`)
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let results = users ?? [];

  // If query looks like an email, also search by exact email match
  if (q.includes("@") && results.length === 0) {
    const { data: userId } = await supabase.rpc("lookup_user_id_by_email", {
      p_email: q,
    });
    if (userId) {
      // Don't require username — user may not have onboarded yet
      const { data: emailUser } = await supabase
        .from("users")
        .select(PUBLIC_USER_FIELDS)
        .eq("id", userId)
        .maybeSingle();
      if (emailUser) {
        results = [emailUser];
      }
    }
  }

  return NextResponse.json({ users: results });
}
