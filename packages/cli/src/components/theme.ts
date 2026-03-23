/**
 * Terminal-adaptive color theme.
 *
 * Uses ANSI named colors for structural elements (text, muted, dim) so
 * terminals can map them to appropriate light/dark values automatically.
 * Only brand-specific colors (accent, heatmap) use hex — these are
 * chosen to be legible on both dark and light backgrounds.
 */
export const theme = {
  accent: '#DF561F',     // Straude brand orange — bars, highlights, current user
  accentDim: '#8B3613',  // Dimmed orange — secondary elements
  muted: 'gray',         // Labels, dividers, dim text (ANSI — adapts to theme)
  dim: 'blackBright',    // Inactive/zero-data cells, bar tracks (ANSI "bright black" = dark gray)
  text: undefined,       // Primary text — undefined = terminal default foreground
  bright: 'white',       // Emphasis text (ANSI white — adapts to theme)
  positive: 'green',     // Up arrows, positive % change
  negative: 'red',       // Down arrows, negative % change

  // Heatmap intensity scale (4 tiers, warm palette)
  heat0: 'blackBright',  // No activity — adapts to terminal theme
  heat1: '#8B3613',      // Low — dark ember
  heat2: '#C4501A',      // Medium — smoldering
  heat3: '#DF561F',      // High — full flame
  heat4: '#FF8C42',      // Peak — bright fire
} as const;

export type Theme = typeof theme;
