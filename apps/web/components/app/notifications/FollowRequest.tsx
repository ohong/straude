"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function FollowRequest({ id, name, onDecision }: { id: string; name: string; onDecision: () => void }) {
  const [state, setState] = useState<"idle" | "saving" | "error" | "done">("idle");
  async function review(approve: boolean) {
    setState("saving");
    try {
      const res = await fetch(`/api/follow-requests/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approve }),
      });
      if (!res.ok) throw new Error("Could not save decision");
      setState("done");
      window.dispatchEvent(new Event("notifications-updated"));
      onDecision();
    } catch {
      setState("error");
    }
  }
  if (state === "done") return null;
  return (
    <div className="space-y-2 border-b border-border px-6 py-3">
      <p>{name} requests to follow you.</p>
      <div className="flex gap-2">
        <Button disabled={state === "saving"} onClick={() => review(true)}>Approve</Button>
        <Button variant="secondary" disabled={state === "saving"} onClick={() => review(false)}>Decline</Button>
      </div>
      {state === "error" && <p role="alert">Could not save your decision. Try again.</p>}
    </div>
  );
}
