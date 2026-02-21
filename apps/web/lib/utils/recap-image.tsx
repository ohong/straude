import type { RecapData } from "./recap";
import { formatTokens } from "./format";

/** Color scale for contribution cells — matches ContributionGraph.tsx */
function getCellColor(cost: number): string {
  if (cost <= 0) return "#333333";
  if (cost <= 10) return "#FDD0B1";
  if (cost <= 50) return "#F4945E";
  if (cost <= 100) return "#DF561F";
  return "#B8441A";
}

/** Fill in missing days with $0 entries */
function fillContributionDays(
  data: { date: string; cost_usd: number }[],
  totalDays: number,
  period: "week" | "month"
): { date: string; cost_usd: number }[] {
  const lookup = new Map(data.map((d) => [d.date, d.cost_usd]));
  const now = new Date();
  let start: Date;

  if (period === "week") {
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start = new Date(now);
    start.setDate(now.getDate() + mondayOffset);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const result: { date: string; cost_usd: number }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    result.push({ date: key, cost_usd: lookup.get(key) ?? 0 });
  }
  return result;
}

/**
 * Renders the recap card JSX for use in next/og ImageResponse.
 * Supports both landscape (1200x630) and square (1080x1080) formats.
 */
export function RecapCardImage({
  data,
  format = "landscape",
}: {
  data: RecapData;
  format?: "landscape" | "square";
}) {
  const isSquare = format === "square";
  const width = isSquare ? 1080 : 1200;
  const height = isSquare ? 1080 : 630;
  const padding = isSquare ? 64 : 48;

  const allDays = fillContributionDays(
    data.contribution_data,
    data.total_days,
    data.period
  );

  const cellGap = 4;
  const stripWidth = width - padding * 2;
  const cellWidth = Math.floor(
    (stripWidth - cellGap * (allDays.length - 1)) / allDays.length
  );
  const cellHeight = isSquare ? 24 : 16;

  if (isSquare) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#000",
          color: "#fff",
          fontFamily: "Inter",
          padding,
          position: "relative",
        }}
      >
        {/* Logo + period label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            marginBottom: 48,
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 32 32"
            style={{ marginBottom: 16 }}
          >
            <polygon points="6.4,0 25.6,0 32,32 0,32" fill="#DF561F" />
          </svg>
          <div
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: "rgba(255,255,255,0.5)",
              textAlign: "center",
            }}
          >
            {data.period_label}
          </div>
        </div>

        {/* Hero stat */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 48,
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 700,
              color: "#DF561F",
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            ${data.total_cost.toFixed(2)}
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: "rgba(255,255,255,0.4)",
              marginTop: 8,
              textTransform: "uppercase" as const,
              letterSpacing: "0.1em",
            }}
          >
            total spend
          </div>
        </div>

        {/* Stats grid */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 48,
            marginBottom: 48,
          }}
        >
          <StatBox label="Output" value={formatTokens(data.output_tokens)} />
          <StatBox
            label="Active"
            value={`${data.active_days}/${data.total_days}`}
            suffix="days"
          />
          <StatBox label="Sessions" value={String(data.session_count)} />
          <StatBox
            label="Streak"
            value={String(data.streak)}
            suffix="days"
            accent
          />
        </div>

        {/* Model */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 40,
            fontSize: 16,
            fontWeight: 500,
            color: "rgba(255,255,255,0.4)",
          }}
        >
          Powered by {data.primary_model}
        </div>

        {/* Contribution strip */}
        <div
          style={{
            display: "flex",
            gap: cellGap,
            justifyContent: "center",
          }}
        >
          {allDays.map((day) => (
            <div
              key={day.date}
              style={{
                width: cellWidth,
                height: cellHeight,
                backgroundColor: getCellColor(day.cost_usd),
                borderRadius: 3,
              }}
            />
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "auto",
            fontSize: 16,
            fontWeight: 500,
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.5)" }}>
            @{data.username}
          </div>
          <div style={{ color: "rgba(255,255,255,0.3)" }}>straude.com</div>
        </div>
      </div>
    );
  }

  // Landscape (1200x630) — OG image format
  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        backgroundColor: "#000",
        color: "#fff",
        fontFamily: "Inter",
        padding,
        position: "relative",
      }}
    >
      {/* Left side — hero stat */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flex: 1,
          paddingRight: 40,
        }}
      >
        {/* Logo */}
        <svg width="32" height="32" viewBox="0 0 32 32">
          <polygon points="6.4,0 25.6,0 32,32 0,32" fill="#DF561F" />
        </svg>

        {/* Hero cost */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#DF561F",
            letterSpacing: "-0.03em",
            lineHeight: 1,
            marginTop: 16,
          }}
        >
          ${data.total_cost.toFixed(2)}
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: "rgba(255,255,255,0.4)",
            marginTop: 8,
            textTransform: "uppercase" as const,
            letterSpacing: "0.1em",
          }}
        >
          total spend
        </div>

        {/* Model */}
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "rgba(255,255,255,0.35)",
            marginTop: 16,
          }}
        >
          Powered by {data.primary_model}
        </div>
      </div>

      {/* Right side — stats + meta */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: 380,
        }}
      >
        {/* Period label */}
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "rgba(255,255,255,0.5)",
            marginBottom: 24,
          }}
        >
          {data.period_label}
        </div>

        {/* Stats 2x2 */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 24,
          }}
        >
          <StatBox label="Output" value={formatTokens(data.output_tokens)} />
          <StatBox
            label="Active"
            value={`${data.active_days}/${data.total_days}`}
            suffix="days"
          />
          <StatBox label="Sessions" value={String(data.session_count)} />
          <StatBox
            label="Streak"
            value={String(data.streak)}
            suffix="days"
            accent
          />
        </div>
      </div>

      {/* Contribution strip — bottom */}
      <div
        style={{
          position: "absolute",
          bottom: padding + 32,
          left: padding,
          right: padding,
          display: "flex",
          gap: cellGap,
        }}
      >
        {allDays.map((day) => (
          <div
            key={day.date}
            style={{
              width: cellWidth,
              height: cellHeight,
              backgroundColor: getCellColor(day.cost_usd),
              borderRadius: 2,
              flex: 1,
            }}
          />
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          bottom: padding,
          left: padding,
          fontSize: 14,
          fontWeight: 500,
          color: "rgba(255,255,255,0.5)",
        }}
      >
        @{data.username}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: padding,
          right: padding,
          fontSize: 14,
          fontWeight: 500,
          color: "rgba(255,255,255,0.3)",
        }}
      >
        straude.com
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 120 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "rgba(255,255,255,0.4)",
          textTransform: "uppercase" as const,
          letterSpacing: "0.08em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 4,
          fontSize: 28,
          fontWeight: 700,
          color: accent ? "#DF561F" : "#fff",
          letterSpacing: "-0.02em",
        }}
      >
        {accent && (
          <span style={{ fontSize: 22, marginRight: 2 }}>🔥</span>
        )}
        <span>{value}</span>
        {suffix && (
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
