import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyCliToken } from "@/lib/api/cli-auth";
import { getServiceClient } from "@/lib/supabase/service";
import { checkAndAwardAchievements } from "@/lib/achievements";
import type { UsageSubmitRequest, UsageSubmitResponse, CcusageDailyEntry } from "@/types";

const MAX_BACKFILL_DAYS = 7;

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
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
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
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://straude.com").replace(/\/+$/, "");
  const results: UsageSubmitResponse["results"] = [];

  for (const entry of body.entries) {
    // Check if a record already exists to determine create vs update
    const { data: existing } = await db
      .from("daily_usage")
      .select("id")
      .eq("user_id", userId)
      .eq("date", entry.date)
      .maybeSingle();

    const action: "created" | "updated" = existing ? "updated" : "created";

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
          model_breakdown: entry.data.modelBreakdown ?? null,
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

    // Build auto-title from usage data (only used for new posts)
    const models = entry.data.models;
    const hasClaude = models?.some((m) => m.includes("claude") || m.includes("opus") || m.includes("sonnet") || m.includes("haiku"));
    const claudeLabel = models?.some((m) => m.includes("opus")) ? "Claude Opus"
      : models?.some((m) => m.includes("sonnet")) ? "Claude Sonnet"
      : models?.some((m) => m.includes("haiku")) ? "Claude Haiku" : null;
    const codexModel = models?.find((m) => /^gpt-/i.test(m) || /^o3/i.test(m) || /^o4/i.test(m));
    const codexLabel = codexModel
      ? /^gpt-/i.test(codexModel)
        ? codexModel.replace(/^gpt/i, "GPT").replace(/-codex$/i, "-Codex")
        : /^o3/i.test(codexModel) ? "o3"
        : /^o4/i.test(codexModel) ? "o4"
        : codexModel
      : null;
    const toolLabels = [claudeLabel, codexLabel].filter(Boolean);
    const modelLabel = toolLabels.length > 0 ? toolLabels.join(" + ") : (hasClaude ? "Claude" : null);
    const dateLabel = new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const costLabel = entry.data.costUSD > 0 ? `, $${entry.data.costUSD.toFixed(2)}` : "";
    const autoTitle = modelLabel ? `${dateLabel} — ${modelLabel}${costLabel}` : `${dateLabel}${costLabel}`;

    // Create or update post linked to the daily_usage record
    // Use separate insert/update to avoid overwriting user-edited titles
    let post: { id: string } | null = null;
    let postError: any = null;

    const { data: existingPost } = await db
      .from("posts")
      .select("id")
      .eq("daily_usage_id", usage.id)
      .maybeSingle();

    if (existingPost) {
      const { data, error } = await db
        .from("posts")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", existingPost.id)
        .select("id")
        .single();
      post = data;
      postError = error;
    } else {
      const { data, error } = await db
        .from("posts")
        .insert({
          user_id: userId,
          daily_usage_id: usage.id,
          title: autoTitle,
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      post = data;
      postError = error;
    }

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
      action,
    });
  }

  checkAndAwardAchievements(userId, "usage").catch(() => {});

  return NextResponse.json({ results } satisfies UsageSubmitResponse);
}
