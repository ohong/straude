import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TopHeader } from "@/components/app/shared/TopHeader";

describe("TopHeader", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/notifications")) {
          return new Response(
            JSON.stringify({ notifications: [], unread_count: 0 }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/api/messages/threads")) {
          return new Response(
            JSON.stringify({ unread_count: 0, threads: [] }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the panels trigger when shell panels are available", async () => {
    render(
      <TopHeader
        username="alice"
        avatarUrl={null}
        panelTriggerLabel="Panels"
        onOpenPanels={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /open panels/i })).toBeInTheDocument();
    });
  });

  it("hides the panels trigger in full desktop mode", async () => {
    render(<TopHeader username="alice" avatarUrl={null} />);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /open panels/i })).not.toBeInTheDocument();
    });
  });
});
