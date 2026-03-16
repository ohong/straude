"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useAdminTheme } from "./AdminShell";

interface ModelUsageRow {
  date: string;
  claude_spend: number;
  codex_spend: number;
}

type ViewMode = "cumulative" | "daily";

const RANGES = [
  { key: "7d", label: "7D", days: 7 },
  { key: "14d", label: "14D", days: 14 },
  { key: "30d", label: "30D", days: 30 },
  { key: "all", label: "All", days: Infinity },
] as const;

const VIEW_MODES: { key: ViewMode; label: string }[] = [
  { key: "cumulative", label: "Cumulative" },
  { key: "daily", label: "Daily" },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function Skeleton() {
  return (
    <div className="admin-card">
      <div className="px-5 pt-4 pb-2">
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--admin-fg)" }}
        >
          Model Usage
        </h2>
        <p
          className="mt-0.5 text-xs"
          style={{ color: "var(--admin-fg-muted)" }}
        >
          Spend by provider
        </p>
      </div>
      <div className="space-y-2 px-5 pb-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-6 animate-pulse rounded"
            style={{
              backgroundColor: "var(--admin-border)",
              opacity: 1 - i * 0.15,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function ModelUsageChart() {
  const { theme } = useAdminTheme();
  const isDark = theme === "dark";
  const [data, setData] = useState<ModelUsageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<string>("30d");
  const [view, setView] = useState<ViewMode>("daily");

  useEffect(() => {
    fetch("/api/admin/model-usage")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  const cumulative = useMemo(() => {
    if (!data) return [];
    let claudeSum = 0;
    let openaiSum = 0;
    return data.map((row) => {
      claudeSum += row.claude_spend;
      openaiSum += row.codex_spend;
      return { date: row.date, claude_spend: claudeSum, codex_spend: openaiSum };
    });
  }, [data]);

  const filtered = useMemo(() => {
    const source = view === "cumulative" ? cumulative : data ?? [];
    const r = RANGES.find((r) => r.key === range);
    if (!r || r.days === Infinity) return source;
    return source.slice(-r.days);
  }, [cumulative, data, range, view]);

  if (error) {
    return (
      <div className="admin-card">
        <div className="px-5 py-4">
          <p className="text-sm" style={{ color: "var(--admin-fg-muted)" }}>
            Failed to load model usage
          </p>
        </div>
      </div>
    );
  }

  if (!data) return <Skeleton />;

  const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const axisColor = isDark ? "#555" : "#999";
  const tooltipBg = isDark ? "#1A1A1A" : "#FFF";
  const tooltipBorder = isDark
    ? "rgba(255,255,255,0.08)"
    : "rgba(0,0,0,0.12)";

  const subtitle =
    view === "cumulative"
      ? "Cumulative spend by provider"
      : "Daily spend by provider";

  const sharedXAxis = (
    <XAxis
      dataKey="date"
      tickFormatter={formatDate}
      tick={{ fontSize: 11, fill: axisColor }}
      tickLine={false}
      axisLine={false}
    />
  );

  const sharedYAxis = (
    <YAxis
      tickFormatter={formatUsd}
      tick={{ fontSize: 11, fill: axisColor }}
      tickLine={false}
      axisLine={false}
      width={70}
    />
  );

  const sharedTooltip = (
    <Tooltip
      formatter={(value, name) => [
        formatUsd(Number(value)),
        name === "claude_spend" ? "Claude" : "OpenAI / Codex",
      ]}
      labelFormatter={(label) => formatDate(String(label))}
      contentStyle={{
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        background: tooltipBg,
        border: `1px solid ${tooltipBorder}`,
        borderRadius: 8,
        boxShadow: "none",
      }}
    />
  );

  const sharedLegend = (
    <Legend
      formatter={(value: string) =>
        value === "claude_spend" ? "Claude" : "OpenAI / Codex"
      }
      wrapperStyle={{ fontSize: 12 }}
    />
  );

  const sharedGrid = (
    <CartesianGrid
      strokeDasharray="3 3"
      stroke={gridColor}
      vertical={false}
    />
  );

  return (
    <div className="admin-card">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div>
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--admin-fg)" }}
          >
            Model Usage
          </h2>
          <p
            className="mt-0.5 text-xs"
            style={{ color: "var(--admin-fg-muted)" }}
          >
            {subtitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5">
            {VIEW_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setView(m.key)}
                className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-100"
                style={{
                  backgroundColor:
                    view === m.key
                      ? "var(--admin-pill-active-bg)"
                      : "var(--admin-pill-bg)",
                  color:
                    view === m.key
                      ? "var(--admin-pill-active-fg)"
                      : "var(--admin-fg-secondary)",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div
            style={{
              width: 1,
              height: 16,
              backgroundColor: "var(--admin-border)",
            }}
          />
          <div className="flex gap-0.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-100"
                style={{
                  backgroundColor:
                    range === r.key
                      ? "var(--admin-pill-active-bg)"
                      : "var(--admin-pill-bg)",
                  color:
                    range === r.key
                      ? "var(--admin-pill-active-fg)"
                      : "var(--admin-fg-secondary)",
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="h-[300px] px-2 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          {view === "cumulative" ? (
            <LineChart data={filtered}>
              {sharedGrid}
              {sharedXAxis}
              {sharedYAxis}
              {sharedTooltip}
              {sharedLegend}
              <Line
                type="monotone"
                dataKey="claude_spend"
                stroke="#DF561F"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="codex_spend"
                stroke="#2A9D8F"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          ) : (
            <BarChart data={filtered}>
              {sharedGrid}
              {sharedXAxis}
              {sharedYAxis}
              {sharedTooltip}
              {sharedLegend}
              <Bar
                dataKey="codex_spend"
                fill="#2A9D8F"
                radius={[3, 3, 0, 0]}
                stackId="spend"
              />
              <Bar
                dataKey="claude_spend"
                fill="#DF561F"
                radius={[3, 3, 0, 0]}
                stackId="spend"
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
