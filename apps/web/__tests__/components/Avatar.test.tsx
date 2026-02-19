import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "@/components/ui/Avatar";

describe("Avatar", () => {
  it("renders image when src is provided", () => {
    render(<Avatar src="https://example.com/avatar.png" alt="User" />);
    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    // next/image rewrites src to /_next/image?url=... in jsdom
    expect(img.getAttribute("src")).toContain("avatar.png");
  });

  it("sets unoptimized for SVG sources", () => {
    const { container } = render(
      <Avatar src="https://api.dicebear.com/9.x/notionists/svg?seed=test" alt="SVG avatar" />,
    );
    const img = container.querySelector("img")!;
    // When unoptimized, next/image renders the raw src
    expect(img.getAttribute("src")).toBe(
      "https://api.dicebear.com/9.x/notionists/svg?seed=test"
    );
  });

  it("shows fallback initials when no src", () => {
    render(<Avatar fallback="Alice Bob" />);
    expect(screen.getByText("AB")).toBeInTheDocument();
  });

  it("shows ? when no src and no fallback", () => {
    render(<Avatar />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("renders correct dimensions for each size", () => {
    const sizes = {
      xs: 24,
      sm: 32,
      md: 40,
      lg: 80,
      xl: 120,
    } as const;

    for (const [size, px] of Object.entries(sizes)) {
      const { container } = render(
        <Avatar
          src="https://example.com/avatar.png"
          size={size as keyof typeof sizes}
          alt={`size-${size}`}
        />,
      );
      const img = container.querySelector("img")!;
      expect(img.style.width).toBe(`${px}px`);
      expect(img.style.height).toBe(`${px}px`);
    }
  });

  it("renders correct dimensions for fallback", () => {
    const { container } = render(<Avatar fallback="A" size="lg" />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.width).toBe("80px");
    expect(div.style.height).toBe("80px");
  });

  it("applies custom className", () => {
    render(<Avatar className="my-class" fallback="A" />);
    const el = screen.getByText("A").closest("div")!;
    expect(el.className).toContain("my-class");
  });
});
