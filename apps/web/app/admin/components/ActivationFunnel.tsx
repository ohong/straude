"use client";

import { useAdminTheme } from "./AdminShell";

interface FunnelStage {
  stage: string;
  count: number;
}

const STAGE_LABELS: Record<string, string> = {
  signed_up: "Signed Up",
  onboarded: "Onboarded",
  first_usage: "First Usage",
  first_post: "First Post",
  retained_3d: "3d Retained",
};

const STAGE_ORDER = [
  "signed_up",
  "onboarded",
  "first_usage",
  "first_post",
  "retained_3d",
];

export function ActivationFunnel({ data }: { data: FunnelStage[] }) {
  const { theme } = useAdminTheme();
  const stageMap = new Map(data.map((d) => [d.stage, d.count]));
  const ordered = STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage] ?? stage,
    count: stageMap.get(stage) ?? 0,
  }));
  const max = ordered[0]?.count || 1;

  return (
    <div className="admin-card">
      <div className="px-5 pt-4 pb-2">
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--admin-fg)" }}
        >
          Activation Funnel
        </h2>
      </div>
      <div className="space-y-3 px-5 pb-5">
        {ordered.map((stage, i) => {
          const pct = max > 0 ? (stage.count / max) * 100 : 0;
          const prevCount = i > 0 ? ordered[i - 1].count : null;
          const dropoff =
            prevCount && prevCount > 0
              ? Math.round(((prevCount - stage.count) / prevCount) * 100)
              : null;

          return (
            <div key={stage.stage}>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span
                  className="font-medium"
                  style={{ color: "var(--admin-fg)" }}
                >
                  {stage.label}
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className="font-mono tabular-nums"
                    style={{ color: "var(--admin-fg-secondary)" }}
                  >
                    {stage.count}
                  </span>
                  {dropoff !== null && (
                    <span
                      className="font-mono tabular-nums"
                      style={{ color: "var(--admin-fg-muted)" }}
                    >
                      -{dropoff}%
                    </span>
                  )}
                </span>
              </div>
              <div
                className="h-5 w-full overflow-hidden rounded-[4px]"
                style={{ backgroundColor: "var(--admin-bar-track)" }}
              >
                <div
                  className="h-full rounded-[4px] transition-all duration-300"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: "var(--admin-accent)",
                    opacity: 1 - i * 0.12,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
