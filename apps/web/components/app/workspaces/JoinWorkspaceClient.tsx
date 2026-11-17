"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SharingDisclosure } from "./SharingDisclosure";

export function JoinWorkspaceClient({ token }: { token: string }) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/workspaces/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "This invitation could not be accepted. Ask the owner for a new link.");
      router.push(`/workspaces/${payload.workspace_id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not join workspace. Try again.");
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <header><p className="text-xs font-semibold uppercase tracking-widest text-muted">Private invitation</p><h1 className="mt-2 text-balance text-3xl font-semibold">Before you join</h1><p className="mt-3 text-muted">Sign in with the email address your colleague invited. Review the sharing boundaries before accepting.</p></header>
      <SharingDisclosure />
      <form onSubmit={join} className="space-y-4">
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required className="mt-1 size-4 shrink-0 accent-accent" /><span>I understand the sharing boundaries. I will connect a work-only source separately.</span></label>
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        <Button type="submit" disabled={busy || !accepted}>{busy ? "Joining…" : "Accept invitation"}</Button>
      </form>
    </div>
  );
}
