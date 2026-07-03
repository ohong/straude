"use client";

import { Check, Copy } from "lucide-react";
import { useClipboardFeedback } from "@/lib/utils/useClipboardFeedback";

export function CopyCommand({ command }: { command: string }) {
  const { copied, copyText } = useClipboardFeedback();

  return (
    <button
      type="button"
      onClick={() => void copyText(command)}
      className="group/copy inline-flex items-center gap-2 rounded border border-border bg-subtle px-4 py-2 font-[family-name:var(--font-mono)] text-sm transition-[border-color,background-color] duration-150 hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span>{command}</span>
      {copied ? (
        <Check size={16} className="text-accent" aria-hidden="true" />
      ) : (
        <Copy
          size={16}
          className="opacity-50 transition-opacity group-hover/copy:opacity-100"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
