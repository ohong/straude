"use client";

import { useState } from "react";
import { usePostHog } from "posthog-js/react";

export function FollowButton({
  username, initialFollowing, initialRequested = false, privateProfile = false,
}: {
  username: string;
  initialFollowing: boolean;
  initialRequested?: boolean;
  privateProfile?: boolean;
}) {
  const posthog = usePostHog();
  const [state, setState] = useState<"following" | "requested" | "none">(
    initialFollowing ? "following" : initialRequested ? "requested" : "none",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    const previous = state;
    const removing = state !== "none";
    setState(removing ? "none" : privateProfile ? "requested" : "following");
    setError(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/follow/${username}`, { method: removing ? "DELETE" : "POST" });
      if (!res.ok) throw new Error("Follow failed");
      const data = await res.json();
      setState(data.following ? "following" : data.requested ? "requested" : "none");
      if (privateProfile && previous === "following") window.location.reload();
      if (data.following || previous === "following") {
        posthog.capture(data.following ? "user_followed" : "user_unfollowed", { followed_username: username });
      }
    } catch {
      setState(previous);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={toggle} disabled={loading}
        className={`rounded border px-3 py-1 text-sm font-semibold disabled:opacity-50 ${state === "none" ? "bg-accent text-accent-foreground" : "border-border hover:bg-subtle"}`}>
        {state === "following" ? "Following" : state === "requested" ? "Cancel request" : privateProfile ? "Request to follow" : "Follow"}
      </button>
      {error && <span role="alert" className="text-sm text-error">Could not update. Try again.</span>}
    </>
  );
}
