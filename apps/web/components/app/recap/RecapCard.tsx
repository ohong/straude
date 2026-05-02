"use client";

import { formatCurrency, formatTokens, getCellColor } from "@/lib/utils/format";
import { fillContributionDays, type RecapData } from "@/lib/utils/recap";
import {
  getBackgroundById,
  getPalette,
  DEFAULT_BACKGROUND_ID,
} from "@/lib/recap-backgrounds";

export function RecapCard({
  data,
  backgroundId,
}: {
  data: RecapData;
  backgroundId?: string;
}) {
  const allDays = fillContributionDays(
    data.contribution_data,
    data.total_days,
    data.period,
  );
  const bg = getBackgroundById(backgroundId ?? DEFAULT_BACKGROUND_ID);
  const palette = getPalette(bg);

  return (
    <div
      className="relative overflow-hidden"
      style={{ borderRadius: 8 }}
    >
      {/* Background gradient */}
      <div
        className="absolute inset-0"
        style={{ background: bg.css }}
      />
      {/* Overlay for legibility */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: palette.overlay }}
      />

      {/* Content */}
      <div className="relative p-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <svg width="24" height="24" viewBox="0 0 32 32">
            <polygon points="6.4,0 25.6,0 32,32 0,32" fill="#DF561F" />
          </svg>
          <p className="text-xs font-medium" style={{ color: palette.textMuted }}>
            {data.period_label}
          </p>
        </div>

        {/* Hero stat */}
        <div className="mt-8">
          <p
            className="font-[family-name:var(--font-mono)] text-5xl font-bold tabular-nums text-accent sm:text-6xl"
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
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
  );
}
