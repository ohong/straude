import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShareMenu } from "@/components/app/feed/ShareMenu";

vi.mock("@/lib/utils/share-image", () => ({
  ShareCardImage: () => <div>Preview card</div>,
}));

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    user_id: "user-1",
    daily_usage_id: "usage-1",
    title: "Morning refactor",
    description: "Cleaned up the auth layer and merged the dashboard polish.",
    images: ["https://example.com/one.png"],
    created_at: "2026-03-01T12:00:00.000Z",
    updated_at: "2026-03-01T12:00:00.000Z",
    user: {
      username: "alice",
      avatar_url: null,
    },
    daily_usage: {
      cost_usd: 12.5,
      input_tokens: 1200,
      output_tokens: 3400,
      models: ["claude-opus-4-20250505"],
      is_verified: true,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window.navigator, "share", {
    value: undefined,
    configurable: true,
  });
  Object.defineProperty(window.navigator, "canShare", {
    value: undefined,
    configurable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ShareMenu", () => {
  it("shows a native share action when navigator.share is available", () => {
    Object.defineProperty(window.navigator, "share", {
      value: vi.fn(),
      configurable: true,
    });

    render(<ShareMenu post={makePost() as any} />);
    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    expect(
      screen.getByRole("button", { name: /share to apps/i })
    ).toBeInTheDocument();
  });

  it("opens an X composer with the post URL", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<ShareMenu post={makePost() as any} />);
    fireEvent.click(screen.getByRole("button", { name: /share/i }));
    fireEvent.click(screen.getByRole("button", { name: /post to x/i }));

    expect(openSpy).toHaveBeenCalledTimes(1);

    const openedUrl = new URL(openSpy.mock.calls[0]![0] as string);
    expect(openedUrl.origin).toBe("https://twitter.com");
    expect(openedUrl.pathname).toBe("/intent/tweet");
    expect(openedUrl.searchParams.get("url")).toContain("/post/post-1");
    expect(openedUrl.searchParams.get("text")).toContain("Share the receipts with a friend.");
  });

  it("shows a Strava-style share angle and copies the invite link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<ShareMenu post={makePost() as any} />);
    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    expect(screen.getByText("Receipts Attached")).toBeInTheDocument();
    expect(screen.getByText(/1 screenshot on the build log/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /share the receipts with a friend/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("http://localhost:3000/join/alice");
    });
  });

  it("shows an inline error when PNG generation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      })
    );

    render(<ShareMenu post={makePost() as any} />);
    fireEvent.click(screen.getByRole("button", { name: /share/i }));
    fireEvent.click(screen.getByRole("button", { name: /download png/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Could not generate the PNG share card.")
      ).toBeInTheDocument();
    });
  });
});
