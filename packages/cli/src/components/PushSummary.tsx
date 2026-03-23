import React from 'react';
import { Box, Text } from 'ink';
import { theme } from './theme.js';
import { BarChart } from './BarChart.js';
import { ModelPalette } from './ModelPalette.js';
import { LeaderboardSnippet } from './LeaderboardSnippet.js';

export interface DashboardData {
  username: string;
  level: number | null;
  streak: number;
  daily: Array<{ date: string; cost_usd: number }>;
  week_cost: number;
  prev_week_cost: number;
  leaderboard: {
    rank: number;
    total_users: number;
    above: Array<{ username: string; cost: number; rank: number }>;
    below: Array<{ username: string; cost: number; rank: number }>;
  } | null;
  model_breakdown?: Array<{
    model: string;
    cost_usd: number;
  }>;
  total_output_tokens?: number;
}

export interface PostResult {
  date: string;
  post_url: string;
  action: 'created' | 'updated';
}

export interface PushSummaryProps {
  dashboard: DashboardData;
  results?: PostResult[];
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function PushSummary({ dashboard, results }: PushSummaryProps) {
  // Last 7 days for bar chart
  const last7 = dashboard.daily.slice(-7);

  // Percentile from leaderboard
  const percentile = dashboard.leaderboard && dashboard.leaderboard.total_users > 0
    ? Math.max(1, Math.round((dashboard.leaderboard.rank / dashboard.leaderboard.total_users) * 100))
    : null;

  // Latest post URL for the footer link
  const latestResult = results && results.length > 0 ? results[results.length - 1] : null;

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      {/* Header: straude · @username · Lv N · 🔥 Xd · 42.3M tokens */}
      <Box>
        <Text color={theme.accent} bold>straude</Text>
        <Text color={theme.muted}> · </Text>
        <Text color={theme.bright} bold>@{dashboard.username}</Text>
        {dashboard.level != null && (
          <Text color={theme.muted}> · Lv {dashboard.level}</Text>
        )}
        {dashboard.streak > 0 && (
          <>
            <Text color={theme.muted}> · </Text>
            <Text>🔥 </Text>
            <Text color={theme.accent} bold>{dashboard.streak}d</Text>
          </>
        )}
        {dashboard.total_output_tokens != null && dashboard.total_output_tokens > 0 && (
          <>
            <Text color={theme.muted}> · </Text>
            <Text color={theme.text}>{formatTokens(dashboard.total_output_tokens)} tokens</Text>
          </>
        )}
      </Box>

      {/* Bar chart with percentile context */}
      <Box marginTop={1}>
        <BarChart
          data={last7}
          weekTotal={dashboard.week_cost}
          prevWeekTotal={dashboard.prev_week_cost}
          percentile={percentile}
        />
      </Box>

      {/* Model palette */}
      {dashboard.model_breakdown && dashboard.model_breakdown.length > 0 && (
        <Box marginTop={1}>
          <ModelPalette breakdown={dashboard.model_breakdown} />
        </Box>
      )}

      {/* Leaderboard (compact: 1 above, you, 1 below) */}
      {dashboard.leaderboard && (
        <Box marginTop={1}>
          <LeaderboardSnippet
            leaderboard={dashboard.leaderboard}
            username={dashboard.username}
            userCost={dashboard.week_cost}
          />
        </Box>
      )}

      {/* Compact footer: link to latest post */}
      {latestResult && (
        <Box marginTop={1}>
          <Text color={theme.positive}>✓ </Text>
          <Text color={theme.muted}>{latestResult.post_url}</Text>
        </Box>
      )}
    </Box>
  );
}
