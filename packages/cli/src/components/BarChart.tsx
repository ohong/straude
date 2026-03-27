import React from 'react';
import { Box, Text } from 'ink';
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

function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const LABEL_W = 4;
const VALUE_W = 9;
const GAP = 1;

export function BarChart({ data, weekTotal, prevWeekTotal, percentile }: BarChartProps) {
  const termWidth = process.stdout.columns ?? 80;
  const parentPadding = 2; // paddingX={1} on PushSummary parent
  const barArea = Math.max(10, termWidth - parentPadding - LABEL_W - VALUE_W - GAP);
  const maxValue = Math.max(...data.map((d) => d.cost_usd), 0.01);
  const todayStr = getTodayStr();

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

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box justifyContent="space-between">
        <Text color={theme.muted}>LAST 7 DAYS</Text>
        <Text color={theme.bright} bold>{`$${weekTotal.toFixed(2)} this week`}</Text>
      </Box>

      {/* Bars — ▇ (lower seven-eighths block) leaves a natural 1px gap between rows */}
      {data.map((entry) => {
        const label = getDayLabel(entry.date);
        const isToday = entry.date === todayStr;
        const filled = maxValue > 0
          ? Math.max(entry.cost_usd > 0 ? 1 : 0, Math.round((entry.cost_usd / maxValue) * barArea))
          : 0;
        const bar = '▇'.repeat(filled);
        const pad = ' '.repeat(Math.max(0, barArea - filled) + GAP);
        const formatted = `$${entry.cost_usd.toFixed(2)}`.padStart(VALUE_W);

        return (
          <Box key={entry.date}>
            <Text color={isToday ? theme.bright : theme.muted} bold={isToday}>
              {label.padEnd(LABEL_W)}
            </Text>
            <Text color={theme.accent}>{bar}</Text>
            <Text>{pad}</Text>
            <Text color={isToday ? theme.bright : theme.muted} bold={isToday}>
              {formatted}
            </Text>
          </Box>
        );
      })}

      {/* Context: percentile + week-over-week */}
      {contextParts.length > 0 && (
        <Box justifyContent="flex-end">
          {contextParts.map((part, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Text color={theme.muted}>{' · '}</Text>}
              {part}
            </React.Fragment>
          ))}
        </Box>
      )}
    </Box>
  );
}
