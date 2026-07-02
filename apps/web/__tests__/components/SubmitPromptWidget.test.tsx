import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SubmitPromptWidget } from "@/components/app/prompts/SubmitPromptWidget";

describe("SubmitPromptWidget", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  async function openPromptModal() {
    fireEvent.click(screen.getByRole("button", { name: /submit a prompt/i }));
    return screen.findByRole("dialog");
  }

  it("opens the modal and submits a prompt", async () => {
    const fetchMock = vi.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "prompt-1", status: "new" }),
    } as any);

    render(<SubmitPromptWidget username="jane" />);

    expect(await openPromptModal()).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "Please add a compact mode for activity cards in the feed." },
    });

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /submit prompt/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/prompts",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            prompt: "Please add a compact mode for activity cards in the feed.",
            anonymous: false,
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByText("Prompt submitted.")).toBeInTheDocument();
    });
  });

  it("shows API error message when rate limited", async () => {
    vi.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "Daily limit reached (10/24h). Try again later." }),
    } as any);

    render(<SubmitPromptWidget username="jane" />);

    await openPromptModal();

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "Please add markdown shortcuts in comments." },
    });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /submit prompt/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Daily limit reached (10/24h). Try again later."),
      ).toBeInTheDocument();
    });
  });

  it("can submit as anonymous", async () => {
    const fetchMock = vi.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "prompt-2", status: "new", is_anonymous: true }),
    } as any);

    render(<SubmitPromptWidget username="jane" />);

    await openPromptModal();
    fireEvent.click(screen.getByRole("button", { name: /submit as anonymous/i }));

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "Please add AI summaries on profile pages." },
    });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /submit prompt/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/prompts",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            prompt: "Please add AI summaries on profile pages.",
            anonymous: true,
          }),
        }),
      );
    });
  });

  it("shows the submit keyboard shortcut hint", async () => {
    render(<SubmitPromptWidget username="jane" />);

    await openPromptModal();

    expect(
      screen.getByRole("button", { name: /submit prompt ⌘↵/i }),
    ).toBeInTheDocument();
  });

  it("shows community prompts inside the modal and can return to submit view", async () => {
    const fetchMock = vi.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        prompts: [
          {
            id: "prompt-1",
            prompt: "Add keyboard shortcuts for post actions.",
            is_anonymous: false,
            created_at: "2026-03-01T10:00:00.000Z",
            user: { username: "alice" },
          },
          {
            id: "prompt-2",
            prompt: "Improve loading skeletons in feed.",
            is_anonymous: true,
            created_at: "2026-03-01T10:02:00.000Z",
            user: { username: "bob" },
          },
        ],
      }),
    } as any);

    render(<SubmitPromptWidget username="jane" />);

    await openPromptModal();
    fireEvent.click(screen.getByRole("button", { name: /view community prompts/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/prompts?limit=20&offset=0");
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /community prompts/i })).toBeInTheDocument();
      expect(screen.getByText("Add keyboard shortcuts for post actions.")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /@alice/i })).toHaveAttribute("href", "/u/alice");
      expect(screen.getByText("Anonymous")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /back to submit a prompt/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /submit a prompt/i })).toBeInTheDocument();
      expect(screen.getByLabelText("Prompt")).toBeInTheDocument();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });
});
