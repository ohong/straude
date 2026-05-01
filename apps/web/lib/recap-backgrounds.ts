export type RecapBackground = {
  id: string;
  label: string;
  css: string;
  dark?: boolean;
};

export const RECAP_BACKGROUNDS = [
  {
    id: "01",
    label: "Golden Hour",
    css: "linear-gradient(135deg, #FDB99B 0%, #F6D365 50%, #FCE38A 100%)",
  },
  {
    id: "02",
    label: "Brushstroke",
    css: "linear-gradient(160deg, #FCCF31 0%, #F55555 50%, #F6D365 100%)",
  },
  {
    id: "03",
    label: "Coral Aurora",
    css: "linear-gradient(135deg, #F8B5B5 0%, #F5956B 50%, #FCCF6E 100%)",
  },
  {
    id: "04",
    label: "Sunset Wash",
    css: "linear-gradient(135deg, #89CFF0 0%, #FCCF6E 50%, #F4845F 100%)",
  },
  {
    id: "05",
    label: "Gold Mist",
    css: "linear-gradient(135deg, #FFFCF0 0%, #F6D365 50%, #FDB99B 100%)",
  },
  {
    id: "06",
    label: "Terracotta",
    css: "linear-gradient(135deg, #E8B68A 0%, #D4764E 50%, #F5CBA7 100%)",
  },
  {
    id: "07",
    label: "Lavender",
    css: "linear-gradient(135deg, #D6BCFA 0%, #F8B5C8 50%, #FDE68A 100%)",
  },
  {
    id: "08",
    label: "Energy",
    css: "linear-gradient(135deg, #FF8C42 0%, #FFF275 50%, #FF6B6B 100%)",
  },
  {
    id: "09",
    label: "Morning Light",
    css: "linear-gradient(135deg, #FDFCFB 0%, #E2D1C3 50%, #F6D365 100%)",
  },
  {
    id: "10",
    label: "Geometric",
    css: "linear-gradient(135deg, #F093FB 0%, #F5576C 50%, #FDB99B 100%)",
  },
  {
    id: "11",
    label: "Midnight",
    css: "linear-gradient(135deg, #0B0D12 0%, #1B1F2A 50%, #2A1A12 100%)",
    dark: true,
  },
] as const satisfies readonly RecapBackground[];

export type RecapBackgroundId = (typeof RECAP_BACKGROUNDS)[number]["id"];

export const DEFAULT_BACKGROUND_ID: RecapBackgroundId = "01";

export function getBackgroundById(id: string): RecapBackground {
  return (
    RECAP_BACKGROUNDS.find((bg) => bg.id === id) ?? RECAP_BACKGROUNDS[0]
  );
}

/** Color tokens for the recap card, swapped based on whether the background is dark. */
export type RecapPalette = {
  overlay: string;
  text: string;
  textMuted: string;
  textSubtle: string;
};

export const LIGHT_PALETTE: RecapPalette = {
  overlay: "rgba(255,255,255,0.78)",
  text: "#000",
  textMuted: "#666",
  textSubtle: "#999",
};

export const DARK_PALETTE: RecapPalette = {
  overlay: "rgba(0,0,0,0.55)",
  text: "#FFF",
  textMuted: "#CFCFCF",
  textSubtle: "#9A9A9A",
};

export function getPalette(bg: RecapBackground): RecapPalette {
  return bg.dark ? DARK_PALETTE : LIGHT_PALETTE;
}
