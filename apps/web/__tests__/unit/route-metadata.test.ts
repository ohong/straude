import { describe, expect, it } from "vitest";
import { metadata as feedMetadata } from "@/app/(app)/feed/page";
import { metadata as leaderboardMetadata } from "@/app/(app)/leaderboard/page";

function getFirstImageUrl(
  images: { url?: string | URL } | Array<{ url?: string | URL }> | undefined
) {
  if (!images) return undefined;
  const first = Array.isArray(images) ? images[0] : images;
  return first?.url?.toString();
}

describe("route metadata", () => {
  it("wires /feed to the shared og image", () => {
    expect(feedMetadata.alternates?.canonical).toBe("/feed");
    expect(feedMetadata.openGraph?.url).toBe("https://straude.com/feed");
    expect(getFirstImageUrl(feedMetadata.openGraph?.images as any)).toBe(
      "/og-image.png?v=2"
    );
    expect(feedMetadata.twitter?.card).toBe("summary_large_image");
    expect(getFirstImageUrl(feedMetadata.twitter?.images as any)).toBe(
      "/og-image.png?v=2"
    );
  });

  it("wires /leaderboard to the shared og image", () => {
    expect(leaderboardMetadata.alternates?.canonical).toBe("/leaderboard");
    expect(leaderboardMetadata.openGraph?.url).toBe(
      "https://straude.com/leaderboard"
    );
    expect(getFirstImageUrl(leaderboardMetadata.openGraph?.images as any)).toBe(
      "/og-image.png?v=2"
    );
    expect(leaderboardMetadata.twitter?.card).toBe("summary_large_image");
    expect(getFirstImageUrl(leaderboardMetadata.twitter?.images as any)).toBe(
      "/og-image.png?v=2"
    );
  });
});
