import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from "@/lib/email/unsubscribe";

const TEST_SECRET = "test-unsubscribe-secret";

describe("unsubscribe tokens", () => {
  beforeEach(() => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", TEST_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("createUnsubscribeToken", () => {
    it("generates a payload.signature format", () => {
      const token = createUnsubscribeToken("user-123");
      const parts = token.split(".");
      expect(parts).toHaveLength(2);
      for (const part of parts) {
        expect(part.length).toBeGreaterThan(0);
        expect(part).toMatch(/^[A-Za-z0-9_-]+$/);
      }
    });

    it("throws when UNSUBSCRIBE_SECRET is not configured", () => {
      delete process.env.UNSUBSCRIBE_SECRET;
      expect(() => createUnsubscribeToken("user-123")).toThrow(
        "UNSUBSCRIBE_SECRET not configured"
      );
    });

    it("produces different tokens for different users", () => {
      const t1 = createUnsubscribeToken("user-1");
      const t2 = createUnsubscribeToken("user-2");
      expect(t1).not.toBe(t2);
    });

    it("produces the same token for the same user (deterministic)", () => {
      const t1 = createUnsubscribeToken("user-1");
      const t2 = createUnsubscribeToken("user-1");
      expect(t1).toBe(t2);
    });
  });

  describe("verifyUnsubscribeToken", () => {
    it("validates a token it created", () => {
      const token = createUnsubscribeToken("user-456");
      const result = verifyUnsubscribeToken(token);
      expect(result).toBe("user-456");
    });

    it("works with UUID user IDs", () => {
      const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const token = createUnsubscribeToken(uuid);
      expect(verifyUnsubscribeToken(token)).toBe(uuid);
    });

    it("rejects tampered tokens", () => {
      const token = createUnsubscribeToken("user-456");
      const tampered = token + "abc";
      expect(verifyUnsubscribeToken(tampered)).toBeNull();
    });

    it("rejects tokens with modified payload", () => {
      const token = createUnsubscribeToken("user-456");
      const parts = token.split(".");
      // Replace payload with a different user
      const fakePayload = Buffer.from("user-789", "utf-8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const tampered = `${fakePayload}.${parts[1]}`;
      expect(verifyUnsubscribeToken(tampered)).toBeNull();
    });

    it("rejects malformed tokens (no dot)", () => {
      expect(verifyUnsubscribeToken("justapayload")).toBeNull();
    });

    it("rejects tokens with too many parts", () => {
      expect(verifyUnsubscribeToken("a.b.c")).toBeNull();
    });

    it("rejects empty string", () => {
      expect(verifyUnsubscribeToken("")).toBeNull();
    });

    it("returns null when UNSUBSCRIBE_SECRET is not set", () => {
      const token = createUnsubscribeToken("user-123");
      delete process.env.UNSUBSCRIBE_SECRET;
      expect(verifyUnsubscribeToken(token)).toBeNull();
    });
  });
});
