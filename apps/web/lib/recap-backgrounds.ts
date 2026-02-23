export const RECAP_BACKGROUNDS = [
  { id: "01", label: "Golden Hour", src: "/recap-bg/01.jpg" },
  { id: "02", label: "Brushstroke", src: "/recap-bg/02.jpg" },
  { id: "03", label: "Coral Aurora", src: "/recap-bg/03.jpg" },
  { id: "04", label: "Sunset Wash", src: "/recap-bg/04.jpg" },
  { id: "05", label: "Gold Mist", src: "/recap-bg/05.jpg" },
  { id: "06", label: "Terracotta", src: "/recap-bg/06.jpg" },
  { id: "07", label: "Lavender", src: "/recap-bg/07.jpg" },
  { id: "08", label: "Energy", src: "/recap-bg/08.jpg" },
  { id: "09", label: "Morning Light", src: "/recap-bg/09.jpg" },
  { id: "10", label: "Geometric", src: "/recap-bg/10.jpg" },
] as const;

export type RecapBackgroundId = (typeof RECAP_BACKGROUNDS)[number]["id"];

export const DEFAULT_BACKGROUND_ID: RecapBackgroundId = "01";

export function getBackgroundById(id: string) {
  return (
    RECAP_BACKGROUNDS.find((bg) => bg.id === id) ?? RECAP_BACKGROUNDS[0]
  );
}
