"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'button, textarea, input, [href], [tabindex]:not([tabindex="-1"])';

/**
 * Trap Tab focus inside a container while `enabled` is true.
 *
 * On Tab from the last focusable element, focus wraps to the first; on
 * Shift+Tab from the first, focus wraps to the last. If the container has no
 * focusable descendants the listener is a no-op.
 *
 * Mirrors the inline implementation that previously lived in
 * `SubmitPromptWidget`, `ImageLightbox`, and `SuggestCompanyWidget`.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return;
    function onFocusTrap(e: KeyboardEvent) {
      if (e.key !== "Tab" || !containerRef.current) return;
      const focusable =
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onFocusTrap);
    return () => document.removeEventListener("keydown", onFocusTrap);
  }, [containerRef, enabled]);
}
