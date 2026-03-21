import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import type { CompanySuggestionStatus } from "@/types";

const VALID_STATUSES: CompanySuggestionStatus[] = [
  "new",
  "accepted",
  "rejected",
  "published",
];

export async function GET(request: NextRequest) {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  if (!user || !isAdmin(user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit")) || 50, 1), 200);
  const offset = Math.max(Number(request.nextUrl.searchParams.get("offset")) || 0, 0);
  const statusFilter = request.nextUrl.searchParams.get("status");

  let query = db
    .from("company_suggestions")
    .select(
      "id,user_id,company_name,company_url,policy_description,source_url,status,is_hidden,admin_notes,created_at,updated_at,reviewed_at,user:users!company_suggestions_user_id_fkey(username,display_name)"
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (statusFilter && statusFilter !== "all") {
    if (!VALID_STATUSES.includes(statusFilter as CompanySuggestionStatus)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }
    query = query.eq("status", statusFilter);
  }

  const [rowsRes, countsRes] = await Promise.all([
    query,
    db.from("company_suggestions").select("status,is_hidden"),
  ]);

  if (rowsRes.error || countsRes.error) {
    return NextResponse.json(
      { error: rowsRes.error?.message ?? countsRes.error?.message },
      { status: 500 },
    );
  }

  const counts = {
    all: 0,
    new: 0,
    accepted: 0,
    rejected: 0,
    published: 0,
    hidden: 0,
  };

  for (const row of countsRes.data ?? []) {
    counts.all += 1;
    if (row.is_hidden) counts.hidden += 1;
    const status = row.status as CompanySuggestionStatus;
    if (status in counts) {
      counts[status as keyof typeof counts] += 1;
    }
  }

  return NextResponse.json({
    suggestions: rowsRes.data ?? [],
    counts,
  });
}
