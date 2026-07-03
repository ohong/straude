"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useClipboardFeedback(resetAfterMs = 2000) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyText = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        setCopied(true);
        resetTimerRef.current = setTimeout(() => {
          setCopied(false);
          resetTimerRef.current = null;
        }, resetAfterMs);
        return true;
      } catch {
        return false;
      }
    },
    [resetAfterMs],
  );

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  return { copied, copyText };
}
