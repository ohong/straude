import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TeamBadge } from "@/components/app/shared/TeamBadge";

afterEach(cleanup);

describe("team badge", () => {
  it.each(["svg", "png"])("renders prepared %s directly with contain proportions", (format) => {
    const url = `https://example.supabase.co/storage/v1/object/public/team-favicons/example.com.${format}`;
    render(<TeamBadge url="https://example.com" faviconUrl={url} size="md" />);
    const image = screen.getByRole("img");
    expect(image).toHaveAttribute("src", url);
    expect(image).toHaveStyle({ width: "18px", height: "18px", objectFit: "contain" });
    expect(image).not.toHaveAttribute("srcset");
    expect(screen.getByRole("link")).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("falls back for a failed image and retries when the saved favicon changes", () => {
    const { rerender } = render(<TeamBadge url="https://example.com" faviconUrl="https://example.com/old.png" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).toBeNull();
    rerender(<TeamBadge url="https://example.com" faviconUrl="https://example.com/new.svg" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/new.svg");
  });
});
