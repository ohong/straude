"use client";

import { useState } from "react";
import { usePostHog } from "posthog-js/react";

export function FollowButton({
  username,
  initialFollowing,
}: {
  username: string;
  initialFollowing: boolean;
}) {
  const posthog = usePostHog();
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const prevFollowing = following;
    setFollowing(!following);
    setLoading(true);
    const method = prevFollowing ? "DELETE" : "POST";
    const res = await fetch(`/api/follow/${username}`, { method });
    if (res.ok) {
      posthog.capture(prevFollowing ? "user_unfollowed" : "user_followed", {
        followed_username: username,
      });
    } else {
      setFollowing(prevFollowing);
    }
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={
        following
          ? "border border-border px-3 py-1 text-sm font-semibold hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
          : "bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
      }
      style={{ borderRadius: 4 }}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
