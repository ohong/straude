"use client";

import { useState } from "react";

export function FollowButton({
  username,
  initialFollowing,
}: {
  username: string;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const method = following ? "DELETE" : "POST";
    const res = await fetch(`/api/follow/${username}`, { method });
    if (res.ok) {
      setFollowing(!following);
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
          ? "border border-border px-3 py-1 text-sm font-semibold hover:bg-subtle disabled:opacity-50"
          : "bg-accent px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
      }
      style={{ borderRadius: 4 }}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
