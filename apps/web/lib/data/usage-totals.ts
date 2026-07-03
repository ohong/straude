import type { createClient } from "@/lib/supabase/server";
import type { DailyUsage } from "@/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type UsageFallbackRow = Pick<DailyUsage, "cost_usd" | "output_tokens">;
type UsageTotalsRpcRow = {
  total_cost: number | string | null;
  total_tokens: number | string | null;
};

export async function loadUsageTotals(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<{ totalTokens: number; totalCost: number }> {
  const usageTotalsRes = await supabase
    .rpc("get_user_usage_totals", { p_user_id: userId })
    .single();

  const loadFallbackUsageTotals = async (): Promise<{ totalTokens: number; totalCost: number }> => {
    const { data: fallbackRows, error: fallbackError } = await supabase
      .from("daily_usage")
      .select("cost_usd, output_tokens")
      .eq("user_id", userId);

    if (fallbackError) {
      throw new Error(`Unable to load usage totals from daily_usage fallback (${fallbackError.message})`);
    }

    const rows = (fallbackRows ?? []) as UsageFallbackRow[];
    return {
      totalTokens: rows.reduce((sum, row) => sum + Number(row.output_tokens), 0),
      totalCost: rows.reduce((sum, row) => sum + Number(row.cost_usd), 0),
    };
  };

  if (usageTotalsRes.error) {
    console.error("get_user_usage_totals RPC failed; using direct daily_usage fallback", {
      userId,
      code: usageTotalsRes.error.code,
      message: usageTotalsRes.error.message,
    });

    return loadFallbackUsageTotals();
  }

  const usageTotals = usageTotalsRes.data as UsageTotalsRpcRow | null;
  const rpcTokens = usageTotals?.total_tokens;

  if (rpcTokens === null || rpcTokens === undefined) {
    console.error("get_user_usage_totals returned no total_tokens; using direct daily_usage fallback", {
      userId,
      rpcKeys: usageTotals ? Object.keys(usageTotals) : [],
    });

    return loadFallbackUsageTotals();
  }

  return {
    totalTokens: Number(rpcTokens),
    totalCost: Number(usageTotals?.total_cost ?? 0),
  };
}
