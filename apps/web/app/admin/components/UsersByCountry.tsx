"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { useAdminTheme } from "./AdminShell";

interface CountryRow {
  country: string;
  user_count: number;
  percentage: number;
}

const COLORS = [
  "#DF561F", // accent
  "#3B82F6", // blue
  "#10B981", // emerald
  "#F59E0B", // amber
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#84CC16", // lime
  "#F97316", // orange
  "#6366F1", // indigo
  "#14B8A6", // teal
  "#E11D48", // rose
  "#A855F7", // purple
  "#EAB308", // yellow
  "#22D3EE", // sky
  "#FB923C", // light-orange
];

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  MX: "Mexico",
  IN: "India",
  FR: "France",
  KR: "South Korea",
  CA: "Canada",
  PE: "Peru",
  JP: "Japan",
  DE: "Germany",
  ES: "Spain",
  CL: "Chile",
  DK: "Denmark",
  GB: "United Kingdom",
  GT: "Guatemala",
  EG: "Egypt",
  TW: "Taiwan",
  PY: "Paraguay",
  SN: "Senegal",
  NZ: "New Zealand",
  AE: "UAE",
  AU: "Australia",
  RO: "Romania",
  IE: "Ireland",
  ID: "Indonesia",
  LB: "Lebanon",
  PL: "Poland",
  PT: "Portugal",
  NG: "Nigeria",
  IT: "Italy",
  Unknown: "Unknown",
};

function Skeleton() {
  return (
    <div className="admin-card">
      <div className="px-5 pt-4 pb-2">
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--admin-fg)" }}
        >
          Users by Country
        </h2>
      </div>
      <div className="flex items-center justify-center px-5 pb-5" style={{ height: 320 }}>
        <div
          className="h-48 w-48 animate-pulse rounded-full"
          style={{ backgroundColor: "var(--admin-border)" }}
        />
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div
      className="rounded-md px-3 py-2 text-xs shadow-lg"
      style={{
        backgroundColor: "var(--admin-bg)",
        border: "1px solid var(--admin-border)",
        color: "var(--admin-fg)",
      }}
    >
      <span className="font-medium">{name}</span>: {value}%
    </div>
  );
}

function renderLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) {
  if (percent < 0.03) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {(percent * 100).toFixed(0)}%
    </text>
  );
}

export function UsersByCountry() {
  const [data, setData] = useState<CountryRow[] | null>(null);
  const { theme } = useAdminTheme();

  useEffect(() => {
    fetch("/api/admin/users-by-country")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData([]));
  }, []);

  if (!data) return <Skeleton />;

  // Group countries with < 1.5% into "Other"
  const threshold = 1.5;
  const major: CountryRow[] = [];
  let otherPct = 0;
  let otherCount = 0;
  for (const row of data) {
    if (row.percentage >= threshold) {
      major.push(row);
    } else {
      otherPct += row.percentage;
      otherCount += row.user_count;
    }
  }
  if (otherCount > 0) {
    major.push({
      country: "Other",
      user_count: otherCount,
      percentage: Math.round(otherPct * 10) / 10,
    });
  }

  const chartData = major.map((row) => ({
    name: COUNTRY_NAMES[row.country] ?? row.country,
    value: row.percentage,
  }));

  return (
    <div className="admin-card">
      <div className="px-5 pt-4 pb-2">
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--admin-fg)" }}
        >
          Users by Country
        </h2>
      </div>
      <div className="px-5 pb-5" style={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="45%"
              outerRadius={120}
              dataKey="value"
              label={renderLabel}
              labelLine={false}
              stroke={theme === "dark" ? "#1a1a1a" : "#fff"}
              strokeWidth={2}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              iconSize={8}
              formatter={(value: string) => (
                <span
                  style={{
                    color: "var(--admin-fg-secondary)",
                    fontSize: 11,
                  }}
                >
                  {value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
