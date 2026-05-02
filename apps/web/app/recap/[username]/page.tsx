import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { fillContributionDays, getRecapData } from "@/lib/utils/recap";
import { formatCurrency, formatTokens, getCellColor } from "@/lib/utils/format";
import type { Metadata } from "next";
import Link from "next/link";
import {
  getBackgroundById,
  getPalette,
  DEFAULT_BACKGROUND_ID,
} from "@/lib/recap-backgrounds";

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
  searchParams: Promise<{ period?: string; bg?: string }>;
}) {
  const { username } = await params;
  const { period: periodParam, bg: bgParam } = await searchParams;
  const period = periodParam === "month" ? "month" : ("week" as const);
  const bg = getBackgroundById(bgParam ?? DEFAULT_BACKGROUND_ID);
  const palette = getPalette(bg);

  const supabase = await createClient();
  // Use the service client to read streak_freezes — the column-level grants
  // on public.users (see harden_users_public_columns) hide it from the
  // authenticated/anon roles, but the recap streak must use the same freeze
  // count as the profile page to stay consistent.
  const db = getServiceClient();
  const { data: profile } = await db
    .from("users")
    .select("id, username, is_public, streak_freezes")
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
    period,
    profile.streak_freezes ?? 0
  );

  const allDays = fillContributionDays(
    data.contribution_data,
    data.total_days,
    data.period,
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      {/* Card preview */}
      <div
        className="relative w-full max-w-[600px] overflow-hidden border border-border"
        style={{ borderRadius: 8 }}
      >
        {/* Background gradient */}
        <div
          className="absolute inset-0"
          style={{ background: bg.css }}
        />
        {/* Overlay */}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: palette.overlay }}
        />

        <div className="relative p-8">
          {/* Header */}
          <div className="flex items-start justify-between">
            <svg width="24" height="24" viewBox="0 0 32 32">
              <polygon points="6.4,0 25.6,0 32,32 0,32" fill="#DF561F" />
            </svg>
            <p
              className="text-xs font-medium"
              style={{ color: palette.textMuted }}
            >
              {data.period_label}
            </p>
          </div>

          {/* Hero stat */}
          <div className="mt-8">
            <p
              className="font-[family-name:var(--font-mono)] text-5xl font-bold tabular-nums text-accent"
              style={{ letterSpacing: "-0.03em" }}
            >
              ${formatCurrency(data.total_cost)}
            </p>
            <p
              className="mt-1 text-xs font-medium uppercase tracking-widest"
              style={{ color: palette.textSubtle }}
            >
              total spend
            </p>
          </div>

          {/* Stats grid */}
          <div className="mt-8 grid grid-cols-4 gap-4">
            <div>
              <p
                className="text-[0.65rem] font-medium uppercase tracking-widest"
                style={{ color: palette.textSubtle }}
              >
                Output
              </p>
              <p
                className="font-[family-name:var(--font-mono)] text-xl font-bold tabular-nums"
                style={{ color: palette.text }}
              >
                {formatTokens(data.output_tokens)}
              </p>
            </div>
            <div>
              <p
                className="text-[0.65rem] font-medium uppercase tracking-widest"
                style={{ color: palette.textSubtle }}
              >
                Active
              </p>
              <p
                className="font-[family-name:var(--font-mono)] text-xl font-bold tabular-nums"
                style={{ color: palette.text }}
              >
                {data.active_days}/{data.total_days}{" "}
                <span
                  className="text-sm font-medium"
                  style={{ color: palette.textSubtle }}
                >
                  days
                </span>
              </p>
            </div>
            <div>
              <p
                className="text-[0.65rem] font-medium uppercase tracking-widest"
                style={{ color: palette.textSubtle }}
              >
                Sessions
              </p>
              <p
                className="font-[family-name:var(--font-mono)] text-xl font-bold tabular-nums"
                style={{ color: palette.text }}
              >
                {data.session_count}
              </p>
            </div>
            <div>
              <p
                className="text-[0.65rem] font-medium uppercase tracking-widest"
                style={{ color: palette.textSubtle }}
              >
                Streak
              </p>
              <p className="font-[family-name:var(--font-mono)] text-xl font-bold tabular-nums text-accent">
                🔥 {data.streak}{" "}
                <span
                  className="text-sm font-medium"
                  style={{ color: palette.textSubtle }}
                >
                  days
                </span>
              </p>
            </div>
          </div>

          {/* Model */}
          <p
            className="mt-6 text-xs font-medium"
            style={{ color: palette.textSubtle }}
          >
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
            <span style={{ color: palette.textMuted }}>@{data.username}</span>
            <span style={{ color: palette.textSubtle }}>straude.com</span>
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

