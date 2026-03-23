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
    return (
      <Box flexDirection="column">
        <Text color={theme.muted}>{'WEEKLY LEADERBOARD'}</Text>
        <Text color={theme.muted}>{'Not ranked this week'}</Text>
      </Box>
    );
  }

  const currentUser: LeaderboardEntry = {
    username,
    cost: userCost,
    rank: leaderboard.rank,
  };

  return (
    <Box flexDirection="column">
      <Text color={theme.muted}>{'WEEKLY LEADERBOARD'}</Text>
      {leaderboard.above.map((entry) => (
        <LeaderboardRow key={entry.rank} entry={entry} isCurrent={false} />
      ))}
      <LeaderboardRow entry={currentUser} isCurrent={true} />
      {leaderboard.below.map((entry) => (
        <LeaderboardRow key={entry.rank} entry={entry} isCurrent={false} />
      ))}
    </Box>
  );
}
