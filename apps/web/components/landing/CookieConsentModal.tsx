"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui-components/react/dialog";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  COOKIE_CONSENT_EVENT,
  type CookieConsentPreference,
  getCookieConsentFromCookieString,
} from "@/lib/cookie-consent";

export function CookieConsentModal() {
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<CookieConsentPreference | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOpen(getCookieConsentFromCookieString(document.cookie) === null);
    setChecked(true);
  }, []);

  async function savePreference(preference: CookieConsentPreference) {
    setSaving(preference);
    setError(null);

    try {
      const response = await fetch("/api/cookie-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preference }),
      });

      if (!response.ok) {
        throw new Error("Failed to save cookie preference");
      }

      window.dispatchEvent(
        new CustomEvent(COOKIE_CONSENT_EVENT, {
          detail: {
            preference,
            analytics: preference === "all",
          },
        }),
      );
      setOpen(false);
    } catch {
      setError("Could not save your preference. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  if (!checked || !open) return null;

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-[2px]" />
        <Dialog.Popup className="fixed inset-x-4 bottom-4 z-[100] mx-auto w-auto max-w-lg rounded-md border border-landing-border bg-landing-surface p-4 text-landing-text shadow-2xl sm:bottom-6 sm:p-5">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border border-landing-border bg-landing-panel text-accent">
              <ShieldCheck size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold leading-tight">
                Cookie consent
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-6 text-landing-muted">
                Straude uses essential cookies for Supabase Auth sessions,
                security, referrals, and this preference. Analytics stays off
                unless you choose to accept all cookies.
              </Dialog.Description>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  size="md"
                  className="w-full border border-accent bg-accent text-accent-foreground sm:w-auto"
                  disabled={saving !== null}
                  onClick={() => savePreference("essential")}
                >
                  {saving === "essential" ? "Saving..." : "Accept essential"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  className="w-full border-landing-border bg-transparent text-landing-text hover:bg-landing-hover sm:w-auto"
                  disabled={saving !== null}
                  onClick={() => savePreference("all")}
                >
                  {saving === "all" ? "Saving..." : "Accept all"}
                </Button>
                <Link
                  href="/privacy"
                  className="px-1 py-2 text-center text-xs font-semibold text-landing-muted underline underline-offset-4 hover:text-landing-text sm:ml-auto"
                >
                  Privacy policy
                </Link>
              </div>
              {error ? (
                <p className="mt-3 text-xs font-medium text-error" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
