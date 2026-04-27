export const queryKeys = {
  appBootstrap: () => ["app", "bootstrap"] as const,
  appCounts: () => ["app", "counts"] as const,
  notifications: (params?: {
    limit?: number;
    offset?: number;
    type?: string | null;
  }) => ["notifications", params ?? {}] as const,
  messageThreads: (params?: { limit?: number }) =>
    ["messages", "threads", params ?? {}] as const,
  messageConversation: (username: string | null | undefined) =>
    ["messages", "conversation", username ?? ""] as const,
  feedRoute: (params?: Record<string, string | number | boolean | null>) =>
    ["routes", "feed", params ?? {}] as const,
  profileRoute: (username: string | null | undefined) =>
    ["routes", "profile", username ?? ""] as const,
  searchRoute: (params?: { q?: string | null; type?: string | null }) =>
    ["routes", "search", params ?? {}] as const,
};
