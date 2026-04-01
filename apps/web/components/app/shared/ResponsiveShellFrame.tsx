"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MobileNav } from "@/components/app/shared/MobileNav";
import { PanelSheet } from "@/components/app/shared/PanelSheet";
import { SubmitPromptWidget } from "@/components/app/prompts/SubmitPromptWidget";
import { TopHeader } from "@/components/app/shared/TopHeader";
import { useResponsiveShell, type ResponsiveShellMode } from "@/components/app/shared/useResponsiveShell";

interface ResponsiveShellFrameProps {
  username: string | null;
  avatarUrl: string | null;
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  children: ReactNode;
}

export function ResponsiveShellFrame({
  username,
  avatarUrl,
  leftPanel,
  rightPanel,
  children,
}: ResponsiveShellFrameProps) {
  const mode = useResponsiveShell();
  const [panelOpenMode, setPanelOpenMode] = useState<ResponsiveShellMode | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const showLeftRail = mode === "full" || mode === "compact";
  const showRightRail = mode === "full";

  const panelSections = useMemo(() => {
    if (mode === "full") return [];
    if (mode === "compact") {
      return [
        { key: "discover", label: "Discover", content: rightPanel },
      ];
    }
    return [
      { key: "you", label: "You", content: leftPanel },
      { key: "discover", label: "Discover", content: rightPanel },
    ];
  }, [leftPanel, mode, rightPanel]);

  const panelTriggerLabel =
    mode === "compact" ? "Discover" : mode === "full" ? null : "Panels";
  const panelsOpen = panelOpenMode === mode && mode !== "full";

  return (
    <>
      <TopHeader
        username={username}
        avatarUrl={avatarUrl}
        panelTriggerLabel={panelTriggerLabel}
        onOpenPanels={
          panelSections.length > 0 ? () => setPanelOpenMode(mode) : undefined
        }
      />

      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 border-x border-border">
        {showLeftRail && (
          <div className="relative shrink-0">
            <aside
              className="h-full overflow-y-auto overscroll-contain border-r border-border transition-[width] duration-200"
              style={{ width: leftCollapsed ? 0 : "var(--app-left-panel-width)" }}
            >
              <div style={{ width: "var(--app-left-panel-width)" }}>
                {leftPanel}
              </div>
            </aside>
            <button
              type="button"
              onClick={() => setLeftCollapsed((v) => !v)}
              aria-label={leftCollapsed ? "Expand left panel" : "Collapse left panel"}
              className={cn(
                "absolute top-1/2 right-0 z-20 flex -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-border shadow-sm transition-all duration-200 hover:text-foreground",
                leftCollapsed
                  ? "h-8 w-8 bg-subtle text-foreground shadow-md"
                  : "h-6 w-6 bg-background text-muted"
              )}
            >
              {leftCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={12} />}
            </button>
          </div>
        )}

        <main
          id="main-content"
          className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden"
          style={{ scrollbarWidth: "none", overscrollBehavior: "contain" }}
        >
          <div className="flex h-full flex-col pb-[var(--app-main-bottom-offset)]">
            {children}
          </div>
        </main>

        {showRightRail && (
          <div className="relative shrink-0">
            <aside
              className="h-full overflow-y-auto overscroll-contain border-l border-border transition-[width] duration-200"
              style={{ width: rightCollapsed ? 0 : "var(--app-right-panel-width)" }}
            >
              <div style={{ width: "var(--app-right-panel-width)" }}>
                {rightPanel}
              </div>
            </aside>
            <button
              type="button"
              onClick={() => setRightCollapsed((v) => !v)}
              aria-label={rightCollapsed ? "Expand right panel" : "Collapse right panel"}
              className={cn(
                "absolute top-1/2 left-0 z-20 flex -translate-y-1/2 -translate-x-1/2 items-center justify-center rounded-full border border-border shadow-sm transition-all duration-200 hover:text-foreground",
                rightCollapsed
                  ? "h-8 w-8 bg-subtle text-foreground shadow-md"
                  : "h-6 w-6 bg-background text-muted"
              )}
            >
              {rightCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={12} />}
            </button>
          </div>
        )}
      </div>

      <MobileNav username={username} />
      <SubmitPromptWidget username={username} />

      <PanelSheet
        key={`${mode}-${panelTriggerLabel ?? "none"}`}
        open={panelsOpen}
        onClose={() => setPanelOpenMode(null)}
        title={panelTriggerLabel ?? "Panels"}
        sections={panelSections}
        defaultSectionKey={mode === "compact" ? "discover" : "you"}
      />
    </>
  );
}
