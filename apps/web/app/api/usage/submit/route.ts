import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { verifyCliToken } from "@/lib/api/cli-auth";
import type { UsageSubmitRequest, UsageSubmitResponse, CcusageDailyEntry } from "@/types";

const MAX_BACKFILL_DAYS = 7;

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

function isValidDate(dateStr: string): boolean {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

function isWithinBackfillWindow(dateStr: string): boolean {
  const now = new Date();
  const target = new Date(dateStr);
  const diffMs = now.getTime() - target.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= -1 && diffDays <= MAX_BACKFILL_DAYS;
}

function validateEntry(entry: CcusageDailyEntry): string | null {
  if (entry.costUSD < 0) return `Negative cost for ${entry.date}`;
  if (entry.inputTokens < 0) return `Negative input tokens for ${entry.date}`;
  if (entry.outputTokens < 0) return `Negative output tokens for ${entry.date}`;
  if (entry.totalTokens < 0) return `Negative total tokens for ${entry.date}`;
  return null;
}

async function resolveUserId(request: Request): Promise<string | null> {
  // Try CLI JWT first
  const authHeader = request.headers.get("authorization");
  const cliUserId = verifyCliToken(authHeader);
  if (cliUserId) return cliUserId;

  // Fall back to Supabase session (web)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function POST(request: Request) {
  let body: UsageSubmitRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.entries || !Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json({ error: "No entries provided" }, { status: 400 });
  }

  if (!body.source || !["cli", "web"].includes(body.source)) {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }

  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate all entries
  for (const entry of body.entries) {
    if (!isValidDate(entry.date)) {
      return NextResponse.json({ error: `Invalid date: ${entry.date}` }, { status: 400 });
    }
    if (!isWithinBackfillWindow(entry.date)) {
      return NextResponse.json(
        { error: `Date ${entry.date} is outside the ${MAX_BACKFILL_DAYS}-day backfill window` },
        { status: 400 },
      );
    }
    const validationError = validateEntry(entry.data);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
  }

  const db = getServiceClient();
  const isVerified = body.source === "cli";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://straude.com";
  const results: UsageSubmitResponse["results"] = [];

  for (const entry of body.entries) {
    const { data: usage, error: usageError } = await db
      .from("daily_usage")
      .upsert(
        {
          user_id: userId,
          date: entry.date,
          cost_usd: entry.data.costUSD,
          input_tokens: entry.data.inputTokens,
          output_tokens: entry.data.outputTokens,
          cache_creation_tokens: entry.data.cacheCreationTokens,
          cache_read_tokens: entry.data.cacheReadTokens,
          total_tokens: entry.data.totalTokens,
          models: entry.data.models,
          is_verified: isVerified,
          raw_hash: body.hash ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,date" },
      )
      .select("id")
      .single();

    if (usageError || !usage) {
      return NextResponse.json(
        { error: `Failed to upsert usage for ${entry.date}: ${usageError?.message}` },
        { status: 500 },
      );
    }

    // Upsert post linked to the daily_usage record
    const { data: post, error: postError } = await db
      .from("posts")
      .upsert(
        {
          user_id: userId,
          daily_usage_id: usage.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "daily_usage_id" },
      )
      .select("id")
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: `Failed to create post for ${entry.date}: ${postError?.message}` },
        { status: 500 },
      );
    }

    results.push({
      date: entry.date,
      usage_id: usage.id,
      post_id: post.id,
      post_url: `${appUrl}/post/${post.id}`,
    });
  }

  return NextResponse.json({ results } satisfies UsageSubmitResponse);
}
