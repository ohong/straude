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
  it("requires at least one selection before submitting", () => {
    render(<HeardAboutStep onDone={onDone} />);
    const submit = screen.getByRole("button", { name: "Submit" });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Google" }));
    expect(submit).toBeEnabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Google" }));
    expect(submit).toBeDisabled();
  });

  it("saves every selected source and finishes", async () => {
    render(<HeardAboutStep onDone={onDone} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Reddit" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Friend or coworker" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/users/me", expect.objectContaining({ method: "PATCH" }));
    expect(savedBody()).toEqual({
      heard_about_sources: ["friend_or_coworker", "reddit"],
    });
  });

  it("stores the free-text detail only with the Other option", async () => {
    render(<HeardAboutStep onDone={onDone} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Podcast" }));
    expect(screen.queryByLabelText("Tell us where")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Other" }));
    fireEvent.change(screen.getByLabelText("Tell us where"), {
      target: { value: "  A conference talk  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(savedBody()).toEqual({
      heard_about_sources: ["podcast", "other"],
      heard_about: "A conference talk",
    });
  });

  it("reports a failed save next to the action and allows a retry", async () => {
    fetchMock.mockResolvedValueOnce(response({ error: "Could not save" }, 500));
    render(<HeardAboutStep onDone={onDone} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Newsletter" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Could not save"));
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it("skips without writing anything", () => {
    render(<HeardAboutStep onDone={onDone} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "YouTube" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
