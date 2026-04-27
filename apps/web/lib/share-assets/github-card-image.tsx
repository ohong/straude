import {
  buildHeatmapGrid,
  getHeatmapCellColor,
} from "./heatmap";
import { getShareTheme } from "@/lib/share-themes";
import type { GithubCardData } from "./github-card-data";
import { formatCurrency } from "@/lib/utils/format";

type ThemeId = "light" | "dark";

function formatCost(cost: number): string {
  if (cost >= 100_000) return `$${(cost / 1_000).toFixed(0)}k`;
  if (cost >= 10_000) return `$${(cost / 1_000).toFixed(1)}k`;
  if (cost >= 1_000) return `$${Math.round(cost).toLocaleString("en-US")}`;
  return `$${formatCurrency(cost)}`;
}

function StatBlock({
  label,
  value,
  theme,
  accent = false,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof getShareTheme>;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        minWidth: 0,
        flexDirection: "column",
        borderRadius: 10,
        padding: "8px 10px",
        backgroundColor: accent
          ? "rgba(223,86,31,0.10)"
          : theme.surface,
        border: accent
          ? "1px solid rgba(223,86,31,0.18)"
          : `1px solid ${theme.surfaceBorder}`,
      }}
    >
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: accent ? theme.accent : theme.textPrimary,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 3,
          fontSize: 9,
          fontWeight: 500,
          color: theme.textTertiary,
          letterSpacing: "0.06em",
          textTransform: "uppercase" as const,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function GithubCardImage({
  data,
  themeId,
}: {
  data: GithubCardData;
  themeId: ThemeId;
}) {
  const theme = getShareTheme(themeId);
  const { cells, weekCount } = buildHeatmapGrid(data.contribution_data, {
    rangeDays: 84,
  });
  const columns = Array.from({ length: weekCount }, (_, weekIndex) =>
    cells.filter((cell) => cell.weekIndex === weekIndex)
  );

  const heroName = data.display_name?.trim() || `@${data.username}`;
  const subtitle = data.level
    ? `@${data.username} · Lv ${data.level}`
    : `@${data.username}`;

  const zeroCostColor =
    themeId === "dark" ? "rgba(255,255,255,0.08)" : "#EAE2D7";

  return (
    <div
      style={{
        width: 495,
        height: 270,
        display: "flex",
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter",
        background: theme.background,
      }}
    >
      {/* Content */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flex: 1,
          flexDirection: "column",
          padding: "20px 24px",
        }}
      >
        {/* Header: logo + wordmark + straude.com */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 32 32">
              <polygon points="6.4,0 25.6,0 32,32 0,32" fill="#DF561F" />
            </svg>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: theme.textPrimary,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
              }}
            >
              STRAUDE
            </div>
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: theme.textTertiary,
            }}
          >
            straude.com
          </div>
        </div>

        {/* Name row + hero stat */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginTop: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: theme.textPrimary,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
              }}
            >
              {heroName}
            </div>
            <div
              style={{
                marginTop: 3,
                fontSize: 11,
                fontWeight: 500,
                color: theme.textTertiary,
              }}
            >
              {subtitle}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: theme.accent,
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              {formatCost(data.total_cost)}
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: 9,
                fontWeight: 500,
                color: theme.textTertiary,
                letterSpacing: "0.06em",
                textTransform: "uppercase" as const,
              }}
            >
              total spend
            </div>
          </div>
        </div>

        {/* Stat blocks */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 14,
          }}
        >
          <StatBlock
            label="streak"
            value={`${data.streak}d`}
            theme={theme}
            accent
          />
          <StatBlock
            label="rank"
            value={data.global_rank ? `#${data.global_rank}` : "—"}
            theme={theme}
          />
          <StatBlock
            label="active days"
            value={`${data.active_days_last_30}/30`}
            theme={theme}
          />
          <StatBlock
            label="model"
            value={data.primary_model}
            theme={theme}
          />
        </div>

        {/* Mini heatmap */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: "auto",
            gap: 6,
          }}
        >
          <div
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color: theme.textTertiary,
            }}
          >
            Less
          </div>
          <div
            style={{
              display: "flex",
              gap: 2,
              flex: 1,
            }}
          >
            {columns.map((column, colIdx) => (
              <div
                key={`week-${colIdx}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                {Array.from({ length: 7 }, (_, dayIndex) => {
                  const cell = column.find((entry) => entry.dayIndex === dayIndex);
                  const cost = cell?.cost_usd ?? 0;
                  const inRange = cell?.inRange ?? false;
                  const backgroundColor = inRange
                    ? cost <= 0
                      ? zeroCostColor
                      : getHeatmapCellColor(cost)
                    : "rgba(0,0,0,0)";

                  return (
                    <div
                      key={`cell-${colIdx}-${dayIndex}`}
                      style={{
                        display: "flex",
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        backgroundColor,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color: theme.textTertiary,
            }}
          >
            More
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrivateCardImage({
  username,
  themeId,
}: {
  username: string;
  themeId: ThemeId;
}) {
  const theme = getShareTheme(themeId);

  return (
    <div
      style={{
        width: 495,
        height: 270,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter",
        background: theme.background,
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="18" height="18" viewBox="0 0 32 32">
          <polygon points="6.4,0 25.6,0 32,32 0,32" fill="#DF561F" />
        </svg>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: theme.textPrimary,
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
          }}
        >
          STRAUDE
        </div>
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: theme.textPrimary,
        }}
      >
        @{username}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: theme.textTertiary,
        }}
      >
        This profile is private
      </div>
    </div>
  );
}
