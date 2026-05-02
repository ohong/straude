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
} from "recharts";
import { useAdminTheme } from "./AdminShell";
import { formatDateMonDay as formatDate } from "@/lib/utils/dates";

interface SignupRow {
  date: string;
  signups: number;
}

const RANGES = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "all", label: "All", days: Infinity },
] as const;

function Skeleton() {
  return (
    <div className="admin-card">
      <div className="px-5 pt-4 pb-2">
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--admin-fg)" }}
        >
          New User Signups
        </h2>
        <p
          className="mt-0.5 text-xs"
          style={{ color: "var(--admin-fg-muted)" }}
        >
          Daily signups
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

export function UserSignupsChart() {
  const { theme } = useAdminTheme();
  const isDark = theme === "dark";
  const [data, setData] = useState<SignupRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<string>("7d");

  useEffect(() => {
    fetch("/api/admin/user-signups")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const r = RANGES.find((r) => r.key === range);
    if (!r || r.days === Infinity) return data;
    return data.slice(-r.days);
  }, [data, range]);

  const total = useMemo(
    () => filtered.reduce((sum, row) => sum + row.signups, 0),
    [filtered],
  );

  if (error) {
    return (
      <div className="admin-card">
        <div className="px-5 py-4">
          <p className="text-sm" style={{ color: "var(--admin-fg-muted)" }}>
            Failed to load signups
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

  return (
    <div className="admin-card">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div>
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--admin-fg)" }}
          >
            New User Signups
          </h2>
          <p
            className="mt-0.5 text-xs"
            style={{ color: "var(--admin-fg-muted)" }}
          >
            {total} signups in selected range
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
          <BarChart data={filtered}>
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
              allowDecimals={false}
              tick={{ fontSize: 11, fill: axisColor }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              formatter={(value) => [String(value), "Signups"]}
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
            <Bar
              dataKey="signups"
              fill="#DF561F"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
