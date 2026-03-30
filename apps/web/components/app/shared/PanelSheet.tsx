"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type PanelSection = {
  key: string;
  label: string;
  content: ReactNode;
};

interface PanelSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  sections: PanelSection[];
  defaultSectionKey?: string;
}

function getFocusable(container: HTMLElement | null) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("disabled") && !element.getAttribute("aria-hidden"));
}

export function PanelSheet({
  open,
  onClose,
  title,
  sections,
  defaultSectionKey,
}: PanelSheetProps) {
  const [activeSection, setActiveSection] = useState(
    () => defaultSectionKey ?? sections[0]?.key ?? "",
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const activeContent = useMemo(
    () => sections.find((section) => section.key === activeSection) ?? sections[0],
    [activeSection, sections],
  );

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTarget = window.requestAnimationFrame(() => {
      const focusable = getFocusable(panelRef.current);
      if (focusable.length > 0) {
        focusable[0].focus();
        return;
      }
      panelRef.current?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusable(panelRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (current === first || !panelRef.current?.contains(current)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (current === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusTarget);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [onClose, open]);

  if (typeof document === "undefined" || !open || sections.length === 0) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="Close panels"
        className="absolute inset-0 bg-overlay"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="safe-top safe-bottom absolute inset-y-0 right-0 flex h-[100dvh] w-full flex-col border-l border-border bg-background shadow-2xl outline-none sm:w-[420px]"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            {sections.length > 1 && (
              <p className="mt-1 text-sm text-muted">
                Switch between your profile rail and discovery rail.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-2 text-muted hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {sections.length > 1 && (
          <div className="flex gap-1 border-b border-border px-4 py-2 sm:px-5">
            {sections.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={cn(
                  "rounded-[4px] px-3 py-1.5 text-sm font-medium transition-colors",
                  activeSection === section.key
                    ? "bg-foreground text-background"
                    : "text-muted hover:bg-subtle hover:text-foreground",
                )}
              >
                {section.label}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {activeContent?.content}
        </div>
      </div>
    </div>,
    document.body,
  );
}
