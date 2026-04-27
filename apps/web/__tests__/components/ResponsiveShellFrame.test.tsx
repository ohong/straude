import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResponsiveShellFrame } from "@/components/app/shared/ResponsiveShellFrame";

describe("ResponsiveShellFrame", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });

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

        return new Response(
          JSON.stringify({ notifications: [], unread_count: 0, threads: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not render desktop rails on the first phone render", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ResponsiveShellFrame
          username="alice"
          avatarUrl={null}
          leftPanel={<div>Left rail content</div>}
          rightPanel={<div>Right rail content</div>}
        >
          <div>Page content</div>
        </ResponsiveShellFrame>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(screen.queryByText("Left rail content")).not.toBeInTheDocument();
    expect(screen.queryByText("Right rail content")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open panels/i })).toBeInTheDocument();
  });
});
