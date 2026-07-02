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
  const [shouldLoad, setShouldLoad] = useState(false);
  const [openOnLoad, setOpenOnLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (!isCommandPaletteShortcut(event)) return;

      event.preventDefault();
      setOpenOnLoad(true);
      setShouldLoad(true);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shouldLoad]);

  useEffect(() => {
    if (shouldLoad) return;

    const idleWindow = window as WindowWithIdleCallback;
    if (idleWindow.requestIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(
        () => setShouldLoad(true),
        { timeout: 4_000 },
      );
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(() => setShouldLoad(true), 2_500);
    return () => window.clearTimeout(timeoutId);
  }, [shouldLoad]);

  const handleOpenOnLoadConsumed = useCallback(() => {
    setOpenOnLoad(false);
  }, []);

  if (!shouldLoad) {
    return <>{children}</>;
  }

  return (
    <CommandPaletteInner
      username={username}
      openOnLoad={openOnLoad}
      onOpenOnLoadConsumed={handleOpenOnLoadConsumed}
    >
      {children}
    </CommandPaletteInner>
  );
}
