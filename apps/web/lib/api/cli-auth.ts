import { createHmac, timingSafeEqual } from "node:crypto";

interface JwtPayload {
  sub: string;
  username?: string;
  iat: number;
  exp: number;
}

function base64urlEncode(data: string): string {
  return Buffer.from(data, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str: string): string {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function sign(header: string, payload: string, secret: string): string {
  const input = `${header}.${payload}`;
  return createHmac("sha256", secret)
    .update(input)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Create a signed JWT for CLI authentication.
 */
export function createCliToken(userId: string, username: string | null): string {
  const secret = process.env.CLI_JWT_SECRET;
  if (!secret) throw new Error("CLI_JWT_SECRET not configured");

  const header = base64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64urlEncode(
    JSON.stringify({
      sub: userId,
      username: username ?? undefined,
      iat: now,
      exp: now + 30 * 24 * 60 * 60, // 30 days
    }),
  );
  const signature = sign(header, payload, secret);
  return `${header}.${payload}.${signature}`;
}

/**
 * Verify a CLI JWT from the Authorization header.
 * Returns the user_id (sub) if valid, null otherwise.
 */
export function verifyCliToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const secret = process.env.CLI_JWT_SECRET;
  if (!secret) return null;

  const token = authHeader.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts as [string, string, string];

  // Verify signature
  const expectedSig = sign(header, payload, secret);
  const sigBuf = Buffer.from(signature, "utf-8");
  const expectedBuf = Buffer.from(expectedSig, "utf-8");
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  // Decode and check expiry
  let decoded: JwtPayload;
  try {
    decoded = JSON.parse(base64urlDecode(payload));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!decoded.sub || !decoded.exp || decoded.exp < now) {
    return null;
  }

  return decoded.sub;
}
