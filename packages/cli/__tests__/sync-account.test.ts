import { describe, expect, it } from "vitest";
import { syncAccountKey } from "../src/lib/sync-account.js";

function token(sub: string, iat = 1) {
  return `header.${Buffer.from(JSON.stringify({ sub, iat })).toString("base64url")}.signature`;
}

describe("durable sync ownership", () => {
  it("survives token refresh and separates account and API origin", () => {
    const base = { token: token("alice"), api_url: "https://straude.com" };
    expect(syncAccountKey(base)).toBe(syncAccountKey({ ...base, token: token("alice", 2) }));
    expect(syncAccountKey(base)).not.toBe(syncAccountKey({ ...base, token: token("bob") }));
    expect(syncAccountKey(base)).not.toBe(syncAccountKey({ ...base, api_url: "https://staging.straude.com" }));
  });
  it("binds unknown token formats to the exact credential without persisting it", () => {
    const key = syncAccountKey({ token: "opaque-secret", api_url: "https://straude.com" });
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain("opaque-secret");
    expect(key).not.toBe(syncAccountKey({ token: "other-secret", api_url: "https://straude.com" }));
  });
});
