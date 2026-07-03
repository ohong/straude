"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const HalftoneCanvas = dynamic(
  () =>
    import("@/components/landing/HalftoneCanvas").then((m) => ({
      default: m.HalftoneCanvas,
    })),
  { ssr: false }
);

export function LazyHalftoneCanvas() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const saveData =
      "connection" in navigator &&
      Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

    if (prefersReducedMotion || saveData) return;

    const start = () => setEnabled(true);
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(start, { timeout: 1800 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(start, 1200);
    return () => globalThis.clearTimeout(timeoutId);
  }, []);

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-35"
        aria-hidden="true"
      >
        <div className="h-full w-full bg-[radial-gradient(circle_at_18px_18px,rgba(223,86,31,0.32)_0,rgba(223,86,31,0.32)_2px,transparent_2.5px)] [background-size:42px_42px]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,0)_0%,rgba(5,5,5,0.62)_72%,rgba(5,5,5,0.95)_100%)]" />
      </div>
      {enabled ? <HalftoneCanvas /> : null}
    </>
  );
}
