import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/email/unsubscribe", () => ({
  verifyUnsubscribeToken: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(),
}));

import { GET } from "@/app/api/unsubscribe/route";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { getServiceClient } from "@/lib/supabase/service";
import { NextRequest } from "next/server";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://straude.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost"), { method: "GET" });
}

describe("GET /api/unsubscribe", () => {
  it("unsubscribes with valid token", async () => {
    (verifyUnsubscribeToken as any).mockReturnValue("user-123");

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    (getServiceClient as any).mockReturnValue({
      from: vi.fn().mockReturnValue({ update: mockUpdate }),
    });

    const res = await GET(makeRequest("/api/unsubscribe?token=valid-token"));

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Unsubscribed");
    expect(html).toContain("no longer receive email notifications");
    expect(html).toContain("/settings");

    expect(verifyUnsubscribeToken).toHaveBeenCalledWith("valid-token");
    expect(mockUpdate).toHaveBeenCalledWith({ email_notifications: false });
  });

  it("returns 400 when token is missing", async () => {
    const res = await GET(makeRequest("/api/unsubscribe"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Missing token");
  });

  it("returns 400 when token is invalid", async () => {
    (verifyUnsubscribeToken as any).mockReturnValue(null);

    const res = await GET(makeRequest("/api/unsubscribe?token=bad-token"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid token");
  });
});
