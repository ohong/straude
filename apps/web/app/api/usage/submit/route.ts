import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyCliTokenWithRefresh } from "@/lib/api/cli-auth";
import { getServiceClient } from "@/lib/supabase/service";
import { checkAndAwardAchievements } from "@/lib/achievements";
import { rateLimit } from "@/lib/rate-limit";
import { formatCurrency } from "@/lib/utils/format";
import type { UsageSubmitRequest, UsageSubmitResponse, CcusageDailyEntry, ModelBreakdownEntry, UsageCollectorMeta } from "@/types";

const MAX_BACKFILL_DAYS = 30;
// Trusted collectors are the only ones allowed to *lower* Codex totals on
// UPSERT, which is how the server accepts retroactive collector corrections.
const TRUSTED_CODEX_COLLECTORS = new Set([
  "straude-codex-native-last-token-usage",
  "ccusage-codex-v20",
]);
const TRUSTED_CCUSAGE_PRICING_MODES = new Set(["offline", "online"]);
const LEGACY_DEVICE_ID = "00000000-0000-0000-0000-000000000000";
const CODEX_MODEL_RE = /^(gpt-|o3|o4)/i;
const COST_EPSILON_USD = 0.005;
const REPAIR_META_KEYS = [
  "repair",
  "previous_cost_usd",
  "previous_input_tokens",
  "previous_cache_read_tokens",
  "repaired_at",
  "repair_v3_codex_only",
  "cost_before_v3",
  "total_tokens_before_v3",
  "cache_read_before_v3",
  "model_breakdown_before_v3",
  "repaired_at_v3",
  "claude_restore_2026_05_07",
  "cost_before_claude_restore",
] as const;

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
  if ((entry.reasoningOutputTokens ?? 0) < 0) return `Negative reasoning output tokens for ${entry.date}`;
  if (entry.totalTokens < 0) return `Negative total tokens for ${entry.date}`;
  return null;
}

function validateCollectorMeta(collector: UsageCollectorMeta | undefined): string | null {
  if (!collector) return null;
  if (collector.pricing_mode != null && !TRUSTED_CCUSAGE_PRICING_MODES.has(collector.pricing_mode)) {
    return "Unsupported pricing mode; ccusage submissions must use ccusage offline or online pricing";
  }
  if (collector.ccusage_agents != null) {
    if (!Array.isArray(collector.ccusage_agents)) {
      return "Invalid ccusage_agents collector metadata";
    }
    const unsupported = collector.ccusage_agents.filter((agent) => agent !== "claude" && agent !== "codex");
    if (unsupported.length > 0) {
      return `Unsupported ccusage agents: ${[...new Set(unsupported)].join(", ")}`;
    }
  }
  return null;
}

