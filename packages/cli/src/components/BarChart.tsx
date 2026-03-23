import React from 'react';
import { Box, Text } from 'ink';
import { theme } from './theme.js';

export interface BarChartProps {
  data: Array<{ date: string; cost_usd: number }>;
  weekTotal: number;
  prevWeekTotal: number;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return DAY_LABELS[d.getDay()]!;
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

export function BarChart({ data, weekTotal, prevWeekTotal }: BarChartProps) {
  const maxCost = Math.max(...data.map((d) => d.cost_usd), 0);
  const dayLabelWidth = 5; // "Mon  "
  const costLabelWidth = 9; // " $XXX.XX"
  const columns = process.stdout.columns ?? 80;
  const availableWidth = Math.max(columns - dayLabelWidth - costLabelWidth, 10);

  const weekTotalStr = `$${weekTotal.toFixed(2)} this week`;

  // Week-over-week change
  let wowText: React.ReactNode = null;
  if (prevWeekTotal > 0) {
    const pctChange = ((weekTotal - prevWeekTotal) / prevWeekTotal) * 100;
    const isPositive = pctChange >= 0;
    const arrow = isPositive ? '↑' : '↓';
    const color = isPositive ? theme.positive : theme.negative;
    const label = `${arrow} ${Math.abs(pctChange).toFixed(0)}% vs last week`;
    wowText = (
      <Box justifyContent="flex-end">
        <Text color={color}>{label}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box justifyContent="space-between">
        <Text color={theme.muted}>LAST 7 DAYS</Text>
        <Text color={theme.bright}>{weekTotalStr}</Text>
      </Box>

      {/* Bars */}
      {data.map((entry) => {
        const label = getDayLabel(entry.date);
        const cost = entry.cost_usd;
        const costStr = formatCost(cost);

        let barLen = 0;
        if (maxCost > 0 && cost > 0) {
          barLen = Math.round((cost / maxCost) * availableWidth);
          barLen = Math.max(barLen, 1); // At least 1 char for non-zero
        }
        const trackLen = availableWidth - barLen;

        const bar = '█'.repeat(barLen);
        const track = '░'.repeat(trackLen);

        return (
          <Box key={entry.date}>
            <Text color={theme.muted}>
              {label.padEnd(dayLabelWidth)}
            </Text>
            <Text color={theme.accent}>{bar}</Text>
            <Text color={theme.dim}>{track}</Text>
            <Text color={theme.text}>{costStr.padStart(costLabelWidth)}</Text>
          </Box>
        );
      })}

      {/* Week-over-week comparison */}
      {wowText}
    </Box>
  );
}
