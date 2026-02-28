import type { RecapData } from "./recap";
import { formatTokens, getCellColor } from "./format";

/** Fill in missing days with $0 entries — only up to today (no future days) */
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

  // Cap at today — don't render future days
  const msPerDay = 86400000;
  const daysSinceStart =
    Math.floor((now.getTime() - start.getTime()) / msPerDay) + 1;
  const cappedDays = Math.min(totalDays, daysSinceStart);

  const result: { date: string; cost_usd: number }[] = [];
  for (let i = 0; i < cappedDays; i++) {
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
 *
 * `backgroundCss` should be a CSS gradient string for the background.
 */
export function RecapCardImage({
  data,
  format = "landscape",
  backgroundCss,
}: {
  data: RecapData;
  format?: "landscape" | "square";
  backgroundCss?: string;
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
          fontFamily: "Inter",
          position: "relative",
        }}
      >
        {/* Background gradient */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            background: backgroundCss ?? "#fff",
          }}
        />
        {/* White overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            backgroundColor: backgroundCss
              ? "rgba(255,255,255,0.78)"
              : "#fff",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding,
            position: "relative",
            flex: 1,
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
                color: "#666",
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
              {`$${data.total_cost.toFixed(2)}`}
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 500,
                color: "#999",
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
              color: "#999",
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
            <div style={{ color: "#666" }}>{`@${data.username}`}</div>
            <div style={{ color: "#999" }}>straude.com</div>
          </div>
        </div>
      </div>
    );
  }

  // Landscape (1200x630) — single-column vertical flow, matching web UI
  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter",
        position: "relative",
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          background: backgroundCss ?? "#fff",
        }}
      />
      {/* White overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          backgroundColor: backgroundCss
            ? "rgba(255,255,255,0.78)"
            : "#fff",
        }}
      />

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding,
          position: "relative",
          flex: 1,
        }}
      >
        {/* Header: logo left, period label right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <svg width="36" height="36" viewBox="0 0 32 32">
            <polygon points="6.4,0 25.6,0 32,32 0,32" fill="#DF561F" />
          </svg>
          <div
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: "#666",
            }}
          >
            {data.period_label}
          </div>
        </div>

        {/* Hero cost */}
        <div
          style={{
            fontSize: 112,
            fontWeight: 700,
            color: "#DF561F",
            letterSpacing: "-0.03em",
            lineHeight: 1,
            marginTop: 20,
          }}
        >
          {`$${data.total_cost.toFixed(2)}`}
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: "#999",
            marginTop: 4,
            textTransform: "uppercase" as const,
            letterSpacing: "0.1em",
          }}
        >
          total spend
        </div>

        {/* Stats row — 4 across */}
        <div
          style={{
            display: "flex",
            gap: 48,
            marginTop: 28,
          }}
        >
          <StatBox
            label="Output"
            value={formatTokens(data.output_tokens)}
            large
          />
          <StatBox
            label="Active"
            value={`${data.active_days}/${data.total_days}`}
            suffix="days"
            large
          />
          <StatBox label="Sessions" value={String(data.session_count)} large />
          <StatBox
            label="Streak"
            value={String(data.streak)}
            suffix="days"
            accent
            large
          />
        </div>

        {/* Model */}
        <div
          style={{
            fontSize: 20,
            fontWeight: 500,
            color: "#999",
            marginTop: 20,
          }}
        >
          {`Powered by ${data.primary_model}`}
        </div>

        {/* Contribution strip */}
        <div
          style={{
            display: "flex",
            gap: cellGap,
            marginTop: 16,
          }}
        >
          {allDays.map((day) => (
            <div
              key={day.date}
              style={{
                height: 16,
                backgroundColor: getCellColor(day.cost_usd),
                borderRadius: 3,
                flex: 1,
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
            fontSize: 20,
            fontWeight: 500,
          }}
        >
          <div style={{ color: "#666" }}>{`@${data.username}`}</div>
          <div style={{ color: "#999" }}>straude.com</div>
        </div>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  suffix,
  accent,
  large,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
  large?: boolean;
}) {
  const labelSize = large ? 18 : 12;
  const valueSize = large ? 42 : 28;
  const suffixSize = large ? 22 : 14;
  const emojiSize = large ? 34 : 22;

  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: large ? 160 : 120 }}>
      <div
        style={{
          fontSize: labelSize,
          fontWeight: 500,
          color: "#999",
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
          fontSize: valueSize,
          fontWeight: 700,
          color: accent ? "#DF561F" : "#000",
          letterSpacing: "-0.02em",
        }}
      >
        {accent && (
          <span style={{ fontSize: emojiSize, marginRight: 2 }}>🔥</span>
        )}
        <span>{value}</span>
        {suffix && (
          <span
            style={{
              fontSize: suffixSize,
              fontWeight: 500,
              color: "#999",
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
