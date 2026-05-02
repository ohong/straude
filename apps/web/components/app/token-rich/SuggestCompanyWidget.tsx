"use client";

import { cloneElement, isValidElement, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { useFocusTrap } from "@/components/app/shared/useFocusTrap";

interface SuggestCompanyWidgetProps {
  isLoggedIn: boolean;
  children: React.ReactNode;
}

export function SuggestCompanyWidget({ isLoggedIn, children }: SuggestCompanyWidgetProps) {
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [policyDescription, setPolicyDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const openModal = useCallback(() => {
    setOpen(true);
    setError(null);
  }, []);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Auto-focus first input
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => firstInputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Focus trap
  useFocusTrap(dialogRef, open);

  // Flash timeout
  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 4500);
    return () => window.clearTimeout(id);
  }, [flash]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/company-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName.trim(),
          company_url: companyUrl.trim(),
          policy_description: policyDescription.trim(),
          source_url: sourceUrl.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Failed to submit suggestion");
        return;
      }
      setCompanyName("");
      setCompanyUrl("");
      setPolicyDescription("");
      setSourceUrl("");
      setOpen(false);
      setFlash("Thanks for suggesting. We'll verify and update the list accordingly.");
    } finally {
      setSubmitting(false);
    }
  }

  // Clone children to pass onSuggest callback
  const childrenWithProps = isValidElement(children)
    ? cloneElement(children, { onSuggest: openModal } as Record<string, unknown>)
    : children;

  return (
    <>
      {flash && (
        <div role="status" aria-live="polite" className="fixed right-3 bottom-[124px] z-40 rounded-[4px] border border-border bg-background px-3 py-2 text-xs text-foreground shadow-sm sm:right-4 sm:bottom-[72px]">
          {flash}
        </div>
      )}

      {childrenWithProps}

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="suggest-company-title"
              className="w-full max-w-lg rounded-[8px] border border-border bg-background shadow-xl"
            >
              <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6 sm:py-5">
                <div>
                  <h2 id="suggest-company-title" className="text-xl font-semibold">
                    Add a company
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Does your company empower employees with high token budgets? Add it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-[4px] border border-border p-2 text-muted hover:text-foreground"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {!isLoggedIn ? (
                <div className="px-5 py-8 text-center sm:px-6">
                  <p className="text-sm text-muted">
                    <Link href="/login" className="font-medium text-accent hover:underline">
                      Sign in
                    </Link>{" "}
                    to add a company.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSubmit();
                  }}
                  className="space-y-4 px-5 py-5 sm:px-6 sm:py-6"
                >
                  <div>
                    <label htmlFor="company-name" className="mb-1 block text-sm font-semibold">
                      Company Name
                    </label>
                    <input
                      id="company-name"
                      ref={firstInputRef}
                      type="text"
                      required
                      maxLength={200}
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full rounded-[4px] border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent focus:ring-3 focus:ring-accent/15"
                      placeholder="e.g., Acme Corp"
                    />
                  </div>

                  <div>
                    <label htmlFor="company-url" className="mb-1 block text-sm font-semibold">
                      Company URL
                    </label>
                    <input
                      id="company-url"
                      type="url"
                      required
                      maxLength={500}
                      value={companyUrl}
                      onChange={(e) => setCompanyUrl(e.target.value)}
                      className="w-full rounded-[4px] border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent focus:ring-3 focus:ring-accent/15"
                      placeholder="https://company.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="policy-desc" className="mb-1 block text-sm font-semibold">
                      Current Policy
                    </label>
                    <Textarea
                      id="policy-desc"
                      required
                      maxLength={500}
                      rows={3}
                      value={policyDescription}
                      onChange={(e) => setPolicyDescription(e.target.value)}
                      placeholder="e.g., Unlimited Claude Code access for all engineers"
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                          e.preventDefault();
                          void handleSubmit();
                        }
                      }}
                    />
                    <p className="mt-1 text-right text-xs tabular-nums text-muted">
                      {policyDescription.length}/500
                    </p>
                  </div>

                  <div>
                    <label htmlFor="source-url" className="mb-1 block text-sm font-semibold">
                      Source
                    </label>
                    <input
                      id="source-url"
                      type="url"
                      required
                      maxLength={500}
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      className="w-full rounded-[4px] border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent focus:ring-3 focus:ring-accent/15"
                      placeholder="Link to careers page, CEO tweet, etc."
                    />
                  </div>

                  {error && (
                    <p role="alert" className="text-sm text-error">
                      {error}
                    </p>
                  )}

                  <div className="flex justify-end border-t border-border pt-4">
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Submitting..." : "Submit \u2318\u21B5"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
