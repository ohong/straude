"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, type ReactNode } from "react";

const CommandPaletteInner = dynamic(
  () => import("@/components/app/shared/CommandPaletteInner").then((mod) => mod.CommandPaletteInner),
  { ssr: false },
);

interface CommandPaletteProps {
  username?: string | null;
  children: ReactNode;
}

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function isCommandPaletteShortcut(event: KeyboardEvent) {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
}

export function CommandPalette({ username, children }: CommandPaletteProps) {
  const [phase, setPhase] = useState<"deferred" | "loading" | "ready">("deferred");
  const [openOnLoad, setOpenOnLoad] = useState(false);

  useEffect(() => {
    if (phase === "ready") return;

    function handleKeyDown(event: KeyboardEvent) {
      if (!isCommandPaletteShortcut(event)) return;

      event.preventDefault();
      setOpenOnLoad(true);
      setPhase("loading");
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase]);

  useEffect(() => {
    if (phase !== "deferred") return;

    const idleWindow = window as WindowWithIdleCallback;
    if (idleWindow.requestIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(
        () => setPhase("loading"),
        { timeout: 4_000 },
      );
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(() => setPhase("loading"), 2_500);
    return () => window.clearTimeout(timeoutId);
  }, [phase]);

  const handleReady = useCallback(() => {
    setPhase("ready");
  }, []);

  const handleOpenOnLoadConsumed = useCallback(() => {
    setOpenOnLoad(false);
  }, []);

  return (
    <>
      {children}
      {phase !== "deferred" && (
        <CommandPaletteInner
          username={username}
          openOnLoad={openOnLoad}
          onOpenOnLoadConsumed={handleOpenOnLoadConsumed}
          onReady={handleReady}
        />
      )}
    </>
  );
}
