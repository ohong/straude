"use client";

import { useAdminTheme } from "./AdminShell";

interface Segment {
  segment: string;
  user_count: number;
  total_spend: number;
  pct_of_total: number;
}

const SEGMENT_LABELS: Record<string, string> = {
  top_1: "Top 1",
  top_5: "Top 2–5",
  top_10: "Top 6–10",
  rest: "Everyone else",
};

const SEGMENT_OPACITIES: Record<string, number> = {
  top_1: 1,
  top_5: 0.7,
  top_10: 0.45,
  rest: 0.2,
};

function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function RevenueConcentration({ data }: { data: Segment[] }) {
  const { theme } = useAdminTheme();
  const isDark = theme === "dark";

  // Cumulative segments: top_1 is subset of top_5 which is subset of top_10
  // The RPC returns non-overlapping segments, so we need to accumulate
  const cumulativeSegments = [
    { label: "Top 1", segments: ["top_1"] },
    { label: "Top 5", segments: ["top_1", "top_5"] },
    { label: "Top 10", segments: ["top_1", "top_5", "top_10"] },
  ];

  const segmentMap = new Map(data.map((d) => [d.segment, d]));
  const grandTotal = data.reduce((sum, d) => sum + d.total_spend, 0);

  return (
    <div className="admin-card">
      <div className="px-5 pt-4 pb-2">
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--admin-fg)" }}
        >
          Revenue Concentration
        </h2>
      </div>
      <div className="space-y-4 px-5 pb-5">
        {/* Stacked bar */}
        <div
          className="flex h-8 overflow-hidden rounded-[4px]"
          style={{ backgroundColor: "var(--admin-bar-track)" }}
        >
          {data.map((seg) => (
            <div
              key={seg.segment}
              className="h-full transition-all duration-300"
              style={{
                width: `${seg.pct_of_total}%`,
                backgroundColor: "var(--admin-accent)",
                opacity: SEGMENT_OPACITIES[seg.segment] ?? 0.2,
              }}
              title={`${SEGMENT_LABELS[seg.segment] ?? seg.segment}: ${formatUsd(seg.total_spend)} (${seg.pct_of_total}%)`}
            />
          ))}
        </div>

        {/* Cumulative breakdown */}
        <div className="grid grid-cols-3 gap-3">
          {cumulativeSegments.map(({ label, segments }) => {
            const spend = segments.reduce(
              (sum, s) => sum + (segmentMap.get(s)?.total_spend ?? 0),
              0
            );
            const users = segments.reduce(
              (sum, s) => sum + (segmentMap.get(s)?.user_count ?? 0),
              0
            );
            const pct =
              grandTotal > 0
                ? Math.round((spend / grandTotal) * 100)
                : 0;
            return (
              <div key={label} className="text-center">
                <p
                  className="text-lg font-mono font-semibold tabular-nums"
                  style={{ color: "var(--admin-accent)" }}
                >
                  {pct}%
                </p>
                <p
                  className="text-xs font-medium"
                  style={{ color: "var(--admin-fg)" }}
                >
                  {label} user{users !== 1 ? "s" : ""}
                </p>
                <p
                  className="mt-0.5 text-xs font-mono tabular-nums"
                  style={{ color: "var(--admin-fg-muted)" }}
                >
                  {formatUsd(spend)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Per-segment rows */}
        <div className="space-y-2">
          {data.map((seg) => (
            <div key={seg.segment} className="flex items-center justify-between text-xs">
              <span style={{ color: "var(--admin-fg)" }}>
                {SEGMENT_LABELS[seg.segment] ?? seg.segment}
                <span
                  className="ml-1.5"
                  style={{ color: "var(--admin-fg-muted)" }}
                >
                  ({seg.user_count} user{seg.user_count !== 1 ? "s" : ""})
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="font-mono tabular-nums"
                  style={{ color: "var(--admin-fg-secondary)" }}
                >
                  {formatUsd(seg.total_spend)}
                </span>
                <span
                  className="font-mono tabular-nums"
                  style={{ color: "var(--admin-fg-muted)" }}
                >
                  {seg.pct_of_total}%
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
