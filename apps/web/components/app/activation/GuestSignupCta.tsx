"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { trackActivationEvent } from "@/lib/analytics/client";

export function GuestSignupCta({
  surface,
  ctaLocation,
}: {
  surface: "feed" | "profile";
  ctaLocation: string;
}) {
  return (
    <section className="border-b border-border bg-accent/5 px-4 py-5 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Want your own stats here?</p>
          <p className="mt-1 text-sm text-muted">
            Sign up, run one sync, and Straude will turn your next coding
            session into spend, tokens, streaks, and a shareable post.
          </p>
        </div>
        <Link
          href="/signup"
          onClick={() =>
            trackActivationEvent("guest_signup_cta_clicked", {
              surface,
              cta_location: ctaLocation,
              destination: "/signup",
              activation_state: "anonymous",
              is_authenticated: false,
            })
          }
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-[filter,transform] hover:brightness-110 active:scale-[0.98]"
        >
          Start your streak
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
