import React from 'react';
import { Box, Text } from 'ink';
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

// --- Pie chart rendering ---

const PIE_W = 11; // grid width in chars
const PIE_H = 7;  // grid height in chars (aspect ratio ~2:1)
const CX = (PIE_W - 1) / 2;
const CY = (PIE_H - 1) / 2;
const RX = PIE_W / 2;
const RY = PIE_H / 2;

function isInCircle(x: number, y: number): boolean {
  const dx = (x - CX) / RX;
  const dy = (y - CY) / RY;
  return dx * dx + dy * dy <= 1;
}

/** Angle from 12 o'clock, clockwise, normalised to [0, 1). */
function getAngle(x: number, y: number): number {
  const a = Math.atan2(x - CX, -(y - CY));
  return ((a / (2 * Math.PI)) + 1) % 1;
}

interface ColoredSegment {
  name: string;
  pct: number;
  color: string;
}

function segmentColorAt(angle: number, segs: ColoredSegment[]): string | null {
  let cumulative = 0;
  for (const seg of segs) {
    cumulative += seg.pct / 100;
    if (angle < cumulative) return seg.color;
  }
  return segs.length > 0 ? segs[segs.length - 1]!.color : null;
}

/** Build a 2-D grid of colors (null = empty). */
function buildPieGrid(segs: ColoredSegment[]): (string | null)[][] {
  const grid: (string | null)[][] = [];
  for (let y = 0; y < PIE_H; y++) {
    const row: (string | null)[] = [];
    for (let x = 0; x < PIE_W; x++) {
      if (isInCircle(x, y)) {
        row.push(segmentColorAt(getAngle(x, y), segs));
      } else {
        row.push(null);
      }
    }
    grid.push(row);
  }
  return grid;
}

/** Render one row of the grid as grouped <Text> runs. */
function PieRow({ row }: { row: (string | null)[] }) {
  const spans: React.ReactNode[] = [];
  let currentColor: string | null = null;
  let buf = '';

  const flush = () => {
    if (buf.length === 0) return;
    if (currentColor) {
      spans.push(<Text key={spans.length} color={currentColor}>{buf}</Text>);
    } else {
      spans.push(<Text key={spans.length}>{buf}</Text>);
    }
    buf = '';
  };

  for (const cell of row) {
    const ch = cell ? '█' : ' ';
    if (cell !== currentColor) {
      flush();
      currentColor = cell;
    }
    buf += ch;
  }
  flush();

  return <Box>{spans}</Box>;
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

  const colored: ColoredSegment[] = segments.map((s) => ({
    name: s.name,
    pct: s.pct,
    color: getModelColor(s.name),
  }));

  const grid = buildPieGrid(colored);

  // Legend lines — one per segment, vertically centred beside the pie
  const legendLines = colored.map((s) => ({ label: `${s.name} ${s.pct}%`, color: s.color }));
  const legendStart = Math.max(0, Math.floor((PIE_H - legendLines.length) / 2));

  return (
    <Box flexDirection="column">
      <Text color={theme.muted}>MODELS</Text>
      {grid.map((row, y) => {
        const legendIdx = y - legendStart;
        const legend = legendLines[legendIdx];

        return (
          <Box key={y} gap={1}>
            <PieRow row={row} />
            {legend ? (
              <Box>
                <Text color={legend.color}>● </Text>
                <Text color={theme.muted}>{legend.label}</Text>
              </Box>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}
