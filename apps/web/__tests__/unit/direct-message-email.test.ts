import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/email/resend", () => ({
  getResend: vi.fn(),
}));

vi.mock("@/lib/email/unsubscribe", () => ({
  createUnsubscribeToken: vi.fn().mockReturnValue("mock-token"),
}));

import { getResend } from "@/lib/email/resend";
import { createUnsubscribeToken } from "@/lib/email/unsubscribe";
import { sendDirectMessageEmail } from "@/lib/email/send-direct-message-email";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://straude.com");
  vi.stubEnv("RESEND_FROM_EMAIL", "notifications@straude.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sendDirectMessageEmail", () => {
  it("sends the DM email with the correct URLs and headers", async () => {
    const mockSend = vi.fn().mockResolvedValue({ id: "email-1" });
    (getResend as any).mockReturnValue({ emails: { send: mockSend } });

    await sendDirectMessageEmail({
      recipientUserId: "user-2",
      recipientEmail: "alice@example.com",
      actorUsername: "bob",
      content: "Hey Alice",
      idempotencyKey: "dm-notif/m-1",
    });

    expect(createUnsubscribeToken).toHaveBeenCalledWith("user-2");
    const call = mockSend.mock.calls[0][0];
    expect(call.subject).toBe("bob sent you a direct message");
    expect(call.to).toBe("alice@example.com");
    expect(call.headers["Idempotency-Key"]).toBe("dm-notif/m-1");
    expect(call.headers["List-Unsubscribe"]).toContain("kind=dm");
    expect(call.tags).toEqual([
      { name: "type", value: "direct_message" },
      { name: "actor", value: "bob" },
    ]);
  });

  it("skips sending when Resend is unavailable", async () => {
    (getResend as any).mockReturnValue(null);

    await sendDirectMessageEmail({
      recipientUserId: "user-2",
      recipientEmail: "alice@example.com",
      actorUsername: "bob",
      content: "Hey Alice",
      idempotencyKey: "dm-notif/m-1",
    });

    expect(getResend).toHaveBeenCalled();
  });
});
