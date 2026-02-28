"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useAdminTheme } from "./AdminShell";

interface Bucket {
  bucket: string;
  bucket_order: number;
  user_count: number;
}

export function TimeToFirstSync({ data }: { data: Bucket[] }) {
  const { theme } = useAdminTheme();
  const isDark = theme === "dark";

  const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const axisColor = isDark ? "#555" : "#999";
  const tooltipBg = isDark ? "#1A1A1A" : "#FFF";
  const tooltipBorder = isDark
    ? "rgba(255,255,255,0.08)"
    : "rgba(0,0,0,0.12)";

  const total = data.reduce((sum, d) => sum + d.user_count, 0);

  return (
    <div className="admin-card">
      <div className="px-5 pt-4 pb-2">
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--admin-fg)" }}
        >
          Time to First Sync
        </h2>
        <p
          className="mt-0.5 text-xs"
          style={{ color: "var(--admin-fg-muted)" }}
        >
          How fast users push their first data
        </p>
      </div>
      <div className="h-[240px] px-2 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="20%">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridColor}
              vertical={false}
            />
            <XAxis
              dataKey="bucket"
              tick={{ fontSize: 11, fill: axisColor }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: axisColor }}
              tickLine={false}
              axisLine={false}
              width={30}
            />
            <Tooltip
              formatter={(value) => {
                const pct =
                  total > 0
                    ? Math.round((Number(value) / total) * 100)
                    : 0;
                return [`${value} users (${pct}%)`, "Count"];
              }}
              contentStyle={{
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                background: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: 8,
                boxShadow: "none",
              }}
            />
            <Bar dataKey="user_count" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.bucket}
                  fill="#DF561F"
                  fillOpacity={entry.bucket === "Never" ? 0.25 : 0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
