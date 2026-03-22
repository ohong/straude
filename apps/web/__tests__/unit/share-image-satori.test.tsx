import { describe, it, expect } from "vitest";
import type { ReactElement } from "react";

type SatoriNode = ReactElement<{ children?: React.ReactNode; style?: React.CSSProperties }>;
import { ShareCardImage } from "@/lib/utils/share-image";

const SAMPLE_POST = {
  title: "Morning refactor",
  description: "Cleaned up the auth layer and tightened the share flow.",
  images: [],
  username: "alice",
  avatar_url: null,
  cost_usd: 12.5,
  input_tokens: 1200,
  output_tokens: 3400,
  models: ["claude-opus-4-20250505"],
  is_verified: true,
};

function assertSatoriDisplayFlex(node: SatoriNode, path = "root"): void {
  if (!node || typeof node !== "object") return;

  const { type, props } = node;
  if (type === "div" && props?.children) {
    const children = Array.isArray(props.children)
      ? props.children.filter(
          (child: unknown) =>
            child !== null && child !== undefined && child !== false && child !== ""
        )
      : [props.children];

    if (children.length > 1) {
      const display = props.style?.display;
      expect(
        display === "flex" || display === "none",
        `<div> at ${path} has ${children.length} children but display is "${display ?? "unset"}"`
      ).toBe(true);
    }
  }

  if (props?.children) {
    const children = Array.isArray(props.children)
      ? props.children
      : [props.children];
    children.forEach((child: unknown, index: number) => {
      if (child && typeof child === "object" && "type" in (child as object)) {
        assertSatoriDisplayFlex(
          child as SatoriNode,
          `${path} > ${String((child as SatoriNode).type)}[${index}]`
        );
      }
    });
  }
}

describe("ShareCardImage Satori compatibility", () => {
  it("all multi-child divs use flex layout", () => {
    const element = ShareCardImage({
      post: SAMPLE_POST,
      themeId: "accent",
    });

    assertSatoriDisplayFlex(element as SatoriNode);
  });
});
