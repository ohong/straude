import type { Notification } from "@/types";
export { timeAgo } from "./format";

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