function isCodexModel(model: unknown): boolean {
  return typeof model === "string" && CODEX_MODEL_RE.test(model);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsCodexModel(models: unknown): boolean {
  return Array.isArray(models) && models.some(isCodexModel);
}

function containsNonCodexModel(models: unknown): boolean {
  return Array.isArray(models) && models.some((model) => !isCodexModel(model));
}

function hasNonCodexModels(models: unknown): boolean {
  if (!Array.isArray(models) || models.length === 0) return true;
  return containsNonCodexModel(models);
}

function sumBreakdownCost(
  breakdown: unknown,
  matchesModel: (model: unknown) => boolean,
): number | null {
  if (!Array.isArray(breakdown)) return null;

  let total = 0;
  for (const item of breakdown) {
    if (!isRecord(item)) return null;
    if (!matchesModel(item.model)) continue;

    const cost = Number(item.cost_usd);
    if (!Number.isFinite(cost)) return null;
    total += cost;
  }

  return total;
}

function entryContainsCodexUsage(entry: CcusageDailyEntry): boolean {
  if (containsCodexModel(entry.models)) return true;
  const codexBreakdownCost = sumBreakdownCost(entry.modelBreakdown, isCodexModel);
  return codexBreakdownCost != null && codexBreakdownCost > 0;
}

function entryContainsNonCodexUsage(entry: CcusageDailyEntry): boolean {
  if (containsNonCodexModel(entry.models)) return true;
  const nonCodexBreakdownCost = sumBreakdownCost(entry.modelBreakdown, (model) => !isCodexModel(model));
  return nonCodexBreakdownCost != null && nonCodexBreakdownCost > 0;
}

function rowContainsNonCodexUsage(models: unknown, breakdown: unknown): boolean {
  if (hasNonCodexModels(models)) return true;
  const nonCodexBreakdownCost = sumBreakdownCost(breakdown, (model) => !isCodexModel(model));
  return nonCodexBreakdownCost != null && nonCodexBreakdownCost > 0;
}

function collectorForEntry(
  collector: UsageCollectorMeta | undefined,
  entry: CcusageDailyEntry,
): UsageCollectorMeta | undefined {
  if (!collector) return undefined;

  const entryCollector: Record<string, unknown> = {};
  if (collector.claude && entryContainsNonCodexUsage(entry)) {
    entryCollector.claude = collector.claude;
  }
  if (collector.codex && entryContainsCodexUsage(entry)) {
    entryCollector.codex = collector.codex;
  }
  if (Object.keys(entryCollector).length > 0) {
    mergeCollectorRunMeta(entryCollector, collector);
  }

  return Object.keys(entryCollector).length > 0 ? entryCollector as UsageCollectorMeta : undefined;
}

function nonCodexCostIsPreserved(
  existingBreakdown: unknown,
  incomingBreakdown: unknown,
): boolean {
  const existingNonCodexCost = sumBreakdownCost(existingBreakdown, (model) => !isCodexModel(model));
  const incomingNonCodexCost = sumBreakdownCost(incomingBreakdown, (model) => !isCodexModel(model));
  if (existingNonCodexCost == null || incomingNonCodexCost == null) return false;
  return incomingNonCodexCost + COST_EPSILON_USD >= existingNonCodexCost;
}

function trustedCodexEntryPreservesNonCodex(
  existingModels: unknown,
  existingBreakdown: unknown,
  incomingEntry: CcusageDailyEntry,
): boolean {
  if (!rowContainsNonCodexUsage(existingModels, existingBreakdown)) return true;
  return nonCodexCostIsPreserved(existingBreakdown, incomingEntry.modelBreakdown);
}

function isTruthyMetaValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return value != null;

  const normalized = value.trim().toLowerCase();
  return normalized !== "" && normalized !== "false" && normalized !== "0";
}

function rowWasRepaired(meta: unknown): boolean {
  if (!isRecord(meta)) return false;
  return isTruthyMetaValue(meta.repair)
    || isTruthyMetaValue(meta.repair_v3_codex_only)
    || isTruthyMetaValue(meta.claude_restore_2026_05_07);
}

function mergeRepairMeta(target: Record<string, unknown>, meta: unknown): void {
  if (!isRecord(meta) || !rowWasRepaired(meta)) return;
  for (const key of REPAIR_META_KEYS) {
    if (key in meta) target[key] = meta[key];
  }
}

function mergeCollectorRunMeta(target: Record<string, unknown>, meta: unknown): void {
  if (!isRecord(meta)) return;
  if (typeof meta.ccusage_version === "string") target.ccusage_version = meta.ccusage_version;
  if (Array.isArray(meta.ccusage_agents) && meta.ccusage_agents.every((agent) => typeof agent === "string")) {
    target.ccusage_agents = meta.ccusage_agents;
  }
  if (typeof meta.pricing_mode === "string") target.pricing_mode = meta.pricing_mode;
}

function mergeCollectorSourceMeta(target: Record<string, unknown>, meta: unknown): void {
  if (!isRecord(meta)) return;
  if (typeof meta.claude === "string") target.claude = meta.claude;
  if (typeof meta.codex === "string") target.codex = meta.codex;
  mergeCollectorRunMeta(target, meta);
}

function mergeDailyCollectorMeta(
  currentCollector: UsageCollectorMeta | undefined,
  existingDailyMeta: unknown,
  deviceRows: DeviceUsageRow[],
): UsageCollectorMeta | null {
  const merged: Record<string, unknown> = {};
  mergeCollectorSourceMeta(merged, existingDailyMeta);
  mergeRepairMeta(merged, existingDailyMeta);
  for (const row of deviceRows) {
    mergeCollectorSourceMeta(merged, row.collector_meta);
    mergeRepairMeta(merged, row.collector_meta);
  }
  if (currentCollector) Object.assign(merged, currentCollector);
  return Object.keys(merged).length > 0 ? merged as UsageCollectorMeta : null;
}

