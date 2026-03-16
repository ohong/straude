"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useAdminTheme } from "./AdminShell";

interface ModelUsageRow {
  date: string;
  claude_spend: number;
  codex_spend: number;
}

const RANGES = [
  { key: "14d", label: "14D", days: 14 },
  { key: "30d", label: "30D", days: 30 },
  { key: "all", label: "All", days: Infinity },
] as const;

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function useChartTheme() {
  const { theme } = useAdminTheme();
  const isDark = theme === "dark";
  return {
    isDark,
    gridColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)",
    axisColor: isDark ? "#555" : "#999",
    tooltipBg: isDark ? "#1A1A1A" : "#FFF",
    tooltipBorder: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.12)",
  };
}

function useModelUsageData() {
  const [data, setData] = useState<ModelUsageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/model-usage")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  return { data, error };
}

function RangePills({
  range,
  setRange,
}: {
  range: string;
  setRange: (r: string) => void;
}) {
  return (
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
  );
}

function ChartCard({
  title,
  subtitle,
  range,
  setRange,
  children,
}: {
  title: string;
  subtitle: string;
  range: string;
  setRange: (r: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-card">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div>
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--admin-fg)" }}
          >
            {title}
          </h2>
          <p
            className="mt-0.5 text-xs"
            style={{ color: "var(--admin-fg-muted)" }}
          >
            {subtitle}
          </p>
        </div>
        <RangePills range={range} setRange={setRange} />
      </div>
      <div className="h-[260px] px-2 pb-4">{children}</div>
    </div>
  );
}

function filterByRange(data: any[], range: string) {
  const r = RANGES.find((r) => r.key === range);
  if (!r || r.days === Infinity) return data;
  return data.slice(-r.days);
}

