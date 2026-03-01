import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { mockCreateClient, mockGetServiceClient, mockSendNotificationEmail } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockGetServiceClient: vi.fn(),
  mockSendNotificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: mockGetServiceClient,
}));

vi.mock("@/lib/email/send-comment-email", () => ({
  sendNotificationEmail: mockSendNotificationEmail,
}));

vi.mock("@/lib/achievements", () => ({
  checkAndAwardAchievements: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/posts/[id]/comments/route";

function makeRequest(content: string) {
  return new NextRequest(new URL("http://localhost/api/posts/post-1/comments"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeSessionClient(commenterId: string, postOwnerId: string) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: commenterId } },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "comments") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "comment-1",
                  content: "Nice post",
                  user: { id: commenterId, username: "alexesprit" },
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "posts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { user_id: postOwnerId },
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

      if (table === "users") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }

      return {};
    }),
  };
}

function makeServiceClient({ emailNotifications }: { emailNotifications: boolean }) {
  const usersChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { email_notifications: emailNotifications },
      error: null,
    }),
  };

  const postsChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { title: "Some post" }, error: null }),
  };

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "users") return usersChain;
      if (table === "posts") return postsChain;
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({
          data: { user: { email: "owner@test.com" } },
          error: null,
        }),
      },
    },
  };
}

async function flushAsyncWork() {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("comment email notifications", () => {
  it("sends an email to post owner when comment emails are enabled", async () => {
    mockCreateClient.mockResolvedValue(makeSessionClient("commenter-1", "owner-1"));
    mockGetServiceClient.mockReturnValue(
      makeServiceClient({ emailNotifications: true })
    );

    const res = await POST(makeRequest("Looks great"), makeContext("post-1"));

    expect(res.status).toBe(201);
    await flushAsyncWork();

    expect(mockSendNotificationEmail).toHaveBeenCalledTimes(1);
    expect(mockSendNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: "owner-1",
        recipientEmail: "owner@test.com",
        type: "comment",
        postId: "post-1",
        idempotencyKey: "comment-notif/comment-1",
      })
    );
  });

  it("does not send email when comment emails are disabled", async () => {
    mockCreateClient.mockResolvedValue(makeSessionClient("commenter-1", "owner-1"));
    mockGetServiceClient.mockReturnValue(
      makeServiceClient({ emailNotifications: false })
    );

    const res = await POST(makeRequest("Looks great"), makeContext("post-1"));

    expect(res.status).toBe(201);
    await flushAsyncWork();

    expect(mockSendNotificationEmail).not.toHaveBeenCalled();
  });
});
