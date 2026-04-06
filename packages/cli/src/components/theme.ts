/**
 * Terminal-adaptive color theme.
 *
 * Uses ANSI named colors for structural elements (text, muted, dim) so
 * terminals can map them to appropriate light/dark values automatically.
 * Only brand-specific colors (accent) use hex — these are
 * chosen to be legible on both dark and light backgrounds.
 */
export const theme = {
  accent: '#DF561F',     // Straude brand orange — bars, highlights, current user
  muted: 'gray',         // Labels, dividers, dim text (ANSI — adapts to theme)
  dim: 'blackBright',    // Inactive/zero-data cells, bar tracks (ANSI "bright black" = dark gray)
  text: undefined,       // Primary text — undefined = terminal default foreground
  bright: 'white',       // Emphasis text (ANSI white — adapts to theme)
  positive: 'green',     // Up arrows, positive % change
  negative: 'red',       // Down arrows, negative % change
} as const;

export type Theme = typeof theme;

// Model color map — Claude = orange, OpenAI = purple, Gemini = Google brand colors
export const modelColors: Record<string, string> = {
  'Claude Opus':   '#DF561F',  // brand orange
  'Claude Sonnet': '#F08A5D',  // lighter orange
  'Claude Haiku':  '#F7B267',  // amber
  'GPT-5':         '#8B5CF6',  // purple
  'GPT-4o':        '#A78BFA',  // lighter purple
  'o3':            '#7C3AED',  // deeper purple
  'o4':            '#6D28D9',  // deep purple
  'Gemini 3.1 Pro':        '#4285F4',  // Google blue
  'Gemini 3.1 Flash Lite': '#00ACC1',  // cyan
  'Gemini 3 Flash':        '#009688',  // teal
  'Gemini 2.5 Pro':        '#3F51B5',  // indigo
  'Gemini 2.5 Flash':      '#34A853',  // Google green
  'Gemini 2.5 Flash Lite': '#8BC34A',  // light green
  'Gemini 2.0 Flash':      '#FBBC05',  // Google yellow
  'Gemini 2.0 Flash Lite': '#FF8F00',  // amber
};

// Fallback palette for unknown models (hash-indexed)
export const modelFallback = ['#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#8B5CF6', '#EC4899'];
