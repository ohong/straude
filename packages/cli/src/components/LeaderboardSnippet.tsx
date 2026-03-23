import React from 'react';
import { Box, Text } from 'ink';
import { theme } from './theme.js';

interface LeaderboardEntry {
  username: string;
  cost: number;
  rank: number;
}

interface LeaderboardSnippetProps {
  leaderboard: {
    rank: number;
    above: LeaderboardEntry[];
    below: LeaderboardEntry[];
  } | null;
  username: string;
  userCost: number;
}

function formatRank(rank: number): string {
  const str = `#${rank}`;
  return str.padStart(4);
}

function formatUsername(name: string): string {
  return name.padEnd(16);
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

function LeaderboardRow({
  entry,
  isCurrent,
}: {
  entry: LeaderboardEntry;
  isCurrent: boolean;
}) {
  const prefix = isCurrent ? '▸' : ' ';
  const color = isCurrent ? theme.accent : theme.muted;
  const bold = isCurrent;

  return (
    <Text color={color} bold={bold}>
      {`${prefix}${formatRank(entry.rank)}  ${formatUsername(entry.username)}  ${formatCost(entry.cost)}`}
    </Text>
  );
}

export function LeaderboardSnippet({
  leaderboard,
  username,
  userCost,
}: LeaderboardSnippetProps) {
  if (!leaderboard) {
    return null;
  }

  const currentUser: LeaderboardEntry = {
    username,
    cost: userCost,
    rank: leaderboard.rank,
  };

  // Compact: show only 1 user above + current + 1 user below
  const above = leaderboard.above.slice(-1);
  const below = leaderboard.below.slice(0, 1);

  return (
    <Box flexDirection="column">
      {above.map((entry) => (
        <LeaderboardRow key={entry.rank} entry={entry} isCurrent={false} />
      ))}
      <LeaderboardRow entry={currentUser} isCurrent={true} />
      {below.map((entry) => (
        <LeaderboardRow key={entry.rank} entry={entry} isCurrent={false} />
      ))}
    </Box>
  );
}
