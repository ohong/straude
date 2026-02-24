import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/email/resend", () => ({
  getResend: vi.fn(),
}));

vi.mock("@/lib/email/unsubscribe", () => ({
  createUnsubscribeToken: vi.fn().mockReturnValue("mock-token"),
}));

// Mock React Email's render so we don't need full JSX in tests
vi.mock("@react-email/components", async () => {
  const actual = await vi.importActual("@react-email/components");
  return actual;
});

import { sendNotificationEmail } from "@/lib/email/send-comment-email";
import { getResend } from "@/lib/email/resend";
import { createUnsubscribeToken } from "@/lib/email/unsubscribe";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://straude.com");
  vi.stubEnv("RESEND_FROM_EMAIL", "notifications@straude.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const baseParams = {
  recipientUserId: "owner-1",
  recipientEmail: "owner@test.com",
  actorUsername: "alice",
  type: "comment" as const,
  content: "Great post!",
  postId: "post-1",
  postTitle: "My Day",
  idempotencyKey: "comment-notif/c1",
};

describe("sendNotificationEmail", () => {
  it("sends email with correct params", async () => {
    const mockSend = vi.fn().mockResolvedValue({ id: "email-1" });
    (getResend as any).mockReturnValue({ emails: { send: mockSend } });

    await sendNotificationEmail(baseParams);

    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0][0];
    expect(call.from).toBe("Straude <notifications@straude.com>");
    expect(call.replyTo).toBe("hey@straude.com");
    expect(call.to).toBe("owner@test.com");
    expect(call.subject).toBe("alice commented on your post");
    expect(call.react).toBeDefined();
    expect(call.headers["Idempotency-Key"]).toBe("comment-notif/c1");
    expect(call.headers["List-Unsubscribe"]).toContain("mock-token");
    expect(call.tags).toEqual([
      { name: "type", value: "comment" },
      { name: "post_id", value: "post-1" },
    ]);
  });

  it("sends mention email with correct subject", async () => {
    const mockSend = vi.fn().mockResolvedValue({ id: "email-m1" });
    (getResend as any).mockReturnValue({ emails: { send: mockSend } });

    await sendNotificationEmail({
      ...baseParams,
      type: "mention",
      idempotencyKey: "mention-notif/c1/u2",
    });

    const call = mockSend.mock.calls[0][0];
    expect(call.subject).toBe("alice mentioned you in a comment");
    expect(call.tags[0]).toEqual({ name: "type", value: "mention" });
  });

  it("sends post_mention email with correct subject", async () => {
    const mockSend = vi.fn().mockResolvedValue({ id: "email-pm1" });
    (getResend as any).mockReturnValue({ emails: { send: mockSend } });

    await sendNotificationEmail({
      ...baseParams,
      type: "post_mention",
      idempotencyKey: "mention-post/p1/u2",
    });

    const call = mockSend.mock.calls[0][0];
    expect(call.subject).toBe("alice tagged you in a post");
    expect(call.tags[0]).toEqual({ name: "type", value: "post_mention" });
  });

  it("skips sending when Resend is not configured", async () => {
    (getResend as any).mockReturnValue(null);

    await sendNotificationEmail(baseParams);

    expect(getResend).toHaveBeenCalled();
  });

  it("creates unsubscribe token for the recipient", async () => {
    const mockSend = vi.fn().mockResolvedValue({ id: "email-5" });
    (getResend as any).mockReturnValue({ emails: { send: mockSend } });

    await sendNotificationEmail({
      ...baseParams,
      recipientUserId: "owner-xyz",
    });

    expect(createUnsubscribeToken).toHaveBeenCalledWith("owner-xyz");
  });

  it("passes idempotency key in headers", async () => {
    const mockSend = vi.fn().mockResolvedValue({ id: "email-6" });
    (getResend as any).mockReturnValue({ emails: { send: mockSend } });

    await sendNotificationEmail({
      ...baseParams,
      idempotencyKey: "comment-notif/abc-123",
    });

    expect(mockSend.mock.calls[0][0].headers["Idempotency-Key"]).toBe(
      "comment-notif/abc-123",
    );
  });
});
