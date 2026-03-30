"use client";

import { useMemo, useState, type ReactNode } from "react";
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
          <aside
            className="shrink-0 overflow-y-auto overscroll-contain border-r border-border"
            style={{ width: "var(--app-left-panel-width)" }}
          >
            {leftPanel}
          </aside>
        )}

        <main
          id="main-content"
          className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden"
          style={{ scrollbarWidth: "none", overscrollBehavior: "contain" }}
        >
          <div className="flex min-h-full flex-col pb-[var(--app-main-bottom-offset)]">
            {children}
          </div>
        </main>

        {showRightRail && (
          <aside
            className="shrink-0 overflow-y-auto overscroll-contain border-l border-border"
            style={{ width: "var(--app-right-panel-width)" }}
          >
            {rightPanel}
          </aside>
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
