"use client";

import { Dialog } from "@base-ui-components/react/dialog";
import { Badge } from "@/components/ui/Badge";
import { X } from "lucide-react";

const LEVELS = [
  {
    level: 8,
    name: "Build your own orchestrator",
    description:
      "You write the coordination layer yourself, spawning, routing, and managing agents programmatically.",
    era: "ORCHESTRATION",
  },
  {
    level: 7,
    name: "10+ agents, managed by hand",
    description:
      '"Oh gosh, I\'ve made a mess." Wrong context sent to the wrong agent. You start asking: "What if Claude Code could run Claude Code?"',
    era: "ORCHESTRATION",
  },
  {
    level: 6,
    name: "Agent multiplexing",
    description:
      "Bored waiting? Fire up another agent. Then another. You're bouncing between streams and you can't stop.",
    era: "AGENT-FIRST",
  },
  {
    level: 5,
    name: "Agent-first, IDE later",
    description:
      "You work in the agent conversation, the IDE is just where you look at the code afterward.",
    era: "AGENT-FIRST",
  },
  {
    level: 4,
    name: "Diffs fade, conversation leads",
    description:
      "You stop reviewing every diff, you watch what the agent is doing and focus on guiding it.",
    era: "IDE ERA",
  },
  {
    level: 3,
    name: "YOLO mode",
    description: "Agent runs freely in IDE, trust is rising.",
    era: "IDE ERA",
  },
  {
    level: 2,
    name: "Agent in IDE, permissions on",
    description: "You approve every file change, full manual control.",
    era: "IDE ERA",
  },
  {
    level: 1,
    name: "No AI",
    description: "Traditional dev workflow, no AI tooling.",
    era: "IDE ERA",
  },
] as const;

const LEVEL_COLORS: Record<number, string> = {
  1: "#6b7280",
  2: "#6366f1",
  3: "#3b82f6",
  4: "#06b6d4",
  5: "#10b981",
  6: "#eab308",
  7: "#f97316",
  8: "#ef4444",
};

const ERA_FIRST_LEVEL: Record<string, number> = {
  ORCHESTRATION: 8,
  "AGENT-FIRST": 6,
  "IDE ERA": 4,
};

function LevelDialogPopup({ level }: { level: number }) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
      <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(94vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <Dialog.Title className="text-sm font-semibold">
            What level of AI adoption are you?
          </Dialog.Title>
          <Dialog.Close className="rounded-sm p-1 text-muted hover:text-foreground">
            <X size={16} aria-label="Close" />
          </Dialog.Close>
        </div>
        <div className="flex flex-col gap-1 px-3 py-2.5">
          {LEVELS.map((entry) => {
            const isActive = entry.level === level;
            const showEra = ERA_FIRST_LEVEL[entry.era] === entry.level;

            return (
              <div key={entry.level}>
                {showEra && (
                  <p className="mb-0.5 mt-2 text-[0.6rem] uppercase tracking-[0.15em] text-muted first:mt-0">
                    {entry.era}
                  </p>
                )}
                <div
                  className={
                    "rounded-[4px] border-l-[3px] px-3 py-2" +
                    (isActive ? " border-l-[4px] bg-highlight-row" : "")
                  }
                  style={{
                    borderLeftColor: LEVEL_COLORS[entry.level],
                    opacity: isActive ? 1 : 0.45,
                  }}
                  aria-current={isActive ? "true" : undefined}
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      className="font-mono text-xs font-bold leading-none"
                      style={{ color: LEVEL_COLORS[entry.level] }}
                    >
                      L{entry.level}
                    </span>
                    <span className="text-sm font-semibold leading-tight text-foreground">
                      {entry.name}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-snug text-muted">
                    {entry.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  );
}

interface LevelBadgeProps {
  level: number;
  className?: string;
}

export function LevelBadge({ level, className }: LevelBadgeProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        className={className}
        render={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
            }}
          />
        }
      >
        <Badge
          variant="default"
          className="cursor-pointer font-mono tabular-nums text-accent hover:bg-subtle"
        >
          L{level}
        </Badge>
      </Dialog.Trigger>
      <LevelDialogPopup level={level} />
    </Dialog.Root>
  );
}

interface LevelDialogTriggerProps {
  level: number;
  children: React.ReactNode;
  className?: string;
}

export function LevelDialogTrigger({ level, children, className }: LevelDialogTriggerProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        className={className}
        render={<button type="button" />}
      >
        {children}
      </Dialog.Trigger>
      <LevelDialogPopup level={level} />
    </Dialog.Root>
  );
}
