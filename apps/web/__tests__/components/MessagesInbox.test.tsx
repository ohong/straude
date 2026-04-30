import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MessagesInbox } from "@/components/app/messages/MessagesInbox";
import { QueryProvider } from "@/components/providers/QueryProvider";

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
  has_more: false,
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

const paginatedConversationResponse = {
  ...conversationResponse,
  has_more: true,
};

const earlierConversationResponse = {
  ...conversationResponse,
  has_more: false,
  messages: [
    {
      id: "message-older",
      content: "Older message",
      created_at: "2026-03-29T10:00:00.000Z",
      sender_id: "user-alice",
      recipient_id: "user-me",
      read_at: "2026-03-29T10:05:00.000Z",
      attachments: [],
    },
  ],
};

const unreadThreadListResponse = {
  unread_count: 1,
  threads: [
    {
      ...threadListResponse.threads[0],
      unread_count: 1,
    },
  ],
};

const unreadConversationResponse = {
  ...conversationResponse,
  messages: [
    {
      ...conversationResponse.messages[0],
      read_at: null,
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

function renderInbox(ui: ReactElement) {
  return render(<QueryProvider>{ui}</QueryProvider>);
}

describe("MessagesInbox", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setViewport(390);
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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

      if (url === "/api/messages" && init?.method === "POST") {
        return new Response(JSON.stringify({
          id: "message-2",
          content: "Pending hello",
          created_at: "2026-03-30T10:06:00.000Z",
          sender_id: "user-me",
          recipient_id: "user-alice",
          read_at: null,
          attachments: [],
        }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the inbox list visible on phone when no thread is selected", async () => {
    renderInbox(<MessagesInbox initialUsername={null} />);

    const listPane = await screen.findByTestId("messages-thread-list");
    const threadPane = await screen.findByTestId("messages-thread-panel");

    expect(listPane.className).not.toContain("hidden");
    await waitFor(() => {
      expect(threadPane.className).toContain("hidden");
    });
  });

  it("renders initial thread data without a thread-list skeleton fetch", async () => {
    renderInbox(
      <MessagesInbox
        initialUsername={null}
        initialThreads={threadListResponse}
      />
    );

    expect(await screen.findByText("See you in the inbox")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/messages/threads",
      expect.anything(),
    );
  });

  it("shows the thread view on phone when a username is present", async () => {
    renderInbox(<MessagesInbox initialUsername="alice" />);

    const listPane = await screen.findByTestId("messages-thread-list");
    const threadPane = await screen.findByTestId("messages-thread-panel");

    expect(await screen.findByTestId("messages-back-button")).toBeInTheDocument();
    expect(await screen.findByText("Message @alice")).toBeInTheDocument();
    await waitFor(() => {
      expect(listPane.className).toContain("hidden");
      expect(threadPane.className).not.toContain("hidden");
    });
  });

  it("loads earlier messages when the first page has more history", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/messages/threads")) {
        return new Response(JSON.stringify(threadListResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/messages?with=alice&before=")) {
        return new Response(JSON.stringify(earlierConversationResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/messages?with=alice")) {
        return new Response(JSON.stringify(paginatedConversationResponse), {
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
    });

    renderInbox(
      <MessagesInbox
        initialUsername="alice"
        initialThreads={threadListResponse}
        initialConversation={paginatedConversationResponse}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: /load earlier messages/i }));

    expect(await screen.findByText("Older message")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /load earlier messages/i }),
      ).not.toBeInTheDocument();
    });
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("before=2026-03-30T10%3A00%3A00.000Z"),
      ),
    ).toBe(true);
  });

  it("shows split view at the tablet breakpoint", async () => {
    setViewport(900);
    renderInbox(
      <MessagesInbox
        initialUsername={null}
        initialThreads={threadListResponse}
        initialConversation={conversationResponse}
      />
    );

    const listPane = await screen.findByTestId("messages-thread-list");
    const threadPane = await screen.findByTestId("messages-thread-panel");
    expect(await screen.findByRole("heading", { name: "Inbox" })).toBeInTheDocument();
    expect(await screen.findByText("Message @alice")).toBeInTheDocument();

    await waitFor(() => {
      expect(listPane.className).not.toContain("hidden");
      expect(threadPane.className).not.toContain("hidden");
    });
  });

  it("keeps the thread list visible while a background refetch runs", async () => {
    setViewport(900);
    let resolveThreads: (response: Response) => void = () => {};
    let resolvePost: (response: Response) => void = () => {};
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/messages/threads")) {
        return new Promise<Response>((resolve) => {
          resolveThreads = resolve;
        });
      }

      if (url === "/api/messages" && init?.method === "POST") {
        return new Promise<Response>((resolve) => {
          resolvePost = resolve;
        });
      }

      if (url.includes("/api/messages?with=alice")) {
        return new Response(JSON.stringify(conversationResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    renderInbox(
      <MessagesInbox
        initialUsername="alice"
        initialThreads={threadListResponse}
        initialConversation={conversationResponse}
      />
    );

    fireEvent.change(await screen.findByLabelText("Message @alice"), {
      target: { value: "Pending hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Pending hello")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("messages-thread-list")).getByText("Alice"),
    ).toBeInTheDocument();

    resolvePost(new Response(JSON.stringify({
      id: "message-2",
      content: "Pending hello",
      created_at: "2026-03-30T10:06:00.000Z",
      sender_id: "user-me",
      recipient_id: "user-alice",
      read_at: null,
      attachments: [],
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }));

    await waitFor(() => {
      expect(
        screen
          .getByTestId("messages-thread-list")
          .querySelector("[aria-busy='true']"),
      ).toBeInTheDocument();
    });
    expect(
      within(screen.getByTestId("messages-thread-list")).getByText("Alice"),
    ).toBeInTheDocument();

    resolveThreads(new Response(JSON.stringify(threadListResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  });

  it("renders a sending bubble optimistically before send completes", async () => {
    let resolvePost: (response: Response) => void = () => {};
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/messages" && init?.method === "POST") {
        return new Promise<Response>((resolve) => {
          resolvePost = resolve;
        });
      }

      if (url.includes("/api/messages?with=alice")) {
        return new Response(JSON.stringify(conversationResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/messages/threads")) {
        return new Response(JSON.stringify(threadListResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    renderInbox(
      <MessagesInbox
        initialUsername="alice"
        initialThreads={threadListResponse}
        initialConversation={conversationResponse}
      />
    );

    fireEvent.change(await screen.findByLabelText("Message @alice"), {
      target: { value: "Pending hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Pending hello")).toBeInTheDocument();
    expect(screen.getAllByText(/sending/i).length).toBeGreaterThan(0);

    resolvePost(new Response(JSON.stringify({
      id: "message-2",
      content: "Pending hello",
      created_at: "2026-03-30T10:06:00.000Z",
      sender_id: "user-me",
      recipient_id: "user-alice",
      read_at: null,
      attachments: [],
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }));
  });

  it("marks the active conversation read optimistically", async () => {
    renderInbox(
      <MessagesInbox
        initialUsername="alice"
        initialThreads={unreadThreadListResponse}
        initialConversation={unreadConversationResponse}
      />
    );

    const listPane = await screen.findByTestId("messages-thread-list");
    await waitFor(() => {
      expect(within(listPane).queryByText("1")).not.toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/messages",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});
