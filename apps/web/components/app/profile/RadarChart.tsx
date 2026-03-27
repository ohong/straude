"use client";

import { useState } from "react";
import { Dialog } from "@base-ui-components/react/dialog";
import { X } from "lucide-react";

type RadarData = {
  output: number;
  intensity: number;
  consistency: number;
  toolkit: number;
  community: number;
};

const AXES = ["output", "intensity", "consistency", "toolkit", "community"] as const;
const LABELS = ["Output", "Intensity", "Consistency", "Toolkit", "Community"];
const GRID_LEVELS = [25, 50, 75, 100];

const AXIS_INFO: { name: string; description: string }[] = [
  {
    name: "Output",
    description: "Total output tokens generated across all sessions. Measures raw productive volume.",
  },
  {
    name: "Intensity",
    description: "Average spend per active day. Higher intensity means deeper, more focused sessions.",
  },
  {
    name: "Consistency",
    description: "Percentage of days active since signing up. Rewards showing up regularly.",
  },
  {
    name: "Toolkit",
    description: "Number of distinct models used. A wider toolkit signals adaptability across tasks.",
  },
  {
    name: "Community",
    description: "Followers, kudos received, and crew size. Reflects engagement beyond solo coding.",
  },
];

/* ── Coordinate system ────────────────────────────────────────────────
   The viewBox is wider than the pentagon to give labels breathing room.
   All geometry is computed from these constants so nothing clips. */
const RADIUS = 100;
const LABEL_OFFSET = 18;
const H_PAD = 85;
const V_PAD_TOP = 35;
const V_PAD_BOT = 14;
const VB_W = RADIUS * 2 + H_PAD * 2;
const VB_H = RADIUS * 2 + V_PAD_TOP + V_PAD_BOT;
const CX = H_PAD + RADIUS;
const CY = V_PAD_TOP + RADIUS;

function angle(index: number) {
  return -Math.PI / 2 + index * ((2 * Math.PI) / 5);
}

function point(index: number, value: number) {
  const a = angle(index);
  return {
    x: CX + RADIUS * (value / 100) * Math.cos(a),
    y: CY + RADIUS * (value / 100) * Math.sin(a),
  };
}

function poly(values: number[]): string {
  return values.map((v, i) => {
    const p = point(i, v);
    return `${p.x},${p.y}`;
  }).join(" ");
}

function RadarSvg({ data }: { data: RadarData }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const values = AXES.map((key) => data[key]);

  const labelPositions = AXES.map((_, i) => {
    const a = angle(i);
    const dist = RADIUS + LABEL_OFFSET;
    const x = CX + dist * Math.cos(a);
    const y = CY + dist * Math.sin(a);

    let anchor: "middle" | "start" | "end" = "middle";
    let dy = "0";
    if (i === 0) { anchor = "middle"; dy = "-6"; }
    else if (i === 1 || i === 2) { anchor = "start"; dy = "4"; }
    else { anchor = "end"; dy = "4"; }

    return { x, y, anchor, dy };
  });

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role="img"
      aria-label="Radar chart showing profile percentiles across five dimensions"
      className="block h-full w-full"
    >
      {/* Grid pentagons */}
      {GRID_LEVELS.map((level) => (
        <polygon
          key={level}
          points={poly(Array(5).fill(level))}
          fill="none"
          stroke="var(--app-border)"
          strokeWidth={1}
          opacity={0.5}
        />
      ))}

      {/* Axis lines */}
      {AXES.map((_, i) => {
        const p = point(i, 100);
        return (
          <line
            key={i}
            x1={CX}
            y1={CY}
            x2={p.x}
            y2={p.y}
            stroke="var(--app-border)"
            strokeWidth={1}
            opacity={hovered === i ? 0.6 : 0.3}
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={poly(values)}
        fill="var(--app-accent)"
        fillOpacity={0.15}
        stroke="var(--app-accent)"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Data vertex dots */}
      {values.map((v, i) => {
        const p = point(i, v);
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hovered === i ? 5 : 3}
            fill="var(--app-accent)"
          />
        );
      })}

      {/* Labels — also act as hover targets */}
      {LABELS.map((label, i) => {
        const pos = labelPositions[i]!;
        return (
          <text
            key={label}
            x={pos.x}
            y={pos.y}
            dy={pos.dy}
            textAnchor={pos.anchor}
            fill={hovered === i ? "var(--app-accent)" : "var(--app-muted)"}
            fontSize={10}
            fontWeight={600}
            letterSpacing="0.08em"
            style={{ textTransform: "uppercase", cursor: "default" }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            {label}
          </text>
        );
      })}

      {/* Percentile tooltip */}
      {hovered !== null && (() => {
        const i = hovered;
        const value = values[i]!;
        const p = point(i, value);
        const a = angle(i);
        const tx = p.x + 16 * Math.cos(a);
        const ty = p.y + 16 * Math.sin(a);
        const text = `p${Math.round(value)}`;
        const boxW = text.length * 7.5 + 10;
        const boxH = 20;

        return (
          <g style={{ pointerEvents: "none" }}>
            <rect
              x={tx - boxW / 2}
              y={ty - boxH / 2}
              width={boxW}
              height={boxH}
              rx={4}
              fill="var(--app-foreground)"
              opacity={0.92}
            />
            <text
              x={tx}
              y={ty}
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--app-background)"
              fontSize={11}
              fontWeight={700}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {text}
            </text>
          </g>
        );
      })()}

      {/* Invisible hit areas at axis endpoints for easier hover */}
      {AXES.map((_, i) => {
        const p = point(i, 100);
        return (
          <circle
            key={`hit-${i}`}
            cx={p.x}
            cy={p.y}
            r={22}
            fill="transparent"
            style={{ cursor: "default" }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        );
      })}
    </svg>
  );
}

function RadarDialogPopup({ data }: { data: RadarData }) {
  const values = AXES.map((key) => data[key]);

  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
      <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(94vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <Dialog.Title className="text-sm font-semibold">
            Profile Radar
          </Dialog.Title>
          <Dialog.Close className="rounded-sm p-1 text-muted hover:text-foreground">
            <X size={16} aria-label="Close" />
          </Dialog.Close>
        </div>
        <p className="px-4 pt-3 text-xs text-muted">
          Each axis is a percentile rank across all Straude users.
        </p>
        <div className="flex flex-col gap-1 px-3 py-2.5">
          {AXIS_INFO.map((axis, i) => {
            const value = values[i]!;
            return (
              <div
                key={axis.name}
                className="rounded-[4px] border-l-[3px] px-3 py-2"
                style={{ borderLeftColor: "var(--app-accent)" }}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-mono text-xs font-bold leading-none text-accent"
                  >
                    p{Math.round(value)}
                  </span>
                  <span className="text-sm font-semibold leading-tight text-foreground">
                    {axis.name}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-snug text-muted">
                  {axis.description}
                </p>
              </div>
            );
          })}
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  );
}

export function RadarChart({ data }: { data: RadarData }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        className="block h-full w-full cursor-pointer"
        render={<button type="button" />}
      >
        <RadarSvg data={data} />
      </Dialog.Trigger>
      <RadarDialogPopup data={data} />
    </Dialog.Root>
  );
}
