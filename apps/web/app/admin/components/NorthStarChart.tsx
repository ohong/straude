"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAdminTheme } from "./AdminShell";

interface SpendRow {
  date: string;
  daily_total: number;
  cumulative_total: number;
}

const RANGES = [
  { key: "7d", label: "7D", days: 7 },
  { key: "14d", label: "14D", days: 14 },
  { key: "30d", label: "30D", days: 30 },
  { key: "all", label: "All", days: Infinity },
] as const;

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function NorthStarChart({ data }: { data: SpendRow[] }) {
  const [range, setRange] = useState<string>("all");
  const { theme } = useAdminTheme();
  const isDark = theme === "dark";

  const filtered = useMemo(() => {
    const r = RANGES.find((r) => r.key === range);
    if (!r || r.days === Infinity) return data;
    return data.slice(-r.days);
  }, [data, range]);

  const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const axisColor = isDark ? "#555" : "#999";
  const tooltipBg = isDark ? "#1A1A1A" : "#FFF";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.12)";
  const gradientStart = isDark
    ? "rgba(223,86,31,0.25)"
    : "rgba(223,86,31,0.2)";

  return (
    <div className="admin-card">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--admin-fg)" }}
        >
          Cumulative Spend
        </h2>
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
          <AreaChart data={filtered}>
            <defs>
              <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#DF561F" stopOpacity={isDark ? 0.25 : 0.2} />
                <stop offset="95%" stopColor="#DF561F" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              tickFormatter={formatUsd}
              tick={{ fontSize: 11, fill: axisColor }}
              tickLine={false}
              axisLine={false}
              width={70}
              domain={["dataMin", "dataMax"]}
            />
            <Tooltip
              formatter={(value) => [formatUsd(Number(value)), "Cumulative"]}
              labelFormatter={(label) => formatDate(String(label))}
              contentStyle={{
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                background: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: 8,
                boxShadow: "none",
              }}
              itemStyle={{ color: "#DF561F" }}
            />
            <Area
              type="monotone"
              dataKey="cumulative_total"
              stroke="#DF561F"
              strokeWidth={2}
              fill="url(#spendGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
