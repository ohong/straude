export interface AppCountsResponse {
  notification_unread_count: number;
  message_unread_count: number;
}

export async function fetchAppCounts(): Promise<AppCountsResponse> {
  const response = await fetch("/api/app/counts");

  if (!response.ok) {
    throw new Error("Failed to load app counts.");
  }

  return response.json();
}
