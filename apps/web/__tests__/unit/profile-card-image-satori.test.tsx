import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";

type SatoriNode = ReactElement<{ children?: React.ReactNode; style?: React.CSSProperties }>;
import { ProfileShareCardImage } from "@/lib/share-assets/profile-card-image";
import type { ProfileShareCardData } from "@/lib/share-assets/profile-card-data";

const SAMPLE_DATA: ProfileShareCardData = {
  username: "alice",
  display_name: "Alice Example",
  is_public: true,
  streak: 18,
  total_output_tokens: 2_100_000_000,
  recent_output_tokens: 120_000_000,
  active_days_last_30: 24,
  primary_model: "GPT-5.3-Codex",
  contribution_data: [
    { date: "2026-03-01", cost_usd: 0 },
    { date: "2026-03-02", cost_usd: 12.5 },
    { date: "2026-03-03", cost_usd: 58.1 },
  ],
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

describe("ProfileShareCardImage Satori compatibility", () => {
  it("all multi-child divs use flex layout", () => {
    const element = ProfileShareCardImage({ data: SAMPLE_DATA });
    assertSatoriDisplayFlex(element as SatoriNode);
  });
});
