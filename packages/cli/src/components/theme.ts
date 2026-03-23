export const theme = {
  accent: '#DF561F',     // Straude brand orange — bars, highlights, current user
  accentDim: '#8B3613',  // Dimmed orange — secondary elements
  muted: '#666666',      // Labels, dividers, dim text
  dim: '#444444',        // Inactive/zero-data cells
  text: '#CCCCCC',       // Primary text
  bright: '#FFFFFF',     // Emphasis text (totals, rank)
  positive: '#22C55E',   // Up arrows, positive % change
  negative: '#EF4444',   // Down arrows, negative % change

  // Heatmap intensity scale (4 tiers, warm palette)
  heat0: '#2A2A2A',      // No activity — near-black
  heat1: '#8B3613',      // Low — dark ember
  heat2: '#C4501A',      // Medium — smoldering
  heat3: '#DF561F',      // High — full flame
  heat4: '#FF8C42',      // Peak — bright fire
} as const;

export type Theme = typeof theme;
