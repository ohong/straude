export interface HeatmapContributionDay {
  date: string;
  cost_usd: number;
}

export interface HeatmapCell extends HeatmapContributionDay {
  weekIndex: number;
  dayIndex: number;
  inRange: boolean;
}

export interface HeatmapMonthLabel {
  label: string;
  weekIndex: number;
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getHeatmapCellColor(cost: number): string {
  if (cost <= 0) return "#EAE2D7";
  if (cost <= 10) return "#F6CEAF";
  if (cost <= 50) return "#F1A46C";
  if (cost <= 100) return "#DF561F";
  return "#A53E1A";
}

export function getHeatmapLegend() {
  return [
    { label: "Rest", color: getHeatmapCellColor(0) },
    { label: "Warmup", color: getHeatmapCellColor(1) },
    { label: "Session", color: getHeatmapCellColor(20) },
    { label: "Push", color: getHeatmapCellColor(75) },
    { label: "Peak", color: getHeatmapCellColor(150) },
  ] as const;
}

export function buildHeatmapGrid(
  days: HeatmapContributionDay[],
  opts?: {
    endDate?: Date;
    rangeDays?: number;
  }
): {
  cells: HeatmapCell[];
  monthLabels: HeatmapMonthLabel[];
  weekCount: number;
} {
  const rangeDays = opts?.rangeDays ?? 365;
  const endDate = opts?.endDate ? new Date(opts.endDate) : new Date();
  endDate.setHours(0, 0, 0, 0);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (rangeDays - 1));
  startDate.setHours(0, 0, 0, 0);

  const gridStart = new Date(startDate);
  gridStart.setDate(startDate.getDate() - startDate.getDay());
  gridStart.setHours(0, 0, 0, 0);

  const lookup = new Map(days.map((day) => [day.date, day.cost_usd]));
  const cells: HeatmapCell[] = [];
  const monthLabels: HeatmapMonthLabel[] = [];
  let lastMonth = -1;

  const cursor = new Date(gridStart);
  while (cursor <= endDate) {
    const diffDays = Math.floor(
      (cursor.getTime() - gridStart.getTime()) / 86_400_000
    );
    const weekIndex = Math.floor(diffDays / 7);
    const dayIndex = cursor.getDay();
    const key = formatDateKey(cursor);
    const inRange = cursor >= startDate && cursor <= endDate;

    if (inRange) {
      const month = cursor.getMonth();
      if (month !== lastMonth) {
        monthLabels.push({
          label: SHORT_MONTHS[month]!,
          weekIndex,
        });
        lastMonth = month;
      }
    }

    cells.push({
      date: key,
      cost_usd: lookup.get(key) ?? 0,
      weekIndex,
      dayIndex,
      inRange,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  const weekCount = Math.max(...cells.map((cell) => cell.weekIndex), 0) + 1;

  return {
    cells,
    monthLabels,
    weekCount,
  };
}
