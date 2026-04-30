import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(),
}));

vi.mock("@/lib/email/send-direct-message-email", () => ({
  sendDirectMessageEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => null),
}));

import { NextRequest } from "next/server";
import { GET as threadsGET } from "@/app/api/messages/threads/route";
import {
  GET as conversationGET,
  POST as messagePOST,
  PATCH as messagePATCH,
} from "@/app/api/messages/route";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { sendDirectMessageEmail } from "@/lib/email/send-direct-message-email";

function makeRequest(method: string, url: string, body?: unknown) {
  return new NextRequest(new URL(url, "http://localhost"), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/messages/threads", () => {
  it("returns threads and unread count", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            counterpart_id: "user-2",
            counterpart_username: "alice",
            counterpart_avatar_url: null,
            counterpart_display_name: "Alice",
            last_message_id: "m-1",
            last_message_content: "Hey there",
            last_message_created_at: "2026-03-06T12:00:00.000Z",
            last_message_sender_id: "user-2",
            last_message_is_from_me: false,
            unread_count: 2,
          },
        ],
        error: null,
      }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ count: 2, error: null }),
          }),
        }),
      }),
    };

    (createClient as any).mockResolvedValue(client);

    const response = await threadsGET(
      makeRequest("GET", "/api/messages/threads?limit=1")
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.unread_count).toBe(2);
    expect(json.threads[0].counterpart_username).toBe("alice");
  });
});

describe("GET /api/messages", () => {
  it("returns a conversation for a visible user", async () => {
    const authClient: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    };
    const serviceClient: Record<string, any> = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((field: string, value: string) => {
                if (field === "username" && value === "alice") {
                  return {
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: "user-2",
                        username: "alice",
                        avatar_url: null,
                        display_name: "Alice",
                        is_public: true,
                      },
                      error: null,
                    }),
                  };
                }
                if (field === "id" && value === "user-1") {
                  return {
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: "user-1",
                        username: "bob",
                        avatar_url: null,
                        display_name: "Bob",
                      },
                      error: null,
                    }),
                  };
                }
                return {
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                };
              }),
            }),
          };
        }

        if (table === "direct_messages") {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "m-2",
                        sender_id: "user-2",
                        recipient_id: "user-1",
                        content: "Want to compare import notes?",
                        read_at: null,
                        created_at: "2026-03-06T12:00:00.000Z",
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    (createClient as any).mockResolvedValue(authClient);
    (getServiceClient as any).mockReturnValue(serviceClient);

    const response = await conversationGET(
      makeRequest("GET", "/api/messages?with=alice")
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.counterpart.username).toBe("alice");
    expect(json.current_user_id).toBe("user-1");
    expect(json.has_more).toBe(false);
    expect(json.messages[0].sender.username).toBe("alice");
  });
});

describe("POST /api/messages", () => {
  it("creates a direct message, notification, and email", async () => {
    const authClient: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "user-1",
                    username: "bob",
                    avatar_url: null,
                    display_name: "Bob",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "direct_messages") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "m-1",
                    sender_id: "user-1",
                    recipient_id: "user-2",
                    content: "Hey Alice",
                    read_at: null,
                    created_at: "2026-03-06T12:00:00.000Z",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "notifications") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const serviceClient: Record<string, any> = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((field: string, value: string) => {
                if (field === "username" && value === "alice") {
                  return {
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: "user-2",
                        username: "alice",
                        avatar_url: null,
                        display_name: "Alice",
                        is_public: true,
                      },
                      error: null,
                    }),
                  };
                }
                if (field === "id" && value === "user-2") {
                  return {
                    single: vi.fn().mockResolvedValue({
                      data: { email_dm_notifications: true },
                      error: null,
                    }),
                  };
                }
                throw new Error(`Unexpected users lookup ${field}:${value}`);
              }),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { email: "alice@example.com" } },
            error: null,
          }),
        },
      },
    };

    (createClient as any).mockResolvedValue(authClient);
    (getServiceClient as any).mockReturnValue(serviceClient);

    const response = await messagePOST(
      makeRequest("POST", "/api/messages", {
        recipientUsername: "alice",
        content: "Hey Alice",
      })
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.recipient.username).toBe("alice");
    expect(sendDirectMessageEmail).toHaveBeenCalledWith({
      recipientUserId: "user-2",
      recipientEmail: "alice@example.com",
      actorUsername: "bob",
      content: "Hey Alice",
      idempotencyKey: "dm-notif/m-1",
    });
  });

  it("rejects messaging yourself", async () => {
    const authClient: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    };

    const serviceClient: Record<string, any> = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "user-1",
                    username: "bob",
                    avatar_url: null,
                    display_name: "Bob",
                    is_public: true,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    (createClient as any).mockResolvedValue(authClient);
    (getServiceClient as any).mockReturnValue(serviceClient);

    const response = await messagePOST(
      makeRequest("POST", "/api/messages", {
        recipientUsername: "bob",
        content: "Hello me",
      })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Cannot message yourself");
  });

  it("rejects attachment payloads that do not come from Straude-managed storage", async () => {
    const authClient: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    };

    (createClient as any).mockResolvedValue(authClient);

    const response = await messagePOST(
      makeRequest("POST", "/api/messages", {
        recipientUsername: "alice",
        attachments: [
          {
            url: "https://evil.example.com/track.png",
            name: "track.png",
            type: "image/png",
            size: 123,
          },
        ],
      })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Straude-managed DM storage uploads");
  });

  it("rejects attachment paths owned by another user", async () => {
    const authClient: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    };

    (createClient as any).mockResolvedValue(authClient);

    const response = await messagePOST(
      makeRequest("POST", "/api/messages", {
        recipientUsername: "alice",
        attachments: [
          {
            bucket: "dm-attachments",
            path: "user-2/file.png",
            name: "file.png",
            type: "image/png",
            size: 123,
          },
        ],
      })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Attachments must belong to the sending user");
  });
});

