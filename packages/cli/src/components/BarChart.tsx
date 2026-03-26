import React from 'react';
import { Box, Text } from 'ink';
import { BarChart as InkBarChart } from '@pppp606/ink-chart';
import { theme } from './theme.js';

export interface BarChartProps {
  data: Array<{ date: string; cost_usd: number }>;
  weekTotal: number;
  prevWeekTotal: number;
  percentile?: number | null;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return DAY_LABELS[d.getDay()]!;
}

export function BarChart({ data, weekTotal, prevWeekTotal, percentile }: BarChartProps) {
  const weekTotalStr = `$${weekTotal.toFixed(2)} this week`;

  // Context line: percentile + week-over-week change
  const contextParts: React.ReactNode[] = [];

  if (percentile != null && percentile > 0) {
    const pctColor = percentile <= 10 ? theme.accent : percentile <= 25 ? theme.positive : theme.text;
    contextParts.push(
      <Text key="pct" color={pctColor} bold={percentile <= 10}>
        {`Top ${percentile}% this week`}
      </Text>,
    );
  }

  if (prevWeekTotal > 0) {
    const pctChange = ((weekTotal - prevWeekTotal) / prevWeekTotal) * 100;
    const isPositive = pctChange >= 0;
    const arrow = isPositive ? '↑' : '↓';
    const color = isPositive ? theme.positive : theme.negative;
    contextParts.push(
      <Text key="wow" color={color}>
        {`${arrow} ${Math.abs(pctChange).toFixed(0)}% vs last week`}
      </Text>,
    );
  }

  const contextLine = contextParts.length > 0 ? (
    <Box justifyContent="flex-end">
      {contextParts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Text color={theme.muted}>{' · '}</Text>}
          {part}
        </React.Fragment>
      ))}
    </Box>
  ) : null;

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box justifyContent="space-between">
        <Text color={theme.muted}>LAST 7 DAYS</Text>
        <Text color={theme.bright}>{weekTotalStr}</Text>
      </Box>

      {/* Bars */}
      <InkBarChart
        data={data.map((entry) => ({
          label: getDayLabel(entry.date),
          value: entry.cost_usd,
          color: theme.accent,
        }))}
        width="full"
        showValue="right"
        format={(v) => `$${v.toFixed(2)}`}
        barChar="█"
      />

      {/* Context: percentile + week-over-week */}
      {contextLine}
    </Box>
  );
}
