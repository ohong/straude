import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createCliToken, verifyCliToken } from "@/lib/api/cli-auth";

const TEST_SECRET = "test-secret-key-for-jwt";

describe("cli-auth", () => {
  beforeEach(() => {
    vi.stubEnv("CLI_JWT_SECRET", TEST_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("createCliToken", () => {
    it("generates a valid JWT structure (header.payload.signature)", () => {
      const token = createCliToken("user-123", "testuser");
      const parts = token.split(".");
      expect(parts).toHaveLength(3);
      // Each part should be non-empty base64url
      for (const part of parts) {
        expect(part.length).toBeGreaterThan(0);
        expect(part).toMatch(/^[A-Za-z0-9_-]+$/);
      }
    });

    it("contains correct payload fields", () => {
      const before = Math.floor(Date.now() / 1000);
      const token = createCliToken("user-123", "testuser");
      const after = Math.floor(Date.now() / 1000);

      const payloadB64 = token.split(".")[1]!;
      const padded =
        payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
      const payload = JSON.parse(
        Buffer.from(
          padded.replace(/-/g, "+").replace(/_/g, "/"),
          "base64",
        ).toString("utf-8"),
      );

      expect(payload.sub).toBe("user-123");
      expect(payload.username).toBe("testuser");
      expect(payload.iat).toBeGreaterThanOrEqual(before);
      expect(payload.iat).toBeLessThanOrEqual(after);
      expect(payload.exp).toBe(payload.iat + 30 * 24 * 60 * 60);
    });

    it("omits username when null", () => {
      const token = createCliToken("user-123", null);
      const payloadB64 = token.split(".")[1]!;
      const padded =
        payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
      const payload = JSON.parse(
        Buffer.from(
          padded.replace(/-/g, "+").replace(/_/g, "/"),
          "base64",
        ).toString("utf-8"),
      );

      expect(payload.username).toBeUndefined();
    });

    it("throws when CLI_JWT_SECRET is not configured", () => {
      vi.stubEnv("CLI_JWT_SECRET", "");
      // Remove the env var entirely
      delete process.env.CLI_JWT_SECRET;
      expect(() => createCliToken("user-123", "test")).toThrow(
        "CLI_JWT_SECRET not configured",
      );
    });
  });

  describe("verifyCliToken", () => {
    it("validates a token it created", () => {
      const token = createCliToken("user-456", "alice");
      const result = verifyCliToken(`Bearer ${token}`);
      expect(result).toBe("user-456");
    });

    it("rejects tampered tokens", () => {
      const token = createCliToken("user-456", "alice");
      const parts = token.split(".");
      // Tamper with the payload
      const tampered = `${parts[0]}.${parts[1]}abc.${parts[2]}`;
      expect(verifyCliToken(`Bearer ${tampered}`)).toBeNull();
    });

    it("rejects expired tokens", () => {
      // Create a token, then manually build one with exp in the past
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const now = Math.floor(Date.now() / 1000);
      const payload = Buffer.from(
        JSON.stringify({ sub: "user-789", iat: now - 7200, exp: now - 3600 }),
      )
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      // Sign manually using the same HMAC approach
      const { createHmac } = require("node:crypto");
      const sig = createHmac("sha256", TEST_SECRET)
        .update(`${header}.${payload}`)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const expiredToken = `${header}.${payload}.${sig}`;
      expect(verifyCliToken(`Bearer ${expiredToken}`)).toBeNull();
    });

    it("rejects malformed tokens (wrong number of parts)", () => {
      expect(verifyCliToken("Bearer abc.def")).toBeNull();
      expect(verifyCliToken("Bearer abc")).toBeNull();
      expect(verifyCliToken("Bearer a.b.c.d")).toBeNull();
    });

    it("rejects missing auth header", () => {
      expect(verifyCliToken(null)).toBeNull();
    });

    it("rejects empty auth header", () => {
      expect(verifyCliToken("")).toBeNull();
    });

    it("rejects auth header without Bearer prefix", () => {
      const token = createCliToken("user-123", "test");
      expect(verifyCliToken(token)).toBeNull();
    });

    it("returns null when CLI_JWT_SECRET is not set", () => {
      const token = createCliToken("user-123", "test");
      delete process.env.CLI_JWT_SECRET;
      expect(verifyCliToken(`Bearer ${token}`)).toBeNull();
    });
  });
});
