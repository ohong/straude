import { formatTokens } from "@/lib/utils/format";
import {
  buildHeatmapGrid,
  getHeatmapCellColor,
  getHeatmapLegend,
} from "./heatmap";
import type { ProfileShareCardData } from "./profile-card-data";

function StatBlock({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        minWidth: 0,
        flexDirection: "column",
        borderRadius: 24,
        padding: "18px 20px",
        backgroundColor: accent ? "rgba(223,86,31,0.10)" : "rgba(255,255,255,0.82)",
        border: accent
          ? "1px solid rgba(223,86,31,0.18)"
          : "1px solid rgba(39,30,22,0.08)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#7C6656",
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: value.length > 12 ? 28 : 34,
          fontWeight: 700,
          color: accent ? "#B7461D" : "#211C18",
          lineHeight: 1.05,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function ProfileShareCardImage({
  data,
}: {
  data: ProfileShareCardData;
}) {
  const width = 1200;
  const height = 630;
  const { cells, monthLabels, weekCount } = buildHeatmapGrid(data.contribution_data);
  const legend = getHeatmapLegend();
  const columns = Array.from({ length: weekCount }, (_, weekIndex) =>
    cells.filter((cell) => cell.weekIndex === weekIndex)
  );
  const heroName = data.display_name?.trim() || `@${data.username}`;

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter",
        background: "linear-gradient(135deg, #FBF5EE 0%, #F4E7D7 52%, #F0D0B6 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -140,
          right: -120,
          width: 360,
          height: 360,
          borderRadius: 999,
          backgroundColor: "rgba(223,86,31,0.10)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -90,
          bottom: -120,
          width: 320,
          height: 320,
          borderRadius: 999,
          backgroundColor: "rgba(248,183,103,0.16)",
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          flex: 1,
          flexDirection: "column",
          padding: 44,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <svg width="28" height="28" viewBox="0 0 32 32">
                <polygon points="6.4,0 25.6,0 32,32 0,32" fill="#DF561F" />
              </svg>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#201914",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                }}
              >
                STRAUDE
              </div>
            </div>
            <div
              style={{
                marginTop: 18,
                fontSize: 44,
                fontWeight: 700,
                color: "#201914",
                letterSpacing: "-0.04em",
                lineHeight: 1.02,
              }}
            >
              {heroName}
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 18,
                fontWeight: 500,
                color: "#705D4F",
              }}
            >
              {`@${data.username} consistency card`}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase" as const,
                color: "#8B6B57",
              }}
            >
              Current streak
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 58,
                fontWeight: 700,
                color: "#B7461D",
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              {`${data.streak}d`}
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 15,
                fontWeight: 500,
                color: "#7C6656",
              }}
            >
              show the grind, not just the result
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 30,
            borderRadius: 30,
            backgroundColor: "rgba(255,251,246,0.74)",
            border: "1px solid rgba(39,30,22,0.08)",
            padding: "28px 28px 24px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 16,
              paddingLeft: 42,
            }}
          >
            {monthLabels.map((label) => (
              <div
                key={`${label.label}-${label.weekIndex}`}
                style={{
                  display: "flex",
                  width: label.weekIndex === weekCount - 1 ? 16 : 18,
                  marginLeft: label.weekIndex === 0 ? 0 : label.weekIndex * 2,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#8B6B57",
                }}
              >
                {label.label}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 30,
                flexDirection: "column",
                gap: 9,
                paddingTop: 2,
              }}
            >
              <div
                style={{
                  display: "flex",
                  height: 14,
                  alignItems: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#9D8877",
                }}
              >
                Sun
              </div>
              <div style={{ display: "flex", height: 14 }} />
              <div
                style={{
                  display: "flex",
                  height: 14,
                  alignItems: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#9D8877",
                }}
              >
                Tue
              </div>
              <div style={{ display: "flex", height: 14 }} />
              <div
                style={{
                  display: "flex",
                  height: 14,
                  alignItems: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#9D8877",
                }}
              >
                Thu
              </div>
              <div style={{ display: "flex", height: 14 }} />
              <div
                style={{
                  display: "flex",
                  height: 14,
                  alignItems: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#9D8877",
                }}
              >
                Sat
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 4,
              }}
            >
              {columns.map((column, index) => (
                <div
                  key={`week-${index}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  {Array.from({ length: 7 }, (_, dayIndex) => {
                    const cell = column.find((entry) => entry.dayIndex === dayIndex);
                    const backgroundColor = cell?.inRange
                      ? getHeatmapCellColor(cell.cost_usd)
                      : "rgba(255,255,255,0)";

                    return (
                      <div
                        key={`cell-${index}-${dayIndex}`}
                        style={{
                          display: "flex",
                          width: 14,
                          height: 14,
                          borderRadius: 4,
                          backgroundColor,
                          border: cell?.inRange
                            ? "1px solid rgba(39,30,22,0.04)"
                            : "1px solid rgba(255,255,255,0)",
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 20,
              paddingLeft: 42,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase" as const,
                color: "#8B6B57",
              }}
            >
              Less
            </div>
            {legend.map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  backgroundColor: item.color,
                }}
              />
            ))}
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase" as const,
                color: "#8B6B57",
              }}
            >
              More
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: "auto",
          }}
        >
          <StatBlock
            label="Output Total"
            value={`${formatTokens(data.total_output_tokens)} tokens`}
            accent
          />
          <StatBlock
            label="Recent 30d"
            value={`${formatTokens(data.recent_output_tokens)} tokens`}
          />
          <StatBlock label="Active 30d" value={`${data.active_days_last_30} days`} />
          <StatBlock label="Most Used" value={data.primary_model} />
        </div>
      </div>
    </div>
  );
}