describe("message attachments", () => {
  it("returns signed URLs for stored DM attachments", async () => {
    const authClient: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    };
    const serviceClient: Record<string, any> = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((field: string, value: string) => {
                if (field === "username" && value === "alice") {
                  return {
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: "user-2",
                        username: "alice",
                        avatar_url: null,
                        display_name: "Alice",
                        is_public: true,
                      },
                      error: null,
                    }),
                  };
                }
                if (field === "id" && value === "user-1") {
                  return {
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: "user-1",
                        username: "bob",
                        avatar_url: null,
                        display_name: "Bob",
                      },
                      error: null,
                    }),
                  };
                }
                throw new Error(`Unexpected users lookup ${field}:${value}`);
              }),
            }),
          };
        }

        if (table === "direct_messages") {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "m-2",
                        sender_id: "user-2",
                        recipient_id: "user-1",
                        content: null,
                        attachments: [
                          {
                            bucket: "dm-attachments",
                            path: "user-2/file.png",
                            name: "file.png",
                            type: "image/png",
                            size: 123,
                          },
                        ],
                        read_at: null,
                        created_at: "2026-03-06T12:00:00.000Z",
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: "https://example.supabase.co/storage/v1/object/sign/dm-attachments/user-2/file.png?token=abc" },
            error: null,
          }),
        }),
      },
    };

    (createClient as any).mockResolvedValue(authClient);
    (getServiceClient as any).mockReturnValue(serviceClient);

    const response = await conversationGET(
      makeRequest("GET", "/api/messages?with=alice")
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.messages[0].attachments[0].url).toContain("/storage/v1/object/sign/dm-attachments/");
  });

  it("does not sign attachments that do not belong to the message sender", async () => {
    const authClient: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    };
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://example.supabase.co/storage/v1/object/sign/dm-attachments/user-2/file.png?token=abc" },
      error: null,
    });
    const serviceClient: Record<string, any> = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((field: string, value: string) => {
                if (field === "username" && value === "alice") {
                  return {
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: "user-2",
                        username: "alice",
                        avatar_url: null,
                        display_name: "Alice",
                        is_public: true,
                      },
                      error: null,
                    }),
                  };
                }
                if (field === "id" && value === "user-1") {
                  return {
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: "user-1",
                        username: "bob",
                        avatar_url: null,
                        display_name: "Bob",
                      },
                      error: null,
                    }),
                  };
                }
                throw new Error(`Unexpected users lookup ${field}:${value}`);
              }),
            }),
          };
        }

        if (table === "direct_messages") {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "m-2",
                        sender_id: "user-2",
                        recipient_id: "user-1",
                        content: null,
                        attachments: [
                          {
                            bucket: "dm-attachments",
                            path: "user-3/file.png",
                            name: "file.png",
                            type: "image/png",
                            size: 123,
                          },
                        ],
                        read_at: null,
                        created_at: "2026-03-06T12:00:00.000Z",
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrl,
        }),
      },
    };

    (createClient as any).mockResolvedValue(authClient);
    (getServiceClient as any).mockReturnValue(serviceClient);

    const response = await conversationGET(
      makeRequest("GET", "/api/messages?with=alice")
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.messages[0].attachments).toEqual([]);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/messages", () => {
  it("marks a conversation as read", async () => {
    const updateMessages = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });
    const updateNotifications = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      }),
    });

    const authClient: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "direct_messages") {
          return { update: updateMessages };
        }
        if (table === "notifications") {
          return { update: updateNotifications };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const serviceClient: Record<string, any> = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "user-2",
                    username: "alice",
                    avatar_url: null,
                    display_name: "Alice",
                    is_public: true,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    (createClient as any).mockResolvedValue(authClient);
    (getServiceClient as any).mockReturnValue(serviceClient);

    const response = await messagePATCH(
      makeRequest("PATCH", "/api/messages", { with: "alice" })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });
});
