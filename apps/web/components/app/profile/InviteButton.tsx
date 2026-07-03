"use client";

import { UserPlus, Check } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useClipboardFeedback } from "@/lib/utils/useClipboardFeedback";

export function InviteButton({ username }: { username: string }) {
  const posthog = usePostHog();
  const { copied, copyText } = useClipboardFeedback();

  function handleCopy() {
    void copyText(`https://straude.com/join/${username}`).then((didCopy) => {
      if (didCopy) {
        posthog.capture("invite_link_copied", { inviter_username: username });
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 border border-border px-3 py-1 text-sm font-semibold hover:bg-subtle"
      style={{ borderRadius: 4 }}
    >
      {copied ? (
        <>
          <Check size={14} className="text-accent" />
          Copied
        </>
      ) : (
        <>
          <UserPlus size={14} />
          Invite
        </>
      )}
    </button>
  );
}
