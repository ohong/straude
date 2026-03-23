import React from 'react';
import { Box, Text } from 'ink';
import { theme } from './theme.js';

export interface HeatmapProps {
  data: Array<{ date: string; cost_usd: number }>;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const WEEK_LABELS = ['W1', 'W2', 'W3', 'W4'] as const;

const DAY_LABEL_WIDTH = 5; // "Mon  "
const CELL_WIDTH = 4;      // "■   "

/**
 * Returns 0=Mon, 1=Tue, ..., 6=Sun (ISO weekday).
 */
function isoWeekday(dateStr: string): number {
  const jsDay = new Date(dateStr + 'T00:00:00').getDay(); // 0=Sun
  return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * Compute quartile thresholds from non-zero cost values.
 * Returns [q25, q50, q75].
 */
function quartiles(values: number[]): [number, number, number] {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return [0, 0, 0];
  const q = (p: number) => {
    const idx = p * (n - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo]!;
    return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
  };
  return [q(0.25), q(0.5), q(0.75)];
}

function heatColor(cost: number, q25: number, q50: number, q75: number): string {
  if (cost <= 0) return theme.dim;
  if (cost <= q25) return theme.heat1;
  if (cost <= q50) return theme.heat2;
  if (cost <= q75) return theme.heat3;
  return theme.heat4;
}

function heatChar(cost: number): string {
  return cost <= 0 ? '·' : '■';
}

export function Heatmap({ data }: HeatmapProps) {
  // Build a 7×4 grid (rows=days, cols=weeks)
  // Find the most recent Monday that starts a 4-week window
  const grid: number[][] = Array.from({ length: 7 }, () => [0, 0, 0, 0]);

  if (data.length > 0) {
    // Sort data by date ascending
    const sorted = [...data].slice(-28).sort(
      (a, b) => a.date.localeCompare(b.date),
    );

    // Find the most recent date and compute the reference Monday
    const lastDate = new Date(sorted[sorted.length - 1]!.date + 'T00:00:00');
    // Walk back to the Monday of the last date's week
    const lastDayOfWeek = isoWeekday(sorted[sorted.length - 1]!.date);
    const endMonday = new Date(lastDate);
    endMonday.setDate(endMonday.getDate() - lastDayOfWeek);

    // Start Monday is 3 weeks before endMonday
    const startMonday = new Date(endMonday);
    startMonday.setDate(startMonday.getDate() - 21);

    const startMs = startMonday.getTime();

    for (const entry of sorted) {
      const entryDate = new Date(entry.date + 'T00:00:00');
      const daysSinceStart = Math.round(
        (entryDate.getTime() - startMs) / (1000 * 60 * 60 * 24),
      );
      if (daysSinceStart < 0 || daysSinceStart >= 28) continue;

      const weekIdx = Math.floor(daysSinceStart / 7);
      const dayIdx = isoWeekday(entry.date);
      grid[dayIdx]![weekIdx] = entry.cost_usd;
    }
  }

  // Compute quartiles from non-zero values
  const nonZero = grid.flatMap((row) => row.filter((v) => v > 0));
  const [q25, q50, q75] = quartiles(nonZero);

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Text color={theme.muted}>28-DAY ACTIVITY</Text>

      {/* Column headers */}
      <Box>
        <Text>{' '.repeat(DAY_LABEL_WIDTH)}</Text>
        {WEEK_LABELS.map((wl) => (
          <Text key={wl} color={theme.muted}>
            {wl.padEnd(CELL_WIDTH)}
          </Text>
        ))}
      </Box>

      {/* Grid rows */}
      {DAY_LABELS.map((dayLabel, dayIdx) => (
        <Box key={dayLabel}>
          <Text color={theme.muted}>{dayLabel.padEnd(DAY_LABEL_WIDTH)}</Text>
          {grid[dayIdx]!.map((cost, weekIdx) => (
            <Text
              key={`${dayIdx}-${weekIdx}`}
              color={heatColor(cost, q25, q50, q75)}
            >
              {heatChar(cost).padEnd(CELL_WIDTH)}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}
