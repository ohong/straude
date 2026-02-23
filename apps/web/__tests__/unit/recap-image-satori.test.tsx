import { describe, it, expect } from "vitest";
import { RecapCardImage } from "@/lib/utils/recap-image";
import type { RecapData } from "@/lib/utils/recap";
import type { ReactElement } from "react";

const SAMPLE_DATA: RecapData = {
  total_cost: 47.87,
  output_tokens: 42300,
  active_days: 1,
  total_days: 7,
  session_count: 1,
  streak: 14,
  primary_model: "Claude Opus",
  contribution_data: [{ date: "2026-02-23", cost_usd: 47.87 }],
  period_label: "My Week in Claude Code · Feb 23–Mar 1, 2026",
  period: "week",
  username: "ohong",
  is_public: true,
};

/**
 * Recursively walk a React element tree and verify that every <div>
 * with more than one child has `display: "flex"` or `display: "none"`.
 * This is a hard Satori requirement — violating it crashes ImageResponse.
 */
function assertSatoriDisplayFlex(
  node: ReactElement,
  path = "root"
): void {
  if (!node || typeof node !== "object") return;

  const { type, props } = node;
  if (type === "div" && props?.children) {
    const children = Array.isArray(props.children)
      ? props.children.filter(
          (c: unknown) => c !== null && c !== undefined && c !== false && c !== ""
        )
      : [props.children];

    if (children.length > 1) {
      const display = props.style?.display;
      expect(
        display === "flex" || display === "none",
        `<div> at ${path} has ${children.length} children but display is "${display ?? "unset"}" — Satori requires "flex" or "none"`
      ).toBe(true);
    }
  }

  // Recurse into children
  if (props?.children) {
    const kids = Array.isArray(props.children)
      ? props.children
      : [props.children];
    kids.forEach((child: any, i: number) => {
      if (child && typeof child === "object" && "type" in child) {
        assertSatoriDisplayFlex(child, `${path} > ${String(child.type)}[${i}]`);
      }
    });
  }
}

describe("RecapCardImage Satori compatibility", () => {
  it("square format: all multi-child divs have display flex", () => {
    const element = RecapCardImage({
      data: SAMPLE_DATA,
      format: "square",
      backgroundCss: "linear-gradient(135deg, #E8B68A 0%, #D4764E 50%, #F5CBA7 100%)",
    });
    assertSatoriDisplayFlex(element as ReactElement);
  });

  it("landscape format: all multi-child divs have display flex", () => {
    const element = RecapCardImage({
      data: SAMPLE_DATA,
      format: "landscape",
      backgroundCss: "linear-gradient(135deg, #FDB99B 0%, #F6D365 50%, #FCE38A 100%)",
    });
    assertSatoriDisplayFlex(element as ReactElement);
  });

  it("square format without background: all multi-child divs have display flex", () => {
    const element = RecapCardImage({
      data: SAMPLE_DATA,
      format: "square",
    });
    assertSatoriDisplayFlex(element as ReactElement);
  });
});
