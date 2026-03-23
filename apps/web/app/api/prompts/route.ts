import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_PROMPT_LENGTH = 2000;
const MIN_PROMPT_LENGTH = 10;
const MAX_SUBMISSIONS_PER_24H = 10;

function normalizeOptionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit")) || 20, 1), 50);
  const offset = Math.max(Number(request.nextUrl.searchParams.get("offset")) || 0, 0);

  const { data, error } = await supabase
    .from("prompt_submissions")
    .select(
      "id,prompt,is_anonymous,status,created_at,user:users!prompt_submissions_user_id_fkey(username)"
    )
    .eq("is_public", true)
    .eq("is_hidden", false)
    .not("status", "in", "(shipped,rejected)")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prompts: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { prompt?: unknown; anonymous?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prompt = normalizeOptionalText(body.prompt, MAX_PROMPT_LENGTH);
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  if (prompt.length < MIN_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `Prompt must be at least ${MIN_PROMPT_LENGTH} characters` },
      { status: 400 },
    );
  }

  const anonymous = body.anonymous === true;
  if (body.anonymous !== undefined && typeof body.anonymous !== "boolean") {
    return NextResponse.json({ error: "anonymous must be a boolean" }, { status: 400 });
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error: countError } = await supabase
    .from("prompt_submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if ((count ?? 0) >= MAX_SUBMISSIONS_PER_24H) {
    return NextResponse.json(
      { error: "Daily limit reached (10/24h). Try again later." },
      { status: 429 },
    );
  }

  const { data, error } = await supabase
    .from("prompt_submissions")
    .insert({
      user_id: user.id,
      prompt,
      is_anonymous: anonymous,
      status: "new",
    })
    .select("id,status,is_anonymous,created_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to submit prompt" },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
