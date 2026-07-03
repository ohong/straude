"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { useFocusTrap } from "@/components/app/shared/useFocusTrap";
import { timeAgo } from "@/lib/utils/format";

const MAX_PROMPT_LENGTH = 2_000;
type ModalView = "submit" | "community";

interface CommunityPromptRow {
  id: string;
  prompt: string;
  is_anonymous: boolean;
  created_at: string;
  user?: { username?: string | null } | null;
}

interface SubmitPromptModalProps {
  username?: string | null;
  onClose: () => void;
  onSubmitted: (message: string) => void;
}

export function SubmitPromptModal({
  username,
  onClose,
  onSubmitted,
}: SubmitPromptModalProps) {
  const [view, setView] = useState<ModalView>("submit");
  const [prompt, setPrompt] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [communityPrompts, setCommunityPrompts] = useState<CommunityPromptRow[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  useEffect(() => {
    if (view !== "submit") return;
    const id = window.setTimeout(() => textareaRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [view]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useFocusTrap(dialogRef, true);

  async function loadCommunityPrompts() {
    if (communityLoading) return;
    setCommunityLoading(true);
    setCommunityError(null);
    try {
      const res = await fetch("/api/prompts?limit=20&offset=0");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCommunityError(body.error ?? "Failed to load community prompts");
        return;
      }
      setCommunityPrompts(Array.isArray(body.prompts) ? body.prompts : []);
    } catch {
      setCommunityError("Failed to load community prompts");
    } finally {
      setCommunityLoading(false);
    }
  }

  async function openCommunityView() {
    setView("community");
    if (communityPrompts.length === 0) {
      await loadCommunityPrompts();
    }
  }

  async function handleSubmit() {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("Prompt is required");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          anonymous,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Failed to submit prompt");
        return;
      }
      onSubmitted("Prompt submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-prompt-title"
        className="w-full max-w-3xl rounded-[8px] border border-border bg-background shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6 sm:py-5">
          <div>
            <h2 id="submit-prompt-title" className="text-2xl font-semibold text-balance">
              {view === "submit" ? "Submit a prompt" : "Community prompts"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              {view === "submit"
                ? "Prompt a coding agent to build what you want to see in Straude. If we like your prompt, we'll run it and merge the result."
                : "Browse what people want us to build next."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[4px] border border-border p-2 text-muted hover:text-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {view === "submit" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
            className="space-y-5 px-5 py-5 sm:px-6 sm:py-6"
          >
            <div>
              <label htmlFor="prompt-input" className="mb-2 block text-base font-semibold">
                Prompt
              </label>
              <Textarea
                id="prompt-input"
                ref={textareaRef}
                rows={7}
                maxLength={MAX_PROMPT_LENGTH}
                placeholder={"What should we build or improve?\n\nIdeas to get started:\n- Feature request: \"Add keyboard shortcuts for editing posts\"\n- Bug fix: \"Comments flash as anonymous after posting\"\n- UI nitpick: \"Tighten spacing in the feed cards\"\n- Growth idea: \"Add a referral badge to help more people discover Straude\""}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
                error={!!error}
              />
              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                <span>Be specific about behavior, UX, and edge cases.</span>
                <span className="tabular-nums">
                  {prompt.length}/{MAX_PROMPT_LENGTH}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-border bg-subtle px-3 py-2">
              <p className="text-sm text-muted">
                {anonymous
                  ? "Submitting as Anonymous"
                  : username
                    ? `Submitting as @${username}`
                    : "Submitting with your account"}
              </p>
              <button
                type="button"
                onClick={() => setAnonymous((v) => !v)}
                className="text-sm font-medium text-accent hover:underline"
              >
                {anonymous ? "Submit with username" : "Submit as anonymous"}
              </button>
            </div>

            {error && (
              <p role="alert" className="text-sm text-error">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => {
                  void openCommunityView();
                }}
                className="text-left text-sm font-medium text-accent hover:underline"
              >
                View community prompts
              </button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit prompt ⌘↵"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
            <div className="max-h-[420px] overflow-y-auto rounded-[4px] border border-border">
              {communityLoading ? (
                <p className="px-4 py-8 text-center text-sm text-muted">
                  Loading community prompts...
                </p>
              ) : communityError ? (
                <p role="alert" className="px-4 py-8 text-center text-sm text-error">
                  {communityError}
                </p>
              ) : communityPrompts.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">
                  No prompts yet.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {communityPrompts.map((row) => {
                    const usernameValue = row.user?.username ?? null;
                    const canLink = Boolean(usernameValue && !row.is_anonymous);
                    return (
                      <article key={row.id} className="px-4 py-4">
                        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                          {canLink ? (
                            <Link
                              href={`/u/${usernameValue}`}
                              className="font-semibold text-accent hover:underline"
                            >
                              @{usernameValue}
                            </Link>
                          ) : (
                            <span className="font-semibold text-muted">
                              {row.is_anonymous ? "Anonymous" : "Unknown user"}
                            </span>
                          )}
                          <span suppressHydrationWarning className="text-muted">
                            {timeAgo(row.created_at)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                          {row.prompt}
                        </p>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setView("submit")}
                className="text-left text-sm font-medium text-accent hover:underline"
              >
                Back to submit a prompt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
