"use client";

import { useEffect, useState } from "react";

export type ResponsiveShellMode = "full" | "compact" | "focus" | "phone";

export const SHELL_BREAKPOINTS = {
  phoneMax: 879,
  focusMin: 880,
  compactMin: 1180,
  fullMin: 1440,
} as const;

export function getResponsiveShellMode(width: number): ResponsiveShellMode {
  if (width >= SHELL_BREAKPOINTS.fullMin) return "full";
  if (width >= SHELL_BREAKPOINTS.compactMin) return "compact";
  if (width >= SHELL_BREAKPOINTS.focusMin) return "focus";
  return "phone";
}

export function useResponsiveShell() {
  const [mode, setMode] = useState<ResponsiveShellMode>(() => {
    if (typeof window === "undefined") return "full";
    return getResponsiveShellMode(window.innerWidth);
  });

  useEffect(() => {
    function updateMode() {
      setMode(getResponsiveShellMode(window.innerWidth));
    }

    updateMode();
    window.addEventListener("resize", updateMode);
    return () => window.removeEventListener("resize", updateMode);
  }, []);

  return mode;
}
