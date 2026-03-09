import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";

// Safe public fields only — never expose email, private settings, etc.
const PUBLIC_USER_FIELDS = "id, username, display_name, bio, avatar_url, is_public";

/** Strip characters that could break PostgREST filter syntax */
function sanitizeFilter(s: string): string {
  return s.replace(/[,()\\]/g, "");
}

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

  const safe = sanitizeFilter(q);

  // Search by username, display name, or github_username
  const { data: users, error } = await supabase
    .from("users")
    .select(PUBLIC_USER_FIELDS)
    .eq("is_public", true)
    .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%,github_username.ilike.%${safe}%`)
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let results = users ?? [];

  // If query looks like an email, also search by exact email match.
  // Uses service client because lookup_user_id_by_email is service_role only
  // (it queries auth.users which is not accessible to authenticated role).
  if (q.includes("@") && results.length === 0) {
    const service = getServiceClient();
    const { data: userId } = await service.rpc("lookup_user_id_by_email", {
      p_email: q,
    });
    if (userId) {
      // Use service client to find user even if they're private
      const { data: emailUser } = await service
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
