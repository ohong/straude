import React from 'react';
import { Box, Text } from 'ink';
import { theme } from './theme.js';

interface StreakFlameProps {
  streak: number;
}

export function StreakFlame({ streak }: StreakFlameProps) {
  const barLength = Math.min(streak, 20);

  const getCharColor = (index: number): string => {
    const third = barLength / 3;
    if (index < third) return theme.heat2;
    if (index < third * 2) return theme.heat3;
    return theme.heat4;
  };

  return (
    <Box flexDirection="column">
      <Text color={theme.muted}>{'🔥 STREAK'}</Text>
      {streak === 0 ? (
        <Text color={theme.muted}>{'—'}</Text>
      ) : (
        <>
          <Text>
            <Text color={theme.accent} bold>{streak}</Text>
            <Text color={theme.muted}> days</Text>
          </Text>
          <Text>
            {Array.from({ length: barLength }, (_, i) => (
              <Text key={i} color={getCharColor(i)}>{'█'}</Text>
            ))}
          </Text>
        </>
      )}
    </Box>
  );
}