function mergeCollectorWithRepairMeta(
  currentCollector: UsageCollectorMeta | undefined,
  existingMeta: unknown,
): UsageCollectorMeta | null {
  const merged: Record<string, unknown> = {};
  mergeCollectorSourceMeta(merged, existingMeta);
  mergeRepairMeta(merged, existingMeta);
  if (currentCollector) Object.assign(merged, currentCollector);
  return Object.keys(merged).length > 0 ? merged as UsageCollectorMeta : null;
}

interface AuthContext {
  userId: string;
  source: "cli" | "web";
  /** When set, the response should include X-Straude-Refreshed-Token. */
  refreshedToken?: string | null;
}

async function resolveAuthContext(request: Request): Promise<AuthContext | null> {
  // Try CLI JWT first
  const authHeader = request.headers.get("authorization");
  const cliAuth = verifyCliTokenWithRefresh(authHeader);
  if (cliAuth) {
    return {
      userId: cliAuth.userId,
      source: "cli",
      refreshedToken: cliAuth.refreshedToken,
    };
  }

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
  reasoning_output_tokens?: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
  models: string[];
  model_breakdown: ModelBreakdownEntry[] | null;
  collector_meta?: UsageCollectorMeta | null;
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
  let reasoning_output_tokens = 0;
  let cache_creation_tokens = 0;
  let cache_read_tokens = 0;
  let total_tokens = 0;
  const modelsSet = new Set<string>();
  const breakdownMap = new Map<string, number>();

  for (const row of rows) {
    cost_usd += Number(row.cost_usd);
    input_tokens += Number(row.input_tokens);
    output_tokens += Number(row.output_tokens);
    reasoning_output_tokens += Number(row.reasoning_output_tokens ?? 0);
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
    reasoning_output_tokens,
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

  const collectorValidationError = validateCollectorMeta(body.collector);
  if (collectorValidationError) {
    return NextResponse.json({ error: collectorValidationError }, { status: 400 });
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
  const requestHasTrustedCodexCollector = typeof body.collector?.codex === "string"
    && TRUSTED_CODEX_COLLECTORS.has(body.collector.codex);

  if (!deviceId) {
    return NextResponse.json(
      { error: "device_id is required. Please update your CLI: npx straude@latest" },
      { status: 400 },
    );
  }

  // Process all entries concurrently — each entry is independent per-date
  const settled = await Promise.allSettled(
    body.entries.map(async (entry) => {
      // Check if a record already exists to determine create vs update
      const { data: existing } = await db
        .from("daily_usage")
        .select("id, cost_usd, models, model_breakdown, collector_meta")
        .eq("user_id", userId)
        .eq("date", entry.date)
        .maybeSingle();

      const action: "created" | "updated" = existing ? "updated" : "created";
      const previousCost = existing ? Number(existing.cost_usd) : undefined;

      let usage: { id: string } | null = null;
      let usageErrorMessage: string | null = null;
      const entryIsTrustedCodexCorrection = requestHasTrustedCodexCollector && entryContainsCodexUsage(entry.data);
      const entryCollector = collectorForEntry(body.collector, entry.data);

      // Guard against decreasing values (e.g., ccusage log rotation). Trusted
      // Codex collectors may lower totals because they repair inflated rows
      // produced by older Codex aggregation behavior.
      const { data: existingDevice } = await db
        .from("device_usage")
        .select("cost_usd,models,model_breakdown,collector_meta")
        .eq("user_id", userId)
        .eq("date", entry.date)
        .eq("device_id", deviceId)
        .maybeSingle();
      const existingDeviceMeta = (existingDevice as { collector_meta?: UsageCollectorMeta | null } | null | undefined)?.collector_meta;
      const existingDeviceWasRepaired = rowWasRepaired(existingDeviceMeta);

      let preexistingDeviceCount = 0;
      if (existing) {
        const { count } = await db
          .from("device_usage")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("date", entry.date);
        preexistingDeviceCount = count ?? 0;
      }

      const trustedEntryCanOverwriteDevice = entryIsTrustedCodexCorrection
        && (!existingDevice || trustedCodexEntryPreservesNonCodex(
          (existingDevice as { models?: unknown }).models,
          (existingDevice as { model_breakdown?: unknown }).model_breakdown,
          entry.data,
        ));

      // Protect rows that the codex-only repair migration corrected from
      // being re-inflated by an older untrusted collector. Without this guard, a
      // user still on the older collector auto-pushes their next daily payload, the
      // payload's cost is higher than the repaired row, and the existing
      // "raise allowed" path overwrites the repair. Trusted uploads bypass the
      // guard and heal the row to ground truth.
      const mayOverwriteDevice = (
        !existingDevice
        || (entry.data.costUSD >= Number(existingDevice.cost_usd) && !existingDeviceWasRepaired)
        || trustedEntryCanOverwriteDevice
      );

      // Only upsert if new data is >= existing, unless this is a trusted repair.
      if (mayOverwriteDevice) {
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
              reasoning_output_tokens: entry.data.reasoningOutputTokens ?? 0,
              cache_creation_tokens: entry.data.cacheCreationTokens,
              cache_read_tokens: entry.data.cacheReadTokens,
              total_tokens: entry.data.totalTokens,
              models: entry.data.models,
              model_breakdown: entry.data.modelBreakdown ?? null,
              session_count: 1,
              raw_hash: body.hash ?? null,
              collector_meta: mergeCollectorWithRepairMeta(entryCollector, existingDeviceMeta),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,date,device_id" },
          )
          .select("id")
          .single();

        if (deviceError) {
          throw new Error(`Failed to upsert device_usage for ${entry.date}: ${deviceError.message}`);
        }
      }

      const existingHasNonCodexUsage = existing
        ? rowContainsNonCodexUsage(
          (existing as { models?: unknown }).models,
          (existing as { model_breakdown?: unknown }).model_breakdown,
        )
        : false;
      const canDropLegacyDevice = entryIsTrustedCodexCorrection
        && (!existingHasNonCodexUsage || nonCodexCostIsPreserved(
          (existing as { model_breakdown?: unknown } | null)?.model_breakdown,
          entry.data.modelBreakdown,
        ));

      if (canDropLegacyDevice) {
        await db
          .from("device_usage")
          .delete()
          .eq("user_id", userId)
          .eq("date", entry.date)
          .eq("device_id", LEGACY_DEVICE_ID);
      }

      // Backfill legacy data: if daily_usage exists but has no device_usage rows,
      // the data was written before device tracking. Insert it as a "legacy" device
      // so the aggregation doesn't discard it.
      if (existing && !canDropLegacyDevice) {
        if (preexistingDeviceCount === 0) {
          const { data: legacyRow } = await db
            .from("daily_usage")
            .select("cost_usd,input_tokens,output_tokens,reasoning_output_tokens,cache_creation_tokens,cache_read_tokens,total_tokens,models,model_breakdown,raw_hash")
            .eq("id", existing.id)
            .single();

          if (legacyRow) {
            await db.from("device_usage").insert({
              user_id: userId,
              device_id: LEGACY_DEVICE_ID,
              device_name: "legacy",
              date: entry.date,
              cost_usd: legacyRow.cost_usd,
              input_tokens: legacyRow.input_tokens,
              output_tokens: legacyRow.output_tokens,
              reasoning_output_tokens: legacyRow.reasoning_output_tokens ?? 0,
              cache_creation_tokens: legacyRow.cache_creation_tokens ?? 0,
              cache_read_tokens: legacyRow.cache_read_tokens ?? 0,
              total_tokens: legacyRow.total_tokens,
              models: legacyRow.models ?? [],
              model_breakdown: legacyRow.model_breakdown ?? null,
              session_count: 1,
              raw_hash: legacyRow.raw_hash ?? null,
              collector_meta: null,
              updated_at: new Date().toISOString(),
            });
          }
        }
      }

      // Fetch all device rows for this (user_id, date) and aggregate
      const { data: deviceRows, error: fetchError } = await db
        .from("device_usage")
        .select("cost_usd,input_tokens,output_tokens,reasoning_output_tokens,cache_creation_tokens,cache_read_tokens,total_tokens,models,model_breakdown,collector_meta")
        .eq("user_id", userId)
        .eq("date", entry.date);

      if (fetchError || !deviceRows) {
        throw new Error(`Failed to fetch device_usage for ${entry.date}: ${fetchError?.message}`);
      }

      const agg = aggregateDeviceRows(deviceRows as DeviceUsageRow[]);
      const dailyCollectorMeta = mergeDailyCollectorMeta(
        mayOverwriteDevice ? entryCollector : undefined,
        (existing as { collector_meta?: unknown } | null)?.collector_meta,
        deviceRows as DeviceUsageRow[],
      );

      const { data, error } = await db
        .from("daily_usage")
        .upsert(
          {
            user_id: userId,
            date: entry.date,
            cost_usd: agg.cost_usd,
            input_tokens: agg.input_tokens,
            output_tokens: agg.output_tokens,
            reasoning_output_tokens: agg.reasoning_output_tokens,
            cache_creation_tokens: agg.cache_creation_tokens,
            cache_read_tokens: agg.cache_read_tokens,
            total_tokens: agg.total_tokens,
            models: agg.models,
            model_breakdown: agg.model_breakdown,
            session_count: agg.session_count,
            is_verified: isVerified,
            raw_hash: body.hash ?? null,
            collector_meta: dailyCollectorMeta,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,date" },
        )
        .select("id")
        .single();

      usage = data;
      usageErrorMessage = error?.message ?? null;

      if (usageErrorMessage || !usage) {
        throw new Error(`Failed to upsert usage for ${entry.date}: ${usageErrorMessage ?? "Unknown error"}`);
      }

      // Build auto-title from aggregated usage data
      const models = agg.models;
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
      const costLabel = agg.cost_usd > 0 ? `, $${formatCurrency(agg.cost_usd)}` : "";
      const autoTitle = modelLabel ? `${dateLabel} — ${modelLabel}${costLabel}` : `${dateLabel}${costLabel}`;

      // Create or update post linked to the daily_usage record
      // Only overwrite the title on re-sync if it's still auto-generated
      const { data: existingPost } = await db
        .from("posts")
        .select("id, title")
        .eq("daily_usage_id", usage.id)
        .maybeSingle();

      let post: { id: string } | null = null;
      let postErrorMessage: string | null = null;

      if (existingPost) {
        // Auto-generated titles match "Mon DD" or "Mon DD — Models, $X.XX"
        const isAutoTitle = !existingPost.title || /^[A-Z][a-z]{2} \d{1,2}( — .+)?$/.test(existingPost.title);
        const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (isAutoTitle) updateFields.title = autoTitle;

        const { data, error } = await db
          .from("posts")
          .update(updateFields)
          .eq("id", existingPost.id)
          .select("id")
          .single();
        post = data;
        postErrorMessage = error?.message ?? null;
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
        postErrorMessage = error?.message ?? null;
      }

      if (postErrorMessage || !post) {
        throw new Error(`Failed to create post for ${entry.date}: ${postErrorMessage ?? "Unknown error"}`);
      }

      return {
        date: entry.date,
        usage_id: usage.id,
        post_id: post.id,
        post_url: `${appUrl}/post/${post.id}`,
        action,
        previous_cost: previousCost,
        daily_total: agg.cost_usd,
        device_count: deviceRows.length,
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
  Promise.resolve(
    db.rpc("recalculate_user_level", { p_user_id: userId }),
  ).catch(() => {});

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

  const responseHeaders: Record<string, string> = {};
  if (auth.source === "cli" && auth.refreshedToken) {
    responseHeaders["X-Straude-Refreshed-Token"] = auth.refreshedToken;
  }

  const response: UsageSubmitResponse = { results };
  if (errors.length > 0) {
    return NextResponse.json({ ...response, errors }, { status: 207, headers: responseHeaders });
  }
  return NextResponse.json(response, { headers: responseHeaders });
}
