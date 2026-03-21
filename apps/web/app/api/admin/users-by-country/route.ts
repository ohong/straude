import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

export async function GET() {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  if (!user || !isAdmin(user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from("users")
    .select("country")
    .not("country", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const c = row.country as string;
    counts[c] = (counts[c] || 0) + 1;
  }

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const rows = Object.entries(counts)
    .map(([country, user_count]) => ({
      country,
      user_count,
      percentage: Math.round((user_count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.user_count - a.user_count);

  return NextResponse.json(rows);
}
