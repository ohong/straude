"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Workspace = { id: string; name: string; role: string };

export function WorkspaceListClient() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/workspaces", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not load workspaces.");
      setWorkspaces(payload.workspaces);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load workspaces.");
    }
  }, []);

  useEffect(() => { setReady(true); void load(); }, [load]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not create workspace.");
      router.push(`/workspaces/${payload.workspace.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create workspace.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">Private team context</p>
        <h1 className="mt-2 text-balance text-3xl font-semibold">Your workspaces</h1>
        <p className="mt-3 max-w-2xl text-pretty text-muted">Review work usage together. Your personal history stays separate, and nobody needs a public profile.</p>
      </header>
      {error && <div role="alert" className="space-y-2 text-error"><p>{error}</p><Button variant="secondary" onClick={() => void load()}>Try again</Button></div>}
      <section aria-labelledby="existing-workspaces">
        <h2 id="existing-workspaces" className="text-lg font-semibold">Joined workspaces</h2>
        {workspaces === null ? <p className="mt-3 text-muted" role="status">Loading workspaces…</p> : workspaces.length === 0 ? <p className="mt-3 text-muted">No workspaces yet. Create one below or open an invitation from a colleague.</p> : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {workspaces.map((workspace) => <li key={workspace.id}><Link href={`/workspaces/${workspace.id}`} className="block rounded border border-border p-5 hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><span className="block break-words font-semibold">{workspace.name}</span><span className="mt-1 block text-sm capitalize text-muted">{workspace.role}</span></Link></li>)}
          </ul>
        )}
      </section>
      <section className="max-w-xl rounded border border-border p-5" aria-labelledby="create-workspace">
        <h2 id="create-workspace" className="text-lg font-semibold">Create a private workspace</h2>
        <p className="mt-2 text-sm text-muted">Creating a workspace does not move or publish any existing usage.</p>
        <form onSubmit={create} className="mt-5 space-y-3">
          <label htmlFor="workspace-name" className="block text-sm font-medium">Workspace name</label>
          <Input id="workspace-name" value={name} onChange={(event) => setName(event.target.value)} disabled={!ready} required maxLength={100} autoComplete="organization" />
          <Button type="submit" disabled={!ready || busy || !name.trim()}>{busy ? "Creating…" : "Create workspace"}</Button>
        </form>
      </section>
      <p className="text-sm text-muted"><Link href="/recap" className="text-accent underline">Review your personal week</Link> or <Link href="/teams" className="text-accent underline">read the team setup guide</Link>.</p>
    </div>
  );
}
