"use client";

type RadarData = {
  output: number;
  intensity: number;
  consistency: number;
  toolkit: number;
  community: number;
};

type RadarChartProps = {
  data: RadarData;
  size?: number;
};

const AXES = ["output", "intensity", "consistency", "toolkit", "community"] as const;
const LABELS = ["Output", "Intensity", "Consistency", "Toolkit", "Community"];
const GRID_LEVELS = [25, 50, 75, 100];

function getPoint(cx: number, cy: number, radius: number, index: number, value: number) {
  const angle = -Math.PI / 2 + index * (2 * Math.PI / 5);
  return {
    x: cx + radius * (value / 100) * Math.cos(angle),
    y: cy + radius * (value / 100) * Math.sin(angle),
  };
}

function polygonPoints(cx: number, cy: number, radius: number, values: number[]): string {
  return values
    .map((v, i) => {
      const pt = getPoint(cx, cy, radius, i, v);
      return `${pt.x},${pt.y}`;
    })
    .join(" ");
}

export function RadarChart({ data, size = 280 }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 40;
  const values = AXES.map((key) => data[key]);

  // Label positioning: offset beyond the 100% vertex, with text-anchor adjustments
  const labelOffset = 16;
  const labelPositions = AXES.map((_, i) => {
    const angle = -Math.PI / 2 + i * (2 * Math.PI / 5);
    const x = cx + (radius + labelOffset) * Math.cos(angle);
    const y = cy + (radius + labelOffset) * Math.sin(angle);

    // Determine text-anchor based on horizontal position relative to center
    let anchor: "middle" | "start" | "end" = "middle";
    let dy = "0";
    if (i === 0) {
      // Top — center above
      anchor = "middle";
      dy = "-4";
    } else if (i === 1 || i === 2) {
      // Right side
      anchor = "start";
      dy = "4";
    } else {
      // Left side
      anchor = "end";
      dy = "4";
    }

    return { x, y, anchor, dy };
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label="Radar chart showing profile scores across five dimensions"
      className="block"
    >
      {/* Grid pentagons */}
      {GRID_LEVELS.map((level) => (
        <polygon
          key={level}
          points={polygonPoints(cx, cy, radius, Array(5).fill(level))}
          fill="none"
          stroke="var(--app-border)"
          strokeWidth={1}
          opacity={0.5}
        />
      ))}

      {/* Axis lines from center to each vertex */}
      {AXES.map((_, i) => {
        const pt = getPoint(cx, cy, radius, i, 100);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={pt.x}
            y2={pt.y}
            stroke="var(--app-border)"
            strokeWidth={1}
            opacity={0.3}
          />
        );
      })}

      {/* Data polygon fill */}
      <polygon
        points={polygonPoints(cx, cy, radius, values)}
        fill="var(--app-accent)"
        fillOpacity={0.15}
        stroke="var(--app-accent)"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Data vertex dots */}
      {values.map((v, i) => {
        const pt = getPoint(cx, cy, radius, i, v);
        return (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={3}
            fill="var(--app-accent)"
          />
        );
      })}

      {/* Labels */}
      {LABELS.map((label, i) => {
        const pos = labelPositions[i]!;
        return (
          <text
            key={label}
            x={pos.x}
            y={pos.y}
            dy={pos.dy}
            textAnchor={pos.anchor}
            fill="var(--app-muted)"
            fontSize={10}
            fontWeight={600}
            letterSpacing="0.08em"
            style={{ textTransform: "uppercase" }}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
