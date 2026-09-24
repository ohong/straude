import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeardAboutStep } from "@/components/app/onboarding/HeardAboutStep";

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const onDone = vi.fn();
let fetchMock: ReturnType<typeof vi.fn>;

function savedBody() {
  return JSON.parse(fetchMock.mock.calls[0][1].body as string);
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn(() => Promise.resolve(response({})));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("heard-about survey", () => {
  it("requires one selection before continuing", () => {
    render(<HeardAboutStep onDone={onDone} />);
    const submit = screen.getByRole("button", { name: "Continue" });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: "Search engine" }));
    expect(submit).toBeEnabled();
  });

  it("saves only the latest source and clears detail when the source changes", async () => {
    render(<HeardAboutStep onDone={onDone} />);
    fireEvent.click(screen.getByRole("radio", { name: "Reddit" }));
    fireEvent.change(screen.getByLabelText(/Anything more specific/), {
      target: { value: "r/SomeCommunity" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Friend or coworker" }));
    expect(screen.getByLabelText(/Anything more specific/)).toHaveValue("");
    expect(screen.getByRole("radio", { name: "Reddit" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/users/me", expect.objectContaining({ method: "PATCH" }));
    expect(savedBody()).toEqual({
      heard_about_sources: ["friend_or_coworker"],
      heard_about: null,
    });
  });

  it("stores optional detail for a specific source", async () => {
    render(<HeardAboutStep onDone={onDone} />);
    expect(screen.queryByLabelText(/Anything more specific/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Podcast" }));
    fireEvent.change(screen.getByLabelText(/Anything more specific/), {
      target: { value: "  Practical AI episode  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(savedBody()).toEqual({
      heard_about_sources: ["podcast"],
      heard_about: "Practical AI episode",
    });
  });

  it("allows Other without requiring detail", async () => {
    render(<HeardAboutStep onDone={onDone} />);
    fireEvent.click(screen.getByRole("radio", { name: "Other" }));
    expect(screen.getByLabelText(/Where did you find us/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(savedBody()).toEqual({ heard_about_sources: ["other"], heard_about: null });
  });

  it("reports a failed save next to the action and allows a retry", async () => {
    fetchMock.mockResolvedValueOnce(response({ error: "Could not save" }, 500));
    render(<HeardAboutStep onDone={onDone} />);
    fireEvent.click(screen.getByRole("radio", { name: "Newsletter" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Could not save"));
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it("skips without writing anything", () => {
    render(<HeardAboutStep onDone={onDone} />);
    fireEvent.click(screen.getByRole("radio", { name: "YouTube" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
