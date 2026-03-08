import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyCliToken } from "@/lib/api/cli-auth";
import { getServiceClient } from "@/lib/supabase/service";
import { checkAndAwardAchievements } from "@/lib/achievements";
import { rateLimit } from "@/lib/rate-limit";
import type { UsageSubmitRequest, UsageSubmitResponse, CcusageDailyEntry, ModelBreakdownEntry } from "@/types";

const MAX_BACKFILL_DAYS = 7;

function isValidDate(dateStr: string): boolean {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

function isWithinBackfillWindow(dateStr: string, maxBackfillDays: number): boolean {
  const now = new Date();
  const target = new Date(dateStr);
  const diffMs = now.getTime() - target.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= -1 && diffDays <= maxBackfillDays;
}

function validateEntry(entry: CcusageDailyEntry): string | null {
  if (entry.costUSD < 0) return `Negative cost for ${entry.date}`;
  if (entry.inputTokens < 0) return `Negative input tokens for ${entry.date}`;
  if (entry.outputTokens < 0) return `Negative output tokens for ${entry.date}`;
  if (entry.totalTokens < 0) return `Negative total tokens for ${entry.date}`;
  return null;
}

interface AuthContext {
  userId: string;
  source: "cli" | "web";
}

async function resolveAuthContext(request: Request): Promise<AuthContext | null> {
  // Try CLI JWT first
  const authHeader = request.headers.get("authorization");
  const cliUserId = verifyCliToken(authHeader);
  if (cliUserId) return { userId: cliUserId, source: "cli" };

  // Fall back to Supabase session (web)
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return null;
    return { userId: user.id, source: "web" };
  } catch {
    return null;
  }
}

interface DeviceUsageRow {
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
  models: string[];
  model_breakdown: ModelBreakdownEntry[] | null;
}

/**
 * Aggregate multiple device_usage rows into a single daily_usage summary.
 * SUMs numeric fields, unions models (deduplicated), merges model_breakdowns
 * by summing cost_usd per model name.
 */
