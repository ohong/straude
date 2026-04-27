import type { Notification } from "@/types";

export interface NotificationsResponse {
  notifications: Notification[];
  unread_count: number;
}

export async function fetchNotifications(): Promise<NotificationsResponse> {
  const response = await fetch("/api/notifications");

  if (!response.ok) {
    throw new Error("Failed to load notifications.");
  }

  return response.json();
}
