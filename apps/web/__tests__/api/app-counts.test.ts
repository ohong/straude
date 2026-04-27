import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { GET } from "@/app/api/app/counts/route";
import { createClient } from "@/lib/supabase/server";

const createClientMock = vi.mocked(createClient);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/app/counts", () => {
  it("returns 401 for unauthenticated users", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns notification and message unread counts", async () => {
    const notificationsResult = { count: 3, error: null };
    const messagesResult = { count: 2, error: null };
    const notificationReadEq = vi.fn().mockReturnValue({
      neq: vi.fn().mockResolvedValue(notificationsResult),
    });
    const notificationUserEq = vi.fn().mockReturnValue({
      eq: notificationReadEq,
    });
    const messageRecipientEq = vi.fn().mockReturnValue({
      is: vi.fn().mockResolvedValue(messagesResult),
    });

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "notifications") {
          return {
            select: vi.fn().mockReturnValue({
              eq: notificationUserEq,
            }),
          };
        }

        if (table === "direct_messages") {
          return {
            select: vi.fn().mockReturnValue({
              eq: messageRecipientEq,
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    createClientMock.mockResolvedValue(
      client as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      notification_unread_count: 3,
      message_unread_count: 2,
    });
    expect(client.from).toHaveBeenCalledWith("notifications");
    expect(client.from).toHaveBeenCalledWith("direct_messages");
    expect(notificationUserEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(notificationReadEq).toHaveBeenCalledWith("read", false);
    expect(messageRecipientEq).toHaveBeenCalledWith("recipient_id", "user-1");
  });
});
