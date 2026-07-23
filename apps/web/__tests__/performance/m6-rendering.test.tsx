import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecapPage } from "@/components/app/recap/RecapPage";
import { RouteLoading } from "@/components/app/shared/RouteLoading";
import SearchClient from "@/components/app/search/SearchClient";
import type { RecapData } from "@/lib/utils/recap";

const recap: RecapData = {
  total_cost: 42,
  output_tokens: 12_000,
  active_days: 3,
  total_days: 7,
  session_count: 8,
  streak: 4,
  primary_model: "Claude Sonnet",
  contribution_data: [],
  period_label: "My Week in Claude Code",
  period: "week",
  username: "alice",
  is_public: true,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("M6 server-provided route data", () => {
  it("renders recap data immediately without a client fetch on mount", async () => {
    const fetchMock = vi.spyOn(global, "fetch");

    render(<RecapPage initialData={recap} />);
    await act(async () => {});

    expect(screen.getByText("$42.00")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders initial search results without a client fetch on mount", async () => {
    const fetchMock = vi.spyOn(global, "fetch");

    render(
      <SearchClient
        initialQuery="ali"
        initialResults={[
          {
            id: "user-1",
            username: "alice",
            display_name: "Alice",
            bio: "Builder",
            avatar_url: null,
            is_public: true,
          },
        ]}
      />,
    );
    await act(async () => {});

    expect(screen.getByRole("link", { name: /alice/i })).toHaveAttribute(
      "href",
      "/u/alice",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("announces route-level loading state without exposing skeletons", () => {
    render(<RouteLoading label="settings" />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Loading settings");
  });
});
