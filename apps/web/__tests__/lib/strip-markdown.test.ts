import { describe, it, expect } from "vitest";
import { stripMarkdown } from "@/lib/utils/strip-markdown";

describe("stripMarkdown", () => {
  it("strips heading markers", () => {
    expect(stripMarkdown("# Hello World")).toBe("Hello World");
  });

  it("strips bold (**) markers", () => {
    expect(stripMarkdown("This is **bold** text")).toBe("This is bold text");
  });

  it("strips italic asterisk markers", () => {
    expect(stripMarkdown("This is *italic* text")).toBe("This is italic text");
  });

  it("strips italic underscore markers", () => {
    expect(stripMarkdown("This is _italic_ text")).toBe("This is italic text");
  });

  it("strips strikethrough markers", () => {
    expect(stripMarkdown("This is ~~struck~~ text")).toBe(
      "This is struck text",
    );
  });

  it("strips inline code markers", () => {
    expect(stripMarkdown("Use `code` here")).toBe("Use code here");
  });

  it("strips link syntax keeping the label", () => {
    expect(stripMarkdown("Visit [Straude](https://straude.com) today")).toBe(
      "Visit Straude today",
    );
  });

  it("strips image syntax (link rule consumes the body, leaving the bang)", () => {
    // The link rule runs before the image rule, so [alt](url) is captured
    // first — only the leading "!" survives. Locked in to preserve current
    // OG-card output byte-for-byte.
    expect(stripMarkdown("Look ![alt](https://x.com/img.png) here")).toBe(
      "Look !alt here",
    );
  });

  it("strips unordered list bullet markers", () => {
    expect(stripMarkdown("- first item")).toBe("first item");
  });

  it("strips ordered list markers", () => {
    expect(stripMarkdown("1. first item")).toBe("first item");
  });

  it("strips blockquote markers", () => {
    expect(stripMarkdown("> a quoted line")).toBe("a quoted line");
  });

  it("collapses double newlines to a single space", () => {
    expect(stripMarkdown("para one\n\npara two")).toBe("para one para two");
  });

  it("collapses single newlines to a single space", () => {
    expect(stripMarkdown("line one\nline two")).toBe("line one line two");
  });
});
