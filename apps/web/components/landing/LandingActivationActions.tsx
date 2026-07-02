"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Check } from "lucide-react";
import { trackActivationEvent } from "@/lib/analytics/client";
import { LANDING_SYNC_COMMAND } from "@/components/landing/constants";

export function SignupCtaLink({
  children,
  className,
  ctaLocation,
}: {
  children: React.ReactNode;
  className: string;
  ctaLocation: string;
}) {
  return (
    <Link
      href="/signup"
      onClick={() =>
        trackActivationEvent("landing_primary_cta_clicked", {
          surface: "landing",
          cta_location: ctaLocation,
          destination: "/signup",
          activation_state: "anonymous",
          is_authenticated: false,
        })
      }
      className={className}
    >
      {children}
    </Link>
  );
}

export function CopyCommandButton({
  command = LANDING_SYNC_COMMAND,
  className,
}: {
  command?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(command).then(() => {
      trackActivationEvent("sync_command_copied", {
        surface: "landing",
        command,
        activation_state: "sync_command_copied",
        is_authenticated: false,
      });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }, [command]);

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ??
        "inline-flex cursor-pointer items-center gap-4 border border-landing-border bg-landing-panel px-4 py-3 font-[family-name:var(--font-mono)] text-sm text-landing-muted transition-[border-color,transform] hover:border-landing-dim active:scale-[0.97]"
      }
    >
      ${" "}
      <span className="text-landing-text">{command}</span>
      {copied && (
        <Check className="h-4 w-4 text-accent" aria-hidden="true" />
      )}
    </button>
  );
}
