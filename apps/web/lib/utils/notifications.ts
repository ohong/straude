import type { Notification } from "@/types";
import { NOTIFICATION_TYPES } from "@/lib/events";
export { timeAgo } from "./format";

export function notificationMessage(n: Notification): string {
  const actor = n.actor?.username ?? "Someone";
  switch (n.type) {
    case NOTIFICATION_TYPES.FOLLOW:
      return `${actor} started following you`;
    case NOTIFICATION_TYPES.KUDOS:
      return `${actor} gave kudos to your post`;
    case NOTIFICATION_TYPES.COMMENT:
      return `${actor} commented on your post`;
    case NOTIFICATION_TYPES.MENTION:
      return `${actor} mentioned you in a ${n.comment_id ? "comment" : "post"}`;
    case NOTIFICATION_TYPES.MESSAGE:
      return `${actor} sent you a direct message`;
    case NOTIFICATION_TYPES.REFERRAL:
      return `${actor} joined your crew`;
    default:
      return `${actor} interacted with you`;
  }
}

export function notificationHref(n: Notification): string {
  switch (n.type) {
    case NOTIFICATION_TYPES.FOLLOW:
      return n.actor?.username ? `/u/${n.actor.username}` : "/notifications";
    case NOTIFICATION_TYPES.KUDOS:
    case NOTIFICATION_TYPES.COMMENT:
    case NOTIFICATION_TYPES.MENTION:
      return n.post_id ? `/post/${n.post_id}` : "/notifications";
    case NOTIFICATION_TYPES.MESSAGE:
      return n.actor?.username
        ? `/messages?with=${encodeURIComponent(n.actor.username)}`
        : "/messages";
    case NOTIFICATION_TYPES.REFERRAL:
      return n.actor?.username ? `/u/${n.actor.username}` : "/notifications";
    default:
      return "/notifications";
  }
}