// ---------------------------------------------------------------------------
// Chart A: Codex % Share (Area)
// ---------------------------------------------------------------------------
function CodexShareChart({ data }: { data: ModelUsageRow[] }) {
  const t = useChartTheme();
  const [range, setRange] = useState("30d");

  // 7-day rolling average to smooth daily noise
  const smoothed = useMemo(() => {
    const window = 7;
    return data.map((row, i) => {
      const start = Math.max(0, i - window + 1);
      const slice = data.slice(start, i + 1);
      const totalCodex = slice.reduce((s, r) => s + r.codex_spend, 0);
      const totalAll = slice.reduce(
        (s, r) => s + r.codex_spend + r.claude_spend,
        0
      );
      const pct = totalAll > 0 ? (totalCodex / totalAll) * 100 : 0;
      return { date: row.date, codex_pct: Math.round(pct * 10) / 10 };
    });
  }, [data]);

  const filtered = filterByRange(smoothed, range);
  const latest = filtered.length > 0 ? filtered[filtered.length - 1].codex_pct : 0;

  return (
    <ChartCard
      title="Codex Share"
      subtitle={`${latest.toFixed(1)}% of daily spend (7-day avg)`}
      range={range}
      setRange={setRange}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={filtered}>
          <defs>
            <linearGradient id="codexShareGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4451FF" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#4451FF" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={t.gridColor}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: t.axisColor }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: t.axisColor }}
            tickLine={false}
            axisLine={false}
            width={45}
            domain={[0, "auto"]}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(1)}%`, "Codex share"]}
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              background: t.tooltipBg,
              border: `1px solid ${t.tooltipBorder}`,
              borderRadius: 8,
              boxShadow: "none",
            }}
          />
          <Area
            type="monotone"
            dataKey="codex_pct"
            stroke="#4451FF"
            strokeWidth={2}
            fill="url(#codexShareGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Chart B: Side-by-Side Bars
// ---------------------------------------------------------------------------
function DualBarsChart({ data }: { data: ModelUsageRow[] }) {
  const t = useChartTheme();
  const [range, setRange] = useState("30d");
  const filtered = filterByRange(data, range);

  return (
    <ChartCard
      title="Daily Spend"
      subtitle="Claude vs Codex side by side"
      range={range}
      setRange={setRange}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={filtered} barGap={1} barCategoryGap="20%">
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={t.gridColor}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: t.axisColor }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(v) =>
              `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
            }
            tick={{ fontSize: 11, fill: t.axisColor }}
            tickLine={false}
            axisLine={false}
            width={60}
          />
          <Tooltip
            formatter={(value, name) => [
              `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              name === "claude_spend" ? "Claude" : "Codex",
            ]}
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              background: t.tooltipBg,
              border: `1px solid ${t.tooltipBorder}`,
              borderRadius: 8,
              boxShadow: "none",
            }}
          />
          <Bar
            dataKey="claude_spend"
            fill="#DF561F"
            radius={[2, 2, 0, 0]}
            name="claude_spend"
          />
          <Bar
            dataKey="codex_spend"
            fill="#4451FF"
            radius={[2, 2, 0, 0]}
            name="codex_spend"
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Chart D: Indexed Growth (base 100)
// ---------------------------------------------------------------------------
function IndexedGrowthChart({ data }: { data: ModelUsageRow[] }) {
  const t = useChartTheme();
  const [range, setRange] = useState("all");

  const indexed = useMemo(() => {
    if (data.length === 0) return [];

    // Use 7-day rolling cumulative to smooth, then index to 100
    let claudeCum = 0;
    let codexCum = 0;
    const cumRows = data.map((row) => {
      claudeCum += row.claude_spend;
      codexCum += row.codex_spend;
      return { date: row.date, claude: claudeCum, codex: codexCum };
    });

    // Find first row where both have non-zero values for the base
    const baseRow = cumRows.find((r) => r.claude > 0 && r.codex > 0);
    if (!baseRow) return cumRows.map((r) => ({ date: r.date, claude: 100, codex: 100 }));

    const baseIdx = cumRows.indexOf(baseRow);
    const baseClaude = baseRow.claude;
    const baseCodex = baseRow.codex;

    return cumRows.slice(baseIdx).map((r) => ({
      date: r.date,
      claude: Math.round((r.claude / baseClaude) * 100),
      codex: Math.round((r.codex / baseCodex) * 100),
    }));
  }, [data]);

  const filtered = filterByRange(indexed, range);
  const latest = filtered.length > 0 ? filtered[filtered.length - 1] : null;

  return (
    <ChartCard
      title="Indexed Growth"
      subtitle={
        latest
          ? `Claude ${latest.claude}, Codex ${latest.codex} (base 100)`
          : "Both indexed to 100 at first overlap"
      }
      range={range}
      setRange={setRange}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={filtered}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={t.gridColor}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: t.axisColor }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: t.axisColor }}
            tickLine={false}
            axisLine={false}
            width={50}
          />
          <Tooltip
            formatter={(value, name) => [
              String(value),
              name === "claude" ? "Claude" : "Codex",
            ]}
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              background: t.tooltipBg,
              border: `1px solid ${t.tooltipBorder}`,
              borderRadius: 8,
              boxShadow: "none",
            }}
          />
          <ReferenceLine
            y={100}
            stroke={t.isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}
            strokeDasharray="4 4"
          />
          <Line
            type="monotone"
            dataKey="claude"
            stroke="#DF561F"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="codex"
            stroke="#4451FF"
            strokeWidth={2.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Export: 2x2 grid of all 4 options
// ---------------------------------------------------------------------------
export function CodexGrowthCharts() {
  const { data, error } = useModelUsageData();

  if (error) {
    return (
      <div className="admin-card">
        <div className="px-5 py-4">
          <p className="text-sm" style={{ color: "var(--admin-fg-muted)" }}>
            Failed to load Codex growth charts
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="admin-card">
        <div className="space-y-2 px-5 py-5">
          {Array.from({ length: 4 }).map((_, i) => (
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

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <CodexShareChart data={data} />
        <DualBarsChart data={data} />
      </div>
      <IndexedGrowthChart data={data} />
    </div>
  );
}
