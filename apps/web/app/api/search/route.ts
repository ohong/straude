import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Safe public fields only — never expose email, private settings, etc.
const PUBLIC_USER_FIELDS = "id, username, display_name, bio, avatar_url, is_public";

function quoteIlikePattern(value: string): string {
  const pattern = `%${value.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const escapedValue = pattern.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `"${escapedValue}"`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 50)
    : 20;

  if (q.length < 2 || q.length > 64) {
    return NextResponse.json(
      { error: "Query must be between 2 and 64 characters" },
      { status: 400 }
    );
  }

  const normalizedQuery = q.normalize("NFKC").trim();
  if (normalizedQuery.includes("*")) {
    return NextResponse.json(
      { error: "Query contains unsupported characters" },
      { status: 400 },
    );
  }
  const searchableCharacters = normalizedQuery.match(/[\p{L}\p{N}_-]/gu)?.length ?? 0;
  if (searchableCharacters < 2) {
    return NextResponse.json(
      { error: "Query must contain at least 2 searchable characters" },
      { status: 400 },
    );
  }
  const pattern = quoteIlikePattern(normalizedQuery);

  // Search by username, display name, or github_username
  const { data: users, error } = await supabase
    .from("users")
    .select(PUBLIC_USER_FIELDS)
    .eq("is_public", true)
    .or(`username.ilike.${pattern},display_name.ilike.${pattern},github_username.ilike.${pattern}`)
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: users ?? [] });
}
