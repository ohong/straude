import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MessagesInbox } from "@/components/app/messages/MessagesInbox";

vi.mock("@/lib/utils/compress-image", () => ({
  compressImage: vi.fn(async (file: File) => file),
}));

const threadListResponse = {
  unread_count: 0,
  threads: [
    {
      last_message_id: "thread-1",
      counterpart_username: "alice",
      counterpart_avatar_url: null,
      counterpart_display_name: "Alice",
      last_message_created_at: "2026-03-30T10:00:00.000Z",
      last_message_content: "See you in the inbox",
      last_message_is_from_me: false,
      last_message_has_attachment: false,
      unread_count: 0,
    },
  ],
};

const conversationResponse = {
  counterpart: {
    id: "user-alice",
    username: "alice",
    avatar_url: null,
    display_name: "Alice",
  },
  current_user_id: "user-me",
  messages: [
    {
      id: "message-1",
      content: "First message",
      created_at: "2026-03-30T10:00:00.000Z",
      sender_id: "user-alice",
      recipient_id: "user-me",
      read_at: "2026-03-30T10:05:00.000Z",
      attachments: [],
    },
  ],
};

function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
}

describe("MessagesInbox", () => {
  beforeEach(() => {
    setViewport(390);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/messages/threads")) {
        return new Response(JSON.stringify(threadListResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/messages?with=alice")) {
        return new Response(JSON.stringify(conversationResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url === "/api/messages" && init?.method === "PATCH") {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }));

    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the inbox list visible on phone when no thread is selected", async () => {
    render(<MessagesInbox initialUsername={null} />);

    const listPane = await screen.findByTestId("messages-thread-list");
    const threadPane = await screen.findByTestId("messages-thread-panel");

    expect(listPane.className).not.toContain("hidden");
    await waitFor(() => {
      expect(threadPane.className).toContain("hidden");
    });
  });

  it("shows the thread view on phone when a username is present", async () => {
    render(<MessagesInbox initialUsername="alice" />);

    const listPane = await screen.findByTestId("messages-thread-list");
    const threadPane = await screen.findByTestId("messages-thread-panel");

    expect(await screen.findByTestId("messages-back-button")).toBeInTheDocument();
    expect(await screen.findByText("Message @alice")).toBeInTheDocument();
    await waitFor(() => {
      expect(listPane.className).toContain("hidden");
      expect(threadPane.className).not.toContain("hidden");
    });
  });

  it("shows split view at the tablet breakpoint", async () => {
    setViewport(900);
    render(<MessagesInbox initialUsername={null} />);

    const listPane = await screen.findByTestId("messages-thread-list");
    const threadPane = await screen.findByTestId("messages-thread-panel");
    expect(await screen.findByRole("heading", { name: "Inbox" })).toBeInTheDocument();
    expect(await screen.findByText("Message @alice")).toBeInTheDocument();

    await waitFor(() => {
      expect(listPane.className).not.toContain("hidden");
      expect(threadPane.className).not.toContain("hidden");
    });
  });
});
