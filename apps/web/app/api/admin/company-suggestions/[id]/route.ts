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

function normalizeOptionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  if (!user || !isAdmin(user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  let body: {
    status?: unknown;
    is_hidden?: unknown;
    admin_notes?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let changed = false;

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !VALID_STATUSES.includes(body.status as CompanySuggestionStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
    changed = true;
  }

  if (body.is_hidden !== undefined) {
    if (typeof body.is_hidden !== "boolean") {
      return NextResponse.json({ error: "is_hidden must be a boolean" }, { status: 400 });
    }
    updates.is_hidden = body.is_hidden;
    changed = true;
  }

  if (body.admin_notes !== undefined) {
    updates.admin_notes = normalizeOptionalText(body.admin_notes, 2000);
    changed = true;
  }

  if (!changed) {
    return NextResponse.json(
      { error: "Provide at least one editable field" },
      { status: 400 },
    );
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from("company_suggestions")
    .update(updates)
    .eq("id", id)
    .select(
      "id,user_id,company_name,company_url,policy_description,source_url,status,is_hidden,admin_notes,created_at,updated_at,reviewed_at,user:users!company_suggestions_user_id_fkey(username,display_name)"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ suggestion: data });
}
