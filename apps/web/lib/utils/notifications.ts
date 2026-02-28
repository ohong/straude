import type { Notification } from "@/types";

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

export function notificationMessage(n: Notification): string {
  const actor = n.actor?.username ?? "Someone";
  switch (n.type) {
    case "follow":
      return `${actor} started following you`;
    case "kudos":
      return `${actor} gave kudos to your post`;
    case "comment":
      return `${actor} commented on your post`;
    case "mention":
      return `${actor} mentioned you in a ${n.comment_id ? "comment" : "post"}`;
    default:
      return `${actor} interacted with you`;
  }
}

export function notificationHref(n: Notification): string {
  switch (n.type) {
    case "follow":
      return n.actor?.username ? `/u/${n.actor.username}` : "/notifications";
    case "kudos":
    case "comment":
    case "mention":
      return n.post_id ? `/post/${n.post_id}` : "/notifications";
    default:
      return "/notifications";
  }
}
