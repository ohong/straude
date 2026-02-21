import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Create a signed unsubscribe token for a user.
 * Format: base64url(userId).hmac_signature
 */
export function createUnsubscribeToken(userId: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET not configured");

  const payload = Buffer.from(userId, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const sig = createHmac("sha256", secret)
    .update(userId)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${payload}.${sig}`;
}

/**
 * Verify an unsubscribe token. Returns userId if valid, null otherwise.
 */
export function verifyUnsubscribeToken(token: string): string | null {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, sig] = parts as [string, string];

  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  const userId = Buffer.from(
    padded.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  ).toString("utf-8");

  const expectedSig = createHmac("sha256", secret)
    .update(userId)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const sigBuf = Buffer.from(sig, "utf-8");
  const expectedBuf = Buffer.from(expectedSig, "utf-8");

  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  return userId;
}
