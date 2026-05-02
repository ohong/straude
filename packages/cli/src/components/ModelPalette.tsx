import React from 'react';
import { Box, Text } from 'ink';
import { prettifyModel } from '@straude/shared/models';
import { theme, modelColors, modelFallback } from './theme.js';

export interface ModelPaletteProps {
  breakdown: Array<{ model: string; cost_usd: number }>;
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getModelColor(name: string): string {
  // Exact match
  if (modelColors[name]) return modelColors[name]!;
  // Claude family → orange shades
  if (/Claude/i.test(name)) return modelColors['Claude Sonnet']!;
  // OpenAI family → purple shades
  if (/GPT/i.test(name)) return modelColors['GPT-5']!;
  if (/^o[34]/i.test(name)) return modelColors['o3']!;
  // Fallback: hash into palette
  return modelFallback[hashString(name) % modelFallback.length]!;
}

interface ModelSegment {
  name: string;
  cost: number;
  pct: number;
}

function buildSegments(breakdown: Array<{ model: string; cost_usd: number }>): ModelSegment[] {
  const totalCost = breakdown.reduce((sum, e) => sum + e.cost_usd, 0);
  if (totalCost <= 0) return [];

  // Dedup by pretty name, summing costs
  const byCostMap = new Map<string, number>();
  for (const entry of breakdown) {
    const name = prettifyModel(entry.model);
    byCostMap.set(name, (byCostMap.get(name) ?? 0) + entry.cost_usd);
  }

  return [...byCostMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, cost]) => ({
      name,
      cost,
      pct: Math.round((cost / totalCost) * 100),
    }))
    .filter((s) => s.pct > 0);
}

/** Hide labels for segments under this threshold to avoid clipping */
const MIN_LABEL_PCT = 5;

export function ModelPalette({ breakdown }: ModelPaletteProps) {
  if (!breakdown || breakdown.length === 0) return null;

  const segments = buildSegments(breakdown);
  if (segments.length === 0) return null;

  // Single model: just show the name with a colored dot
  if (segments.length === 1) {
    return (
      <Box>
        <Text color={theme.muted}>{'MODELS  '}</Text>
        <Text color={getModelColor(segments[0]!.name)}>● </Text>
        <Text color={getModelColor(segments[0]!.name)}>{segments[0]!.name}</Text>
      </Box>
    );
  }

  const termWidth = process.stdout.columns ?? 80;
  const parentPadding = 2;
  const barWidth = Math.max(20, termWidth - parentPadding);

  // Allocate character widths proportionally
  const segWidths = segments.map((s) => Math.max(1, Math.round((s.pct / 100) * barWidth)));
  const totalChars = segWidths.reduce((a, b) => a + b, 0);
  if (totalChars !== barWidth && segWidths.length > 0) {
    segWidths[0]! += barWidth - totalChars;
  }

  return (
    <Box flexDirection="column">
      <Text color={theme.muted}>MODELS</Text>
      {/* Labels row — only show if segment is wide enough */}
      <Box>
        {segments.map((s, i) => (
          <Box key={s.name} width={segWidths[i]}>
            <Text color={getModelColor(s.name)}>
              {s.pct >= MIN_LABEL_PCT ? s.name : ''}
            </Text>
          </Box>
        ))}
      </Box>
      {/* Stacked bar */}
      <Box>
        {segments.map((s, i) => (
          <Text key={s.name} color={getModelColor(s.name)}>
            {'▇'.repeat(segWidths[i]!)}
          </Text>
        ))}
      </Box>
      {/* Percentages row — only show if segment is wide enough */}
      <Box>
        {segments.map((s, i) => (
          <Box key={s.name} width={segWidths[i]}>
            <Text color={theme.muted}>
              {s.pct >= MIN_LABEL_PCT ? `${s.pct}%` : ''}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
