"use client";

import { useState } from "react";
import Link from "next/link";
import { captureConsentedPostHogEvent } from "@/lib/analytics/client";
import { Button } from "@/components/ui/Button";

export function BuildNote({ postId }: { postId: string }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  if (saved) return <p role="status" className="my-4 text-sm">Build note saved. <Link className="underline" href={`/post/${postId}?edit=1`}>Add details or a screenshot</Link></p>;
  return (
    <form className="my-5 space-y-2" onSubmit={async (event) => {
      event.preventDefault();
      if (busy || !title.trim()) return;
      setBusy(true);
      setError("");
      try {
        const res = await fetch(`/api/posts/${postId}/build-note`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
        if (!res.ok) throw new Error((await res.json()).error);
        setSaved(true);
        void captureConsentedPostHogEvent("build_note_saved", { surface: "onboarding" });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not save your note. Try again.");
      } finally {
        setBusy(false);
      }
    }}>
      <label htmlFor="build-note" className="block text-sm font-semibold">What did you ship, fix, or learn?</label>
      <input id="build-note" value={title} maxLength={100} onChange={event => setTitle(event.target.value)} className="w-full rounded border border-border bg-background p-2" aria-describedby="build-note-help" />
      <p id="build-note-help" className="text-xs text-muted">Optional. This becomes your synced post’s title and uses the same audience.</p>
      <Button type="submit" disabled={busy || !title.trim()}>Save build note</Button>
      {error && <p role="alert">{error} <Link href={`/post/${postId}?edit=1`} className="underline">Edit post</Link></p>}
    </form>
  );
}
