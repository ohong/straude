import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TopHeader } from "@/components/app/shared/TopHeader";

function renderTopHeader(props: ComponentProps<typeof TopHeader>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TopHeader {...props} />
    </QueryClientProvider>,
  );
}

describe("TopHeader", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/app/counts")) {
          return new Response(
            JSON.stringify({
              notification_unread_count: 0,
              message_unread_count: 0,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

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
    renderTopHeader({
      username: "alice",
      avatarUrl: null,
      panelTriggerLabel: "Panels",
      onOpenPanels: vi.fn(),
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /open panels/i })).toBeInTheDocument();
    });
  });

  it("hides the panels trigger in full desktop mode", async () => {
    renderTopHeader({ username: "alice", avatarUrl: null });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /open panels/i })).not.toBeInTheDocument();
    });
  });

  it("loads shared app counts without fetching message threads", async () => {
    renderTopHeader({ username: "alice", avatarUrl: null });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/app/counts");
    });

    const requestedUrls = vi.mocked(fetch).mock.calls.map(([input]) =>
      String(input),
    );

    expect(requestedUrls).toContain("/api/notifications");
    expect(requestedUrls).not.toContain("/api/messages/threads?limit=1");
  });
});
