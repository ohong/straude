"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils/cn";
import type { ContributionDay } from "@/types";

const CELL_SIZE = 12;
const GAP = 3;
const STEP = CELL_SIZE + GAP;
const WEEKS = 52;
const DAYS = 7;
const MONTH_LABEL_HEIGHT = 16;

function getCellColor(cost: number): string {
  if (cost <= 0) return "#E5E5E5";
  if (cost <= 10) return "#FDD0B1";
  if (cost <= 50) return "#F4945E";
  if (cost <= 100) return "#DF561F";
  return "#B8441A";
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface ContributionGraphProps {
  data: ContributionDay[];
  onCellClick?: (date: string) => void;
  className?: string;
}

export function ContributionGraph({ data, onCellClick, className }: ContributionGraphProps) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    date: string;
    cost: number;
  } | null>(null);

  // Build lookup map from array
  const lookup = new Map<string, ContributionDay>();
  for (const entry of data) {
    lookup.set(entry.date, entry);
  }

  // Build grid: 52 weeks x 7 days, most recent week on right, Sunday at top (day 0)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start from Sunday, 51 weeks ago
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - today.getDay() - 51 * 7);

  type CellData = { date: Date; key: string; weekIndex: number; dayIndex: number };
  const cells: CellData[] = [];
  const monthLabels: { label: string; x: number }[] = [];
  let lastMonth = -1;

  const cursor = new Date(startDate);
  while (cursor <= today) {
    const weekIndex = Math.floor(
      (cursor.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
    const dayIndex = cursor.getDay(); // 0=Sunday

    cells.push({
      date: new Date(cursor),
      key: formatDateKey(cursor),
      weekIndex,
      dayIndex,
    });

    // Track month labels (first occurrence of a new month)
    const month = cursor.getMonth();
    if (month !== lastMonth) {
      monthLabels.push({
        label: SHORT_MONTHS[month]!,
        x: weekIndex * STEP,
      });
      lastMonth = month;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  const svgWidth = (WEEKS + 1) * STEP;
  const svgHeight = DAYS * STEP + MONTH_LABEL_HEIGHT;

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<SVGRectElement>, dateLabel: string, cost: number) => {
      const rect = (e.target as SVGRectElement).getBoundingClientRect();
      setTooltip({
        x: rect.left + rect.width / 2,
        y: rect.top,
        date: dateLabel,
        cost,
      });
    },
    [],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  return (
    <div className={cn("relative overflow-x-auto", className)} style={{ scrollbarWidth: "none" }}>
      <svg width={svgWidth} height={svgHeight} className="block">
        {/* Month labels */}
        {monthLabels.map((m, i) => (
          <text
            key={`${m.label}-${i}`}
            x={m.x}
            y={11}
            className="fill-muted text-[10px]"
          >
            {m.label}
          </text>
        ))}

        {/* Cells */}
        {cells.map((cell) => {
          const entry = lookup.get(cell.key);
          const cost = entry?.cost_usd ?? 0;
          const hasPost = entry?.has_post ?? false;

          return (
            <rect
              key={cell.key}
              x={cell.weekIndex * STEP}
              y={cell.dayIndex * STEP + MONTH_LABEL_HEIGHT}
              width={CELL_SIZE}
              height={CELL_SIZE}
              rx={2}
              fill={getCellColor(cost)}
              stroke={hasPost ? "#999" : "none"}
              strokeWidth={hasPost ? 1 : 0}
              className={cn(onCellClick && hasPost && "cursor-pointer")}
              onMouseEnter={(e) => handleMouseEnter(e, formatDateLabel(cell.date), cost)}
              onMouseLeave={handleMouseLeave}
              onClick={() => {
                if (onCellClick && hasPost) onCellClick(cell.key);
              }}
            />
          );
        })}
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-[4px] px-3 py-2 text-sm text-white shadow-lg"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
            background: "#000",
          }}
        >
          <p className="font-normal leading-snug">{tooltip.date}</p>
          <p className="font-mono tabular-nums">
            ${tooltip.cost.toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
}
