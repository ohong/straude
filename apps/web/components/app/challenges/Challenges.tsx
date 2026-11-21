"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { captureConsentedPostHogEvent } from "@/lib/analytics/client";

export type ChallengeGroup = { id: string; start: string; organizer: string };
export type ChallengeBuild = { id: string; title: string; day: string; author?: string };
type GroupDetail = ChallengeGroup & { end: string; ended: boolean; roster: { id: string; name: string; days: number }[]; choices: ChallengeBuild[]; gallery: ChallengeBuild[] };
const groupHref = (id: string) => `/challenges?group=${id}`;

export function Challenges({ groups, selected, invitation }: {
  groups: ChallengeGroup[]; selected?: GroupDetail; invitation?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [inviteFallback, setInviteFallback] = useState("");
  const [postId, setPostId] = useState("");
  const chosen = selected?.choices.some(item => item.id === postId) ? postId : selected?.choices[0]?.id;
  const act = (action: "create" | "join" | "share" | "leave") => start(async () => {
    setMessage("");
    try {
      const { data, error } = await createClient().rpc("update_build_challenge", {
        action, target: selected?.id ?? invitation ?? null, post: action === "share" ? chosen : null,
      });
      if (error) throw new Error(error.message);
      void captureConsentedPostHogEvent(`build_challenge_${action}`);
      router.push(action === "leave" ? "/challenges" : groupHref(data));
      router.refresh();
      if (action === "share") setMessage("Build added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update your challenge. Try again.");
    }
  });
  return <section aria-label="Build challenge" className="mx-auto max-w-2xl space-y-6 p-6">
    <h1 className="text-2xl font-semibold">Three build days</h1>
    {selected ? <>
      <p className="text-sm text-muted">{selected.start} to {selected.end} · UTC · {selected.ended ? "Finished" : "In progress"}</p>
      <section aria-label="Group progress">
        <h2 className="font-semibold">{selected.roster.filter(member => member.days >= 3).length} of {selected.roster.length} reached three days</h2>
        <ul className="mt-3 divide-y divide-border">{selected.roster.map(member => <li className="flex justify-between py-2" key={member.id}>
          <span>{member.name}</span><span>{member.days} {member.days === 1 ? "day" : "days"}</span>
        </li>)}</ul>
      </section>
      {!selected.ended && <section className="space-y-3">
        {selected.choices.length > 0 ? <>
          <label className="block font-semibold" htmlFor="challenge-build">Add a build from this week</label>
          <select id="challenge-build" className="w-full border border-border bg-background p-2" value={chosen} onChange={event => setPostId(event.target.value)}>
            {selected.choices.map(item => <option key={item.id} value={item.id}>{item.day} · {item.title}</option>)}
          </select>
          <Button disabled={pending} onClick={() => act("share")}>Add build</Button>
        </> : <p className="text-sm text-muted">Give a synced post from another day a title, description, or screenshot to add it here.</p>}
        <div><Button variant="secondary" onClick={async () => {
          const url = new URL(groupHref(selected.id), location.origin).href;
          try { await navigator.clipboard.writeText(url); setMessage("Invite link copied."); }
          catch { setInviteFallback(url); }
        }}>Copy invite link</Button>
        {inviteFallback && <input aria-label="Invite link" readOnly value={inviteFallback} onFocus={event => event.target.select()} className="w-full border p-2" />}</div>
      </section>}
      <section><h2 className="font-semibold">Group builds</h2>
        {selected.gallery.length ? <ul className="mt-3 space-y-3">{selected.gallery.map(item => <li key={item.id}>
          <Link className="font-semibold text-accent underline" href={`/post/${item.id}`}>{item.title}</Link><p className="text-sm text-muted">{item.author} · {item.day}</p>
        </li>)}</ul> : <p className="mt-2 text-sm text-muted">Builds you can view appear here.</p>}
      </section>
      <div className="flex flex-wrap items-center gap-4"><Link href="/challenges" className="underline">Your challenges</Link>
        <Button disabled={pending} variant="ghost" onClick={() => act("leave")}>Leave challenge</Button></div>
    </> : <>
      <p>Share a build on three days this week with up to five friends. Each day counts once.</p>
      <p className="text-sm text-muted">Group members see your name and how many days you shared. Each post keeps its existing audience. Leaving removes your entries.</p>
      <Button disabled={pending} onClick={() => act(invitation ? "join" : "create")}>{invitation ? "Join challenge" : "Start this week’s challenge"}</Button>
      {groups.length > 0 && <section><h2 className="font-semibold">Your challenges</h2><ul className="mt-3 space-y-2">{groups.map(group =>
        <li key={group.id}><Link href={groupHref(group.id)} className="text-accent underline">{group.organizer}’s group · week of {group.start}</Link></li>)}</ul></section>}
    </>}
    <p role="status" className="text-sm">{message}</p>
  </section>;
}
