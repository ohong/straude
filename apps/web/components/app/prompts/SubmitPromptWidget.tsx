"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

const SubmitPromptModal = dynamic(
  () => import("@/components/app/prompts/SubmitPromptModal").then((mod) => mod.SubmitPromptModal),
  { ssr: false },
);

interface SubmitPromptWidgetProps {
  username?: string | null;
}

export function SubmitPromptWidget({ username }: SubmitPromptWidgetProps) {
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      triggerRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 4_500);
    return () => window.clearTimeout(id);
  }, [flash]);

  return (
    <>
      {flash && (
        <div className="fixed right-3 bottom-[124px] z-40 rounded-[4px] border border-border bg-background px-3 py-2 text-xs text-foreground shadow-sm sm:right-4 sm:bottom-[72px]">
          {flash}
        </div>
      )}

      <Button
        ref={triggerRef}
        type="button"
        size="sm"
        aria-label="Submit a prompt"
        title="Submit a prompt"
        onClick={() => setOpen(true)}
        className="fixed right-3 bottom-[72px] z-40 h-11 w-11 rounded-full border border-black/10 bg-gradient-to-b from-accent to-accent/80 p-0 shadow-[0_10px_20px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.35)] transition-[transform,box-shadow,filter] duration-150 hover:-translate-y-0.5 hover:shadow-[0_14px_24px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.4)] active:translate-y-0 active:shadow-[0_6px_14px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.25)] sm:right-4 sm:bottom-4"
      >
        <Sparkles size={14} aria-hidden />
      </Button>

      {open && (
        <SubmitPromptModal
          username={username}
          onClose={() => setOpen(false)}
          onSubmitted={(message) => {
            setOpen(false);
            setFlash(message);
          }}
        />
      )}
    </>
  );
}
