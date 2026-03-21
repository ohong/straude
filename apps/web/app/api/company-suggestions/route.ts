import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_SUBMISSIONS_PER_24H = 5;

function validateUrl(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return trimmed;
  } catch {
    return null;
  }
}

function validateText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) return null;
  return trimmed;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    company_name?: unknown;
    company_url?: unknown;
    policy_description?: unknown;
    source_url?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companyName = validateText(body.company_name, 2, 200);
  if (!companyName) {
    return NextResponse.json(
      { error: "Company name is required (2-200 characters)" },
      { status: 400 },
    );
  }

  const companyUrl = validateUrl(body.company_url, 500);
  if (!companyUrl) {
    return NextResponse.json(
      { error: "A valid company URL is required" },
      { status: 400 },
    );
  }

  const policyDescription = validateText(body.policy_description, 10, 500);
  if (!policyDescription) {
    return NextResponse.json(
      { error: "Policy description is required (10-500 characters)" },
      { status: 400 },
    );
  }

  const sourceUrl = validateUrl(body.source_url, 500);
  if (!sourceUrl) {
    return NextResponse.json(
      { error: "A valid source URL is required" },
      { status: 400 },
    );
  }

  // Rate limit
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("company_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if ((count ?? 0) >= MAX_SUBMISSIONS_PER_24H) {
    return NextResponse.json(
      { error: "Daily limit reached (5/24h). Try again later." },
      { status: 429 },
    );
  }

  const { data, error } = await supabase
    .from("company_suggestions")
    .insert({
      user_id: user.id,
      company_name: companyName,
      company_url: companyUrl,
      policy_description: policyDescription,
      source_url: sourceUrl,
      status: "new",
    })
    .select("id,status,created_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to submit suggestion" },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
