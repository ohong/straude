"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import WeeklyWorkspaceReport from "@/components/app/WeeklyWorkspaceReport";
import { SharingDisclosure } from "./SharingDisclosure";

type Source = { id: string; user_id: string; name: string; start_date: string; first_sync_at: string | null; last_received_at: string | null; revoked_at: string | null };
type Member = { user_id: string; role: string; joined_at: string; removed_at: string | null; email: string | null; display_name: string | null };
type Invite = { id: string; email: string; created_at: string; expires_at: string; accepted_at: string | null; revoked_at: string | null };
type Detail = { workspace: { id: string; name: string }; role: string; members: Member[]; invites: Invite[]; sources: Source[] };

function receivedAt(value: string | null) {
  return value ? `${new Date(value).toISOString().replace("T", " ").slice(0, 16)} UTC` : "No data received";
}

function sourceStatus(source: Source) {
  if (source.revoked_at) return "Access removed";
  if (!source.first_sync_at) return "Waiting for first sync";
  if (!source.last_received_at || Date.now() - new Date(source.last_received_at).getTime() > 48 * 60 * 60 * 1000) return "Stale — no sync in 48 hours";
  return "First sync confirmed";
}

export function WorkspaceDetailClient({ workspaceId }: { workspaceId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [invitation, setInvitation] = useState<{ url: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setDetail(null);
        throw new Error(payload.error ?? "This workspace is unavailable. Ask the owner to check your membership.");
      }
      setDetail(payload);
      setLoadedAt(new Date().toISOString());
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load workspace. Check your connection and try again.");
      return false;
    }
  }, [workspaceId]);

  useEffect(() => { void load(); }, [load]);

  async function refresh() {
    setBusy(true);
    setError(null);
    await load();
    setBusy(false);
  }

  async function act(body: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not save this change.");
      if (body.action === "invite") {
        setInvitation({ url: `${window.location.origin}/workspaces/join/${payload.token}`, email: body.email });
        setEmail("");
        setCopied(false);
      } else if (body.action === "revoke") {
        setInvitation(null);
      }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this change. Try again.");
    } finally { setBusy(false); }
  }

  async function copyInvitation() {
    if (!invitation) return;
    try { await navigator.clipboard.writeText(invitation.url); setCopied(true); }
    catch { setError("Could not copy the invitation. Select and copy the link below."); }
  }

  const command = `straude workspace connect ${workspaceId} --work-only`;

  return (
    <div className="space-y-8">
      {error && <div role="alert" className="rounded border border-error p-4"><p className="text-error">{error}</p><Button className="mt-3" variant="secondary" onClick={() => void refresh()} disabled={busy}>Check again</Button></div>}
      {!detail ? (!error && <p role="status" className="text-muted">Loading workspace…</p>) : <>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-widest text-muted">Private workspace · {detail.role}</p><h1 className="mt-2 break-words text-3xl font-semibold">{detail.workspace.name}</h1><p className="mt-3 text-sm text-muted">Team contributions are separate from your <Link href="/recap" className="text-accent underline">personal recap</Link>.</p></div>
          <Button variant="secondary" disabled={busy} onClick={() => void refresh()}>{busy ? "Checking…" : "Refresh setup status"}</Button>
        </header>
        <WeeklyWorkspaceReport workspaceId={workspaceId} />
        <section aria-labelledby="setup-heading" className="space-y-5 border-t border-border pt-8">
          <div><h2 id="setup-heading" className="text-2xl font-semibold">Connect your work-only source</h2><p className="mt-2 text-sm text-muted">Use the workspace-capable pilot CLI supplied by your workspace administrator. The commands below use that installed build. Connecting does not collect usage; collection begins with a later sync.</p></div>
          <SharingDisclosure />
          <ol className="list-decimal space-y-4 pl-5 text-sm leading-relaxed">
            <li>Install the workspace-capable pilot CLI using your administrator’s instructions on a device or operating-system account used only for work. Run <code className="font-mono">straude login</code> and sign in with the same account you used here.</li>
            <li>Designate that source for this workspace. The <code className="font-mono">--work-only</code> flag confirms your choice.<pre className="mt-2 whitespace-pre-wrap break-all rounded border border-border bg-subtle p-4 font-mono text-sm"><code>{command}</code></pre></li>
            <li>Starting the next UTC day, run <code className="font-mono">straude</code> after using Claude Code or Codex. Refresh setup status here to confirm the first sync.</li>
            <li>For automatic sync, use the existing <code className="font-mono">straude --auto</code> setup. Check the local scheduler with <code className="font-mono">straude auto</code>. This page confirms received data; it cannot verify a scheduler on your device.</li>
          </ol>
          <details className="rounded border border-border p-4"><summary className="cursor-pointer font-semibold">No data received? Repair your setup</summary><div className="mt-3 space-y-2 text-sm leading-relaxed text-muted"><p>Check <code>straude workspace status</code> on the work-only source. If sharing has not started yet, wait until its start date; personal history cannot be backfilled.</p><p>After the start date, finish a supported tool session, rerun <code>straude</code>, and refresh this page. Retrying replaces the same daily totals rather than adding them twice.</p><p>If authentication expired, run <code>straude login</code> with the same account. If access was removed, ask the workspace owner. <Link href="/cli" className="text-accent underline">CLI reference</Link> · <Link href="/contact" className="text-accent underline">Get help</Link></p></div></details>
        </section>
        <section aria-labelledby="members-heading" className="space-y-4 border-t border-border pt-8">
          <div><h2 id="members-heading" className="text-2xl font-semibold">Members and setup</h2><p className="mt-2 text-sm text-muted">A received zero-usage day is data. “No data received” means collection is unconfirmed. Last checked {receivedAt(loadedAt)}.</p></div>
          <ul className="space-y-3">
            {detail.members.map((member) => {
              const sources = detail.sources.filter((source) => source.user_id === member.user_id);
              const label = member.display_name || member.email || "Workspace member";
              return <li key={member.user_id} className="rounded border border-border p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{label}</h3><p className="mt-1 break-all text-sm text-muted">{member.email} · {member.role} · {member.removed_at ? "Removed" : `Joined ${member.joined_at.slice(0, 10)}`}</p></div>{detail.role === "owner" && member.role !== "owner" && !member.removed_at && <Button variant="secondary" size="sm" disabled={busy} onClick={() => void act({ action: "remove", user_id: member.user_id })} aria-label={`Remove ${label}`}>Remove access</Button>}</div>{sources.length === 0 ? <p className="mt-3 text-sm text-muted">No source connected · No data received</p> : <ul className="mt-4 space-y-3">{sources.map((source) => <li key={source.id} className="border-l-2 border-border pl-3 text-sm"><p className="break-words font-medium">{source.name} · {sourceStatus(source)}</p><p className="mt-1 text-muted">Sharing from {source.start_date} UTC · Last received: {receivedAt(source.last_received_at)}</p></li>)}</ul>}</li>;
            })}
          </ul>
          <p className="text-sm text-muted">Removing access stops future sharing and workspace access. Previously contributed report totals remain.</p>
        </section>
        {detail.role === "owner" && <section aria-labelledby="invite-heading" className="space-y-4 border-t border-border pt-8">
          <h2 id="invite-heading" className="text-2xl font-semibold">Invite colleagues</h2>
          <p className="text-sm text-muted">Create a link for a specific email address, then share it yourself. Straude does not send an invitation email.</p>
          <form onSubmit={(event) => { event.preventDefault(); void act({ action: "invite", email: email.trim() }); }} className="max-w-xl space-y-3"><label htmlFor="invite-email" className="block text-sm font-medium">Colleague’s email</label><Input id="invite-email" type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} required /><Button type="submit" disabled={busy || !email.trim()}>Create invitation link</Button></form>
          {invitation && <div className="max-w-xl space-y-3 rounded border border-border bg-subtle p-4"><p role="status" className="break-words text-sm">Invitation created for {invitation.email}. Copy this link now; it is shown only once.</p><label htmlFor="invitation-link" className="block text-sm font-medium">Invitation link</label><Input id="invitation-link" readOnly value={invitation.url} onFocus={(event) => event.target.select()} /><Button variant="secondary" onClick={() => void copyInvitation()}>{copied ? "Copied" : "Copy invitation link"}</Button></div>}
          <ul className="space-y-3">{detail.invites.map((invite) => <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-border p-4"><div className="min-w-0"><p className="break-all text-sm font-medium">{invite.email}</p><p className="mt-1 text-xs text-muted">{invite.revoked_at ? "Revoked" : invite.accepted_at ? "Joined" : new Date(invite.expires_at).getTime() < Date.now() ? "Expired" : "Invited"} · Expires {invite.expires_at.slice(0, 10)}</p></div>{!invite.revoked_at && !invite.accepted_at && <Button variant="secondary" size="sm" disabled={busy} onClick={() => void act({ action: "revoke", invite_id: invite.id })} aria-label={`Revoke invitation for ${invite.email}`}>Revoke invitation</Button>}</li>)}</ul>
        </section>}
      </>}
    </div>
  );
}
