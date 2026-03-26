import React from 'react';
import { Box, Text } from 'ink';
import { StackedBarChart } from '@pppp606/ink-chart';
import { theme, modelColors, modelFallback } from './theme.js';

export interface ModelPaletteProps {
  breakdown: Array<{ model: string; cost_usd: number }>;
}

/**
 * Normalize raw model identifiers to display names.
 * Ported from apps/web/components/app/feed/ActivityCard.tsx:39-57
 */
function prettifyModel(model: string): string {
  const normalized = model.trim();
  if (/claude-opus-4/i.test(normalized)) return 'Claude Opus';
  if (/claude-sonnet-4/i.test(normalized)) return 'Claude Sonnet';
  if (/claude-haiku-4/i.test(normalized)) return 'Claude Haiku';
  if (/^gpt-/i.test(normalized)) {
    return normalized
      .replace(/^gpt/i, 'GPT')
      .replace(/-codex$/i, '-Codex');
  }
  if (/^o4/i.test(normalized)) return 'o4';
  if (/^o3/i.test(normalized)) return 'o3';
  // Legacy: broader Claude matching
  if (normalized.includes('opus')) return 'Claude Opus';
  if (normalized.includes('sonnet')) return 'Claude Sonnet';
  if (normalized.includes('haiku')) return 'Claude Haiku';
  return normalized;
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

  return (
    <Box flexDirection="column">
      <Text color={theme.muted}>MODELS</Text>
      <StackedBarChart
        data={segments.map((s) => ({
          label: s.name,
          value: s.pct,
          color: getModelColor(s.name),
        }))}
        width="full"
      />
    </Box>
  );
}
