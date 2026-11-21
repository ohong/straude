"use client";

import { useState } from "react";
import { captureConsentedPostHogEvent } from "@/lib/analytics/client";
import type { BuildHighlight } from "@/lib/utils/recap";

export function HighlightPicker({ options, selected, week, onSave }: {
  options: BuildHighlight[];
  selected?: BuildHighlight;
  week: string;
  onSave: (post: BuildHighlight | undefined) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!options.length) return null;
  return <div className="mb-6">
    <label htmlFor="weekly-highlight" className="block text-sm font-semibold">Build of the week</label>
    <p id="weekly-highlight-help" className="my-2 text-sm text-muted">Choose a post for your weekly recap card.</p>
    <select id="weekly-highlight" aria-describedby="weekly-highlight-help" className="max-w-full border border-border bg-background p-2" value={selected?.id ?? ""} disabled={busy}
      onChange={async event => {
        const post = options.find(option => option.id === event.target.value);
        setBusy(true);
        setMessage("");
        try {
          const response = await fetch("/api/recap/highlight", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week, post_id: post?.id ?? null }) });
          if (!response.ok) throw new Error((await response.json()).error);
          onSave(post);
          setMessage(post ? "Highlight saved." : "Highlight removed.");
          if (post) void captureConsentedPostHogEvent("weekly_highlight_selected");
        } catch (reason) {
          setMessage(reason instanceof Error ? reason.message : "Could not save. Try again.");
        } finally {
          setBusy(false);
        }
      }}>
      <option value="">No highlight</option>
      {options.map(post => <option key={post.id} value={post.id}>{post.title}</option>)}
    </select>
    <p role="status" className="mt-1 text-sm text-muted">{message}</p>
  </div>;
}
