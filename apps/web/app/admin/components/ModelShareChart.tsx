"use client";

import { useEffect, useMemo, useState } from "react";
import {
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

interface RpcRow {
  date: string;
  model_family: string;
  spend: number;
}

/** All known model families in stack order (bottom → top). */
const FAMILIES = ["Claude", "GPT", "OpenAI o-series", "Other"] as const;

/** Families from the RPC that should be merged into "Claude". */
const CLAUDE_FAMILIES = new Set(["Opus", "Sonnet", "Haiku", "Claude (other)"]);

const COLORS: Record<string, string> = {
  Claude: "#DF561F",
  GPT: "#4451FF",
  "OpenAI o-series": "#06B6D4",
  Other: "#6B7280",
};

const RANGES = [
  { key: "14d", label: "14D", days: 14 },
  { key: "30d", label: "30D", days: 30 },
  { key: "all", label: "All", days: Infinity },
] as const;

type DayRow = Record<string, string | number>;

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Skeleton() {
  return (
    <div className="admin-card">
      <div className="px-5 pt-4 pb-2">
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--admin-fg)" }}
        >
          Model Share
        </h2>
        <p
          className="mt-0.5 text-xs"
          style={{ color: "var(--admin-fg-muted)" }}
        >
          Loading&hellip;
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

export function ModelShareChart() {
  const { theme } = useAdminTheme();
  const isDark = theme === "dark";
  const [raw, setRaw] = useState<RpcRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<string>("30d");

  useEffect(() => {
    fetch("/api/admin/model-share")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setRaw)
      .catch((err) => setError(err.message));
  }, []);

  // Pivot: group by date, each family becomes a key with its % of total spend
  const { data, activeFamilies } = useMemo(() => {
    if (!raw) return { data: [], activeFamilies: [] as string[] };

    // Build per-day totals, merging Claude sub-families
    const byDate = new Map<string, Record<string, number>>();
    for (const row of raw) {
      if (!byDate.has(row.date)) byDate.set(row.date, {});
      const day = byDate.get(row.date)!;
      const family = CLAUDE_FAMILIES.has(row.model_family) ? "Claude" : row.model_family;
      day[family] = (day[family] ?? 0) + row.spend;
    }

    // Exclude dates past today in the client's local timezone
    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    let dates = [...byDate.keys()].filter((d) => d <= today).sort();

    // Filter by range
    const r = RANGES.find((r) => r.key === range);
    if (r && r.days !== Infinity) {
      dates = dates.slice(-r.days);
    }

    // Find which families actually appear
    const seenFamilies = new Set<string>();

    // Convert to percentage rows
    const rows: DayRow[] = dates.map((date) => {
      const day = byDate.get(date)!;
      const total = Object.values(day).reduce((s, v) => s + v, 0);
      const row: DayRow = { date };
      for (const fam of FAMILIES) {
        const val = day[fam] ?? 0;
        row[fam] = total > 0 ? (val / total) * 100 : 0;
        if (val > 0) seenFamilies.add(fam);
      }
      return row;
    });

    return {
      data: rows,
      activeFamilies: FAMILIES.filter((f) => seenFamilies.has(f)),
    };
  }, [raw, range]);

  if (error) {
    return (
      <div className="admin-card">
        <div className="px-5 py-4">
          <p className="text-sm" style={{ color: "var(--admin-fg-muted)" }}>
            Failed to load model share
          </p>
        </div>
      </div>
    );
  }

  if (!raw) return <Skeleton />;

  const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const axisColor = isDark ? "#555" : "#999";
  const tooltipBg = isDark ? "#1A1A1A" : "#FFF";
  const tooltipBorder = isDark
    ? "rgba(255,255,255,0.08)"
    : "rgba(0,0,0,0.12)";

  return (
    <div className="admin-card">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div>
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--admin-fg)" }}
          >
            Model Share
          </h2>
          <p
            className="mt-0.5 text-xs"
            style={{ color: "var(--admin-fg-muted)" }}
          >
            Daily spend share by model family
          </p>
        </div>
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
      <div className="h-[300px] px-2 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} stackOffset="none">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridColor}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 11, fill: axisColor }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${Math.round(v)}%`}
              tick={{ fontSize: 11, fill: axisColor }}
              tickLine={false}
              axisLine={false}
              width={40}
              domain={[0, 100]}
              allowDecimals={false}
              ticks={[0, 25, 50, 75, 100]}
            />
            <Tooltip
              formatter={(value, name) => [
                `${Number(value).toFixed(1)}%`,
                String(name),
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
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {activeFamilies.map((family, i) => (
              <Bar
                key={family}
                dataKey={family}
                stackId="share"
                fill={COLORS[family]}
                radius={
                  i === activeFamilies.length - 1 ? [3, 3, 0, 0] : undefined
                }
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
