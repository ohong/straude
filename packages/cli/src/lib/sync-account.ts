import { createHash } from "node:crypto";

/** Local ownership only; the server still verifies the token signature. */
export function syncAccountKey(config: { token: string; api_url: string }): string {
  let subject = `token:${config.token}`;
  try {
    const payload: unknown = JSON.parse(Buffer.from(config.token.split(".")[1] ?? "", "base64url").toString("utf8"));
    if (payload && typeof payload === "object" && "sub" in payload
      && typeof payload.sub === "string" && payload.sub.length > 0) {
      subject = `user:${payload.sub}`;
    }
  } catch {
    // Unknown token formats stay bound to that exact credential, never a name.
  }
  return createHash("sha256").update(JSON.stringify([
    new URL(config.api_url).origin, subject,
  ])).digest("hex");
}
