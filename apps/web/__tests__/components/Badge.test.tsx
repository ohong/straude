import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/Badge";

describe("Badge", () => {
  it("renders default variant", () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText("Default");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-subtle");
  });

  it("renders accent variant", () => {
    render(<Badge variant="accent">Accent</Badge>);
    const badge = screen.getByText("Accent");
    expect(badge.className).toContain("bg-accent");
  });

  it("rank-1 has gold gradient classes", () => {
    render(<Badge variant="rank-1">#1</Badge>);
    const badge = screen.getByText("#1");
    expect(badge.className).toContain("from-[#FFD700]");
    expect(badge.className).toContain("to-[#FFA500]");
  });

  it("rank-2 has silver gradient classes", () => {
    render(<Badge variant="rank-2">#2</Badge>);
    const badge = screen.getByText("#2");
    expect(badge.className).toContain("from-[#E8E8E8]");
    expect(badge.className).toContain("to-[#C0C0C0]");
  });

  it("rank-3 has bronze gradient classes", () => {
    render(<Badge variant="rank-3">#3</Badge>);
    const badge = screen.getByText("#3");
    expect(badge.className).toContain("from-[#DDA15E]");
    expect(badge.className).toContain("to-[#BC6C25]");
  });

  it("verified variant has text-accent", () => {
    render(<Badge variant="verified">Verified</Badge>);
    const badge = screen.getByText("Verified");
    expect(badge.className).toContain("text-accent");
  });

  it("accepts custom className", () => {
    render(<Badge className="custom-badge">Custom</Badge>);
    const badge = screen.getByText("Custom");
    expect(badge.className).toContain("custom-badge");
  });
});
