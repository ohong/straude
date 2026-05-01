import { describe, expect, it } from "vitest";
import { buildInviteUrl, buildShareMoment } from "@/lib/share-moments";
import { buildPostShareText } from "@/lib/utils/post-share";

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    title: null,
    images: [],
    user: { username: "alice" },
    kudos_count: 0,
    comment_count: 0,
    daily_usage: {
      cost_usd: 12.5,
      output_tokens: 3400,
      models: ["claude-opus-4-20250505"],
      is_verified: true,
    },
    ...overrides,
  };
}

describe("buildShareMoment", () => {
  it("turns seven-figure output into a shareable progress moment", () => {
    const moment = buildShareMoment(
      makePost({
        daily_usage: {
          cost_usd: 88,
          output_tokens: 1_200_000,
          models: ["claude-sonnet-4-20250514"],
          is_verified: true,
        },
      }) as any
    );

    expect(moment.label).toBe("Output PR");
    expect(moment.headline).toBe("1.2M output shipped");
    expect(moment.inviteText).toMatch(/outship/i);
  });

  it("prefers proof screenshots when the session is otherwise routine", () => {
    const moment = buildShareMoment(
      makePost({
        images: ["https://example.com/one.png", "https://example.com/two.png"],
      }) as any
    );

    expect(moment.label).toBe("Receipts Attached");
    expect(moment.headline).toContain("2 screenshots");
  });
});

describe("share copy", () => {
  it("adds the invite challenge to generated social text", () => {
    const text = buildPostShareText(makePost() as any);

    expect(text).toContain("Share this build log with a peer.");
    expect(text).toContain("Tracked on Straude by @alice");
  });

  it("builds referral-style invite URLs from the sharing user", () => {
    expect(buildInviteUrl("https://straude.com", "alice")).toBe(
      "https://straude.com/join/alice"
    );
  });
});
