"use client";

import { useState } from "react";

export function UsageAudience({ initialPublic, onSaving }: {
  initialPublic: boolean;
  onSaving?: (saving: boolean) => void;
}) {
  const [isPublic, setPublic] = useState(initialPublic);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function changeAudience() {
    setSaving(true);
    onSaving?.(true);
    setError(false);
    try {
      const result = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: !isPublic }),
      });
      if (!result.ok) throw new Error("Save failed");
      setPublic(!isPublic);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
      onSaving?.(false);
    }
  }

  return (
    <section aria-label="Profile audience" className="my-4 space-y-1 border-l-2 border-border px-3 text-left text-sm">
      <p className="font-semibold" role="status">{isPublic ? "Public profile" : "Private profile"}</p>
      <p className="text-muted">{isPublic
        ? "Anyone can see your synced activity. You can appear on leaderboards."
        : "Only you and your followers can see your synced activity. New followers need your approval."}</p>
      <button type="button" onClick={changeAudience} disabled={saving} className="underline underline-offset-2">
        {saving ? "Saving…" : isPublic ? "Make my profile private" : "Make my profile public"}
      </button>
      {error && <p role="alert" className="text-error">Could not save your audience. Try again.</p>}
    </section>
  );
}
