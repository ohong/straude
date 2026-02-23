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
] as const;

export type RecapBackgroundId = (typeof RECAP_BACKGROUNDS)[number]["id"];

export const DEFAULT_BACKGROUND_ID: RecapBackgroundId = "01";

export function getBackgroundById(id: string) {
  return (
    RECAP_BACKGROUNDS.find((bg) => bg.id === id) ?? RECAP_BACKGROUNDS[0]
  );
}
