import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRecapData } from "@/lib/utils/recap";
import { formatTokens } from "@/lib/utils/format";
import type { Metadata } from "next";
import Link from "next/link";

function getCellColor(cost: number): string {
  if (cost <= 0) return "#E5E5E5";
  if (cost <= 10) return "#FDD0B1";
  if (cost <= 50) return "#F4945E";
  if (cost <= 100) return "#DF561F";
  return "#B8441A";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${username}'s Recap — Straude`,
    description: `See @${username}'s Claude Code usage recap on Straude`,
  };
}

export default async function PublicRecapPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { username } = await params;
  const { period: periodParam } = await searchParams;
  const period = periodParam === "month" ? "month" : ("week" as const);

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("users")
    .select("id, username, is_public")
    .eq("username", username)
    .single();

  if (!profile || !profile.is_public) {
    notFound();
  }

  const data = await getRecapData(
    supabase,
    profile.id,
    profile.username!,
    profile.is_public,
    period
  );

  const allDays = fillDays(data.contribution_data, data.total_days, data.period);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      {/* Card preview */}
      <div
        className="w-full max-w-[600px] overflow-hidden border border-border"
        style={{ borderRadius: 8 }}
      >
        <div className="bg-black p-8 text-white">
          {/* Header */}
          <div className="flex items-start justify-between">
            <svg width="24" height="24" viewBox="0 0 32 32">
              <polygon points="6.4,0 25.6,0 32,32 0,32" fill="#DF561F" />
            </svg>
            <p className="text-xs font-medium text-white/50">
              {data.period_label}
            </p>
          </div>

          {/* Hero stat */}
          <div className="mt-8">
            <p
              className="font-[family-name:var(--font-mono)] text-5xl font-bold tabular-nums text-accent"
              style={{ letterSpacing: "-0.03em" }}
            >
              ${data.total_cost.toFixed(2)}
            </p>
            <p className="mt-1 text-xs font-medium uppercase tracking-widest text-white/40">
              total spend
            </p>
          </div>

          {/* Stats grid */}
          <div className="mt-8 grid grid-cols-4 gap-4">
            <div>
              <p className="text-[0.65rem] font-medium uppercase tracking-widest text-white/40">
                Output
              </p>
              <p className="font-[family-name:var(--font-mono)] text-xl font-bold tabular-nums">
                {formatTokens(data.output_tokens)}
              </p>
            </div>
            <div>
              <p className="text-[0.65rem] font-medium uppercase tracking-widest text-white/40">
                Active
              </p>
              <p className="font-[family-name:var(--font-mono)] text-xl font-bold tabular-nums">
                {data.active_days}/{data.total_days}{" "}
                <span className="text-sm font-medium text-white/40">days</span>
              </p>
            </div>
            <div>
              <p className="text-[0.65rem] font-medium uppercase tracking-widest text-white/40">
                Sessions
              </p>
              <p className="font-[family-name:var(--font-mono)] text-xl font-bold tabular-nums">
                {data.session_count}
              </p>
            </div>
            <div>
              <p className="text-[0.65rem] font-medium uppercase tracking-widest text-white/40">
                Streak
              </p>
              <p className="font-[family-name:var(--font-mono)] text-xl font-bold tabular-nums text-accent">
                🔥 {data.streak}{" "}
                <span className="text-sm font-medium text-white/40">days</span>
              </p>
            </div>
          </div>

          {/* Model */}
          <p className="mt-6 text-xs font-medium text-white/35">
            Powered by {data.primary_model}
          </p>

          {/* Contribution strip */}
          <div className="mt-6 flex gap-[3px]">
            {allDays.map((day) => (
              <div
                key={day.date}
                className="flex-1"
                style={{
                  height: 12,
                  backgroundColor: getCellColor(day.cost_usd),
                  borderRadius: 2,
                }}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-between text-xs font-medium">
            <span className="text-white/50">@{data.username}</span>
            <span className="text-white/30">straude.com</span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-8 text-center">
        <p className="text-sm text-muted">
          Track your Claude Code usage
        </p>
        <Link
          href="/"
          className="mt-2 inline-block border border-border px-6 py-2 text-sm font-semibold hover:bg-subtle"
          style={{ borderRadius: 4 }}
        >
          Join Straude
        </Link>
      </div>
    </div>
  );
}

function fillDays(
  data: { date: string; cost_usd: number }[],
  totalDays: number,
  period: "week" | "month"
): { date: string; cost_usd: number }[] {
  const lookup = new Map(data.map((d) => [d.date, d.cost_usd]));
  const now = new Date();
  let start: Date;

  if (period === "week") {
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start = new Date(now);
    start.setDate(now.getDate() + mondayOffset);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const result: { date: string; cost_usd: number }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    result.push({ date: key, cost_usd: lookup.get(key) ?? 0 });
  }
  return result;
}
