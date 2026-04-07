"use client";

import dynamic from "next/dynamic";

const HalftoneCanvas = dynamic(
  () =>
    import("@/components/landing/HalftoneCanvas").then((m) => ({
      default: m.HalftoneCanvas,
    })),
  { ssr: false }
);

export function LazyHalftoneCanvas() {
  return <HalftoneCanvas />;
}
