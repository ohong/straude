"use client";

import { useAdminTheme } from "./AdminShell";

interface CohortRow {
  cohort_week: string;
  cohort_size: number;
  week_0: number | null;
  week_1: number | null;
  week_2: number | null;
  week_3: number | null;
  week_4: number | null;
}

const WEEK_COLS = ["week_0", "week_1", "week_2", "week_3", "week_4"] as const;

function cellColor(pct: number | null, isDark: boolean): string {
  if (pct === null || pct === 0) return "transparent";
  // Accent color (#DF561F) with opacity proportional to retention %
  const opacity = Math.min(pct / 100, 1) * (isDark ? 0.6 : 0.45);
  return `rgba(223, 86, 31, ${opacity})`;
}

export function CohortRetention({ data }: { data: CohortRow[] }) {
  const { theme } = useAdminTheme();
  const isDark = theme === "dark";

  return (
    <div className="admin-card">
      <div className="px-5 pt-4 pb-2">
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--admin-fg)" }}
        >
          Cohort Retention
        </h2>
        <p
          className="mt-0.5 text-xs"
          style={{ color: "var(--admin-fg-muted)" }}
        >
          Weekly retention by signup cohort
        </p>
      </div>
      <div className="overflow-x-auto px-5 pb-5">
        <table className="w-full text-xs" style={{ borderCollapse: "separate", borderSpacing: "2px" }}>
          <thead>
            <tr>
              <th
                className="px-2 py-1.5 text-left font-medium"
                style={{ color: "var(--admin-fg-secondary)" }}
              >
                Cohort
              </th>
              <th
                className="px-2 py-1.5 text-right font-medium"
                style={{ color: "var(--admin-fg-secondary)" }}
              >
                Size
              </th>
              {WEEK_COLS.map((_, i) => (
                <th
                  key={i}
                  className="px-2 py-1.5 text-center font-medium"
                  style={{ color: "var(--admin-fg-secondary)" }}
                >
                  W{i}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.cohort_week}>
                <td
                  className="px-2 py-1.5 font-medium whitespace-nowrap"
                  style={{ color: "var(--admin-fg)" }}
                >
                  {row.cohort_week}
                </td>
                <td
                  className="px-2 py-1.5 text-right font-mono tabular-nums"
                  style={{ color: "var(--admin-fg-secondary)" }}
                >
                  {row.cohort_size}
                </td>
                {WEEK_COLS.map((col, i) => {
                  const val = row[col];
                  return (
                    <td
                      key={i}
                      className="px-2 py-1.5 text-center font-mono tabular-nums"
                      style={{
                        backgroundColor: cellColor(val, isDark),
                        color:
                          val && val > 0
                            ? "var(--admin-fg)"
                            : "var(--admin-fg-muted)",
                        borderRadius: 4,
                      }}
                    >
                      {val !== null ? `${val}%` : "–"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
