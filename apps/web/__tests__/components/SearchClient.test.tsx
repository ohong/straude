import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

import SearchClient from "@/components/app/search/SearchClient";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("client search data ownership", () => {
  it("issues one API search and updates the URL without a second server navigation", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ users: [] })));
    const replaceState = vi.spyOn(window.history, "replaceState");
    render(<SearchClient initialQuery="" initialResults={[]} />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "alice" } });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/search?q=alice&limit=20");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/search?q=alice");
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.getByText(/No users found/)).toBeInTheDocument();
  });

  it("clears a pending query without fetching or navigating the server", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(global, "fetch");
    const replaceState = vi.spyOn(window.history, "replaceState");
    render(<SearchClient initialQuery="" initialResults={[]} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "alice" } });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(replaceState).toHaveBeenCalledWith(null, "", "/search");
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