export function aggregateDeviceRows(rows: DeviceUsageRow[]) {
  let cost_usd = 0;
  let input_tokens = 0;
  let output_tokens = 0;
  let cache_creation_tokens = 0;
  let cache_read_tokens = 0;
  let total_tokens = 0;
  const modelsSet = new Set<string>();
  const breakdownMap = new Map<string, number>();

  for (const row of rows) {
    cost_usd += Number(row.cost_usd);
    input_tokens += Number(row.input_tokens);
    output_tokens += Number(row.output_tokens);
    cache_creation_tokens += Number(row.cache_creation_tokens ?? 0);
    cache_read_tokens += Number(row.cache_read_tokens ?? 0);
    total_tokens += Number(row.total_tokens);

    if (Array.isArray(row.models)) {
      for (const m of row.models) modelsSet.add(m);
    }
    if (Array.isArray(row.model_breakdown)) {
      for (const entry of row.model_breakdown) {
        breakdownMap.set(entry.model, (breakdownMap.get(entry.model) ?? 0) + entry.cost_usd);
      }
    }
  }

  const models = [...modelsSet];
  const model_breakdown: ModelBreakdownEntry[] = breakdownMap.size > 0
    ? [...breakdownMap.entries()].map(([model, cost]) => ({ model, cost_usd: cost }))
    : [];

  return {
    cost_usd,
    input_tokens,
    output_tokens,
    cache_creation_tokens,
    cache_read_tokens,
    total_tokens,
    models,
    model_breakdown: model_breakdown.length > 0 ? model_breakdown : null,
    session_count: rows.length,
  };
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

  const auth = await resolveAuthContext(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = auth.userId;

  const limited = rateLimit("usage-submit", userId, { limit: 20 });
  if (limited) return limited;

  // Validate all entries
  for (const entry of body.entries) {
    if (!isValidDate(entry.date)) {
      return NextResponse.json({ error: `Invalid date: ${entry.date}` }, { status: 400 });
    }
    if (!isWithinBackfillWindow(entry.date, MAX_BACKFILL_DAYS)) {
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
  const isVerified = auth.source === "cli";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://straude.com").replace(/\/+$/, "");

  const deviceId = body.device_id;
  const deviceName = body.device_name;

  // Process all entries concurrently — each entry is independent per-date
  const settled = await Promise.allSettled(
    body.entries.map(async (entry) => {
      // Check if a record already exists to determine create vs update
      const { data: existing } = await db
        .from("daily_usage")
        .select("id")
        .eq("user_id", userId)
        .eq("date", entry.date)
        .maybeSingle();

      const action: "created" | "updated" = existing ? "updated" : "created";

      let usage: { id: string } | null = null;
      let usageError: any = null;

      if (deviceId) {
        // Multi-device path: upsert into device_usage, then aggregate into daily_usage
        const { error: deviceError } = await db
          .from("device_usage")
          .upsert(
            {
              user_id: userId,
              device_id: deviceId,
              device_name: deviceName ?? null,
              date: entry.date,
              cost_usd: entry.data.costUSD,
              input_tokens: entry.data.inputTokens,
              output_tokens: entry.data.outputTokens,
              cache_creation_tokens: entry.data.cacheCreationTokens,
              cache_read_tokens: entry.data.cacheReadTokens,
              total_tokens: entry.data.totalTokens,
              models: entry.data.models,
              model_breakdown: entry.data.modelBreakdown ?? null,
              session_count: 1,
              raw_hash: body.hash ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,date,device_id" },
          )
          .select("id")
          .single();

        if (deviceError) {
          throw new Error(`Failed to upsert device_usage for ${entry.date}: ${deviceError.message}`);
        }

        // Fetch all device rows for this (user_id, date) and aggregate
        const { data: deviceRows, error: fetchError } = await db
          .from("device_usage")
          .select("cost_usd,input_tokens,output_tokens,cache_creation_tokens,cache_read_tokens,total_tokens,models,model_breakdown")
          .eq("user_id", userId)
          .eq("date", entry.date);

        if (fetchError || !deviceRows) {
          throw new Error(`Failed to fetch device_usage for ${entry.date}: ${fetchError?.message}`);
        }

        const agg = aggregateDeviceRows(deviceRows as DeviceUsageRow[]);

        const { data, error } = await db
          .from("daily_usage")
          .upsert(
            {
              user_id: userId,
              date: entry.date,
              cost_usd: agg.cost_usd,
              input_tokens: agg.input_tokens,
              output_tokens: agg.output_tokens,
              cache_creation_tokens: agg.cache_creation_tokens,
              cache_read_tokens: agg.cache_read_tokens,
              total_tokens: agg.total_tokens,
              models: agg.models,
              model_breakdown: agg.model_breakdown,
              session_count: agg.session_count,
              is_verified: isVerified,
              raw_hash: body.hash ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,date" },
          )
          .select("id")
          .single();

        usage = data;
        usageError = error;
      } else {
        // Legacy path: direct upsert into daily_usage (no device tracking)
        const { data, error } = await db
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

        usage = data;
        usageError = error;
      }

      if (usageError || !usage) {
        throw new Error(`Failed to upsert usage for ${entry.date}: ${usageError?.message}`);
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
      const { data: existingPost } = await db
        .from("posts")
        .select("id")
        .eq("daily_usage_id", usage.id)
        .maybeSingle();

      let post: { id: string } | null = null;
      let postError: any = null;

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
        throw new Error(`Failed to create post for ${entry.date}: ${postError?.message}`);
      }

      return {
        date: entry.date,
        usage_id: usage.id,
        post_id: post.id,
        post_url: `${appUrl}/post/${post.id}`,
        action,
      };
    }),
  );

  // Collect results and errors
  const results: UsageSubmitResponse["results"] = [];
  const errors: string[] = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      results.push(result.value);
    } else {
      errors.push(result.reason?.message ?? "Unknown error");
    }
  }

  if (errors.length > 0 && results.length === 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 500 });
  }

  checkAndAwardAchievements(userId, "usage").catch(() => {});

  // Recheck referrer's crew-spend achievements when a referred user logs usage
  Promise.resolve(
    getServiceClient()
      .from("users")
      .select("referred_by")
      .eq("id", userId)
      .single(),
  )
    .then(({ data }) => {
      if (data?.referred_by) {
        checkAndAwardAchievements(data.referred_by, "referral").catch(() => {});
      }
    })
    .catch(() => {});

  const response: UsageSubmitResponse = { results };
  if (errors.length > 0) {
    return NextResponse.json({ ...response, errors }, { status: 207 });
  }
  return NextResponse.json(response);
}
