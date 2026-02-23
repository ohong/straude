"use client";

import { formatTokens } from "@/lib/utils/format";
import type { RecapData } from "@/lib/utils/recap";
import { getBackgroundById, DEFAULT_BACKGROUND_ID } from "@/lib/recap-backgrounds";

function getCellColor(cost: number): string {
  if (cost <= 0) return "#E5E5E5";
  if (cost <= 10) return "#FDD0B1";
  if (cost <= 50) return "#F4945E";
  if (cost <= 100) return "#DF561F";
  return "#B8441A";
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

  // Cap at today — don't render future days
  const msPerDay = 86400000;
  const daysSinceStart =
    Math.floor((now.getTime() - start.getTime()) / msPerDay) + 1;
  const cappedDays = Math.min(totalDays, daysSinceStart);

  const result: { date: string; cost_usd: number }[] = [];
  for (let i = 0; i < cappedDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    result.push({ date: key, cost_usd: lookup.get(key) ?? 0 });
  }
  return result;
}

export function RecapCard({
  data,
  backgroundId,
}: {
  data: RecapData;
  backgroundId?: string;
}) {
  const allDays = fillDays(data.contribution_data, data.total_days, data.period);
  const bg = getBackgroundById(backgroundId ?? DEFAULT_BACKGROUND_ID);

  return (
    <div
      className="relative overflow-hidden"
      style={{ borderRadius: 8 }}
    >
      {/* Background image */}
      <img
        src={bg.src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* White overlay for legibility */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(255,255,255,0.78)" }}
      />

      {/* Content */}
      <div className="relative p-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <svg width="24" height="24" viewBox="0 0 32 32">
            <polygon points="6.4,0 25.6,0 32,32 0,32" fill="#DF561F" />
          </svg>
          <p className="text-xs font-medium" style={{ color: "#666" }}>
            {data.period_label}
          </p>
        </div>

        {/* Hero stat */}
        <div className="mt-8">
          <p
            className="font-[family-name:var(--font-mono)] text-5xl font-bold tabular-nums text-accent sm:text-6xl"
            style={{ letterSpacing: "-0.03em" }}
          >
            ${data.total_cost.toFixed(2)}
          </p>
          <p
            className="mt-1 text-xs font-medium uppercase tracking-widest"
            style={{ color: "#999" }}
          >
            total spend
          </p>
        </div>

        {/* Stats grid */}
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p
              className="text-[0.65rem] font-medium uppercase tracking-widest"
              style={{ color: "#999" }}
            >
              Output
            </p>
            <p
              className="font-[family-name:var(--font-mono)] text-xl font-bold tabular-nums"
              style={{ color: "#000" }}
            >
              {formatTokens(data.output_tokens)}
            </p>
          </div>
          <div>
            <p
              className="text-[0.65rem] font-medium uppercase tracking-widest"
              style={{ color: "#999" }}
            >
              Active
            </p>
            <p
              className="font-[family-name:var(--font-mono)] text-xl font-bold tabular-nums"
              style={{ color: "#000" }}
            >
              {data.active_days}/{data.total_days}{" "}
              <span className="text-sm font-medium" style={{ color: "#999" }}>
                days
              </span>
            </p>
          </div>
          <div>
            <p
              className="text-[0.65rem] font-medium uppercase tracking-widest"
              style={{ color: "#999" }}
            >
              Sessions
            </p>
            <p
              className="font-[family-name:var(--font-mono)] text-xl font-bold tabular-nums"
              style={{ color: "#000" }}
            >
              {data.session_count}
            </p>
          </div>
          <div>
            <p
              className="text-[0.65rem] font-medium uppercase tracking-widest"
              style={{ color: "#999" }}
            >
              Streak
            </p>
            <p className="font-[family-name:var(--font-mono)] text-xl font-bold tabular-nums text-accent">
              🔥 {data.streak}{" "}
              <span className="text-sm font-medium" style={{ color: "#999" }}>
                days
              </span>
            </p>
          </div>
        </div>

        {/* Model */}
        <p className="mt-6 text-xs font-medium" style={{ color: "#999" }}>
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
          <span style={{ color: "#666" }}>@{data.username}</span>
          <span style={{ color: "#999" }}>straude.com</span>
        </div>
      </div>
    </div>
  );
}
