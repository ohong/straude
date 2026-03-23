import React from 'react';
import { Box, Text } from 'ink';
import { theme } from './theme.js';
import { BarChart } from './BarChart.js';
import { Heatmap } from './Heatmap.js';
import { StreakFlame } from './StreakFlame.js';
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
    above: Array<{ username: string; cost: number; rank: number }>;
    below: Array<{ username: string; cost: number; rank: number }>;
  } | null;
}

export interface PostResult {
  date: string;
  post_url: string;
  action: 'created' | 'updated';
}

export interface PushSummaryProps {
  dashboard: DashboardData;
  results?: PostResult[];
  shareUrl?: string;
}

export function PushSummary({ dashboard, results, shareUrl }: PushSummaryProps) {
  // Last 7 days for bar chart
  const last7 = dashboard.daily.slice(-7);

  // Level display
  const levelStr = dashboard.level != null ? ` · Lv ${dashboard.level}` : '';

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      {/* Header */}
      <Box>
        <Text color={theme.accent} bold>straude</Text>
        <Text color={theme.muted}> · </Text>
        <Text color={theme.bright} bold>@{dashboard.username}</Text>
        <Text color={theme.muted}>{levelStr}</Text>
      </Box>

      {/* Bar chart */}
      <Box marginTop={1}>
        <BarChart
          data={last7}
          weekTotal={dashboard.week_cost}
          prevWeekTotal={dashboard.prev_week_cost}
        />
      </Box>

      {/* Heatmap + Streak side by side */}
      <Box marginTop={1} flexDirection="row">
        <Box flexDirection="column">
          <Heatmap data={dashboard.daily} />
        </Box>
        <Box flexDirection="column" marginLeft={4}>
          <StreakFlame streak={dashboard.streak} />
        </Box>
      </Box>

      {/* Leaderboard */}
      <Box marginTop={1}>
        <LeaderboardSnippet
          leaderboard={dashboard.leaderboard}
          username={dashboard.username}
          userCost={dashboard.week_cost}
        />
      </Box>

      {/* Posted URLs */}
      {results && results.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          {results.map((r) => {
            const verb = r.action === 'updated' ? 'Updated' : 'Posted';
            return (
              <Text key={r.date} color={theme.positive}>
                {'✓ '}{verb} {r.date}
              </Text>
            );
          })}
          {shareUrl && (
            <Text color={theme.muted}>→ {shareUrl}</Text>
          )}
        </Box>
      )}
    </Box>
  );
}
