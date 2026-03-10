import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import { LeaderboardTable } from "@/components/app/leaderboard/LeaderboardTable";

const entries = [
  {
    user_id: "user-1",
    username: "alice",
    avatar_url: null,
    country: "Canada",
    region: "north_america",
    total_cost: 12.34,
    total_output_tokens: 12345,
    streak: 7,
    rank: 1,
  },
];

describe("LeaderboardTable", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("shows region filters for logged-out users", () => {
    render(
      <LeaderboardTable
        entries={entries}
        currentUserId={null}
        currentPeriod="week"
        currentRegion={null}
      />,
    );

    expect(screen.getByRole("button", { name: "Global" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Europe" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "N. America" })).toBeInTheDocument();
  });

  it("navigates to the selected regional leaderboard for guests", () => {
    render(
      <LeaderboardTable
        entries={entries}
        currentUserId={null}
        currentPeriod="week"
        currentRegion={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Europe" }));

    expect(push).toHaveBeenCalledWith("/leaderboard?period=week&region=europe");
  });
});
