import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { CommandPalette } from "@/components/app/shared/CommandPalette";
import { THEME_STORAGE_KEY } from "@/lib/theme";

const togglePalette = vi.fn();
let store: Record<string, string> = {};
let capturedActions: Array<{
  id: string;
  name: string;
  perform?: () => void;
}> = [];

vi.mock("kbar", () => ({
  KBarProvider: ({
    actions,
    children,
  }: {
    actions: Array<{ id: string; name: string; perform?: () => void }>;
    children: ReactNode;
  }) => {
    capturedActions = actions;
    return <div>{children}</div>;
  },
  KBarPortal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  KBarPositioner: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  KBarAnimator: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  KBarSearch: ({ className }: { className?: string }) => <input className={className} />,
  KBarResults: () => null,
  useKBar: () => ({ query: { toggle: togglePalette } }),
  useMatches: () => ({ results: [] }),
}));

const mockStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    store = {};
  },
};

describe("CommandPalette", () => {
  beforeEach(() => {
    store = {};
    capturedActions = [];
    togglePalette.mockClear();
    document.documentElement.setAttribute("data-theme", "light");
    document.head.innerHTML = '<meta name="theme-color" content="#ffffff" />';
    vi.stubGlobal("localStorage", mockStorage);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation(() => ({
        matches: false,
        media: "(prefers-color-scheme: dark)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: () => true,
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.head.innerHTML = "";
  });

  it("opens when the shortcut arrives while the palette module is loading", async () => {
    let idleCallback: IdleRequestCallback | undefined;
    vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) => {
      idleCallback = callback;
      return 1;
    });
    vi.stubGlobal("cancelIdleCallback", vi.fn());
    render(
      <ThemeProvider>
        <CommandPalette username="alice"><div>Page</div></CommandPalette>
      </ThemeProvider>,
    );
    act(() => idleCallback?.({ didTimeout: false, timeRemaining: () => 50 }));

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    await waitFor(() => expect(togglePalette).toHaveBeenCalledOnce());
  });

  it("preserves edits and focus when the deferred palette loads", async () => {
    let idleCallback: IdleRequestCallback | undefined;
    vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) => {
      idleCallback = callback;
      return 1;
    });
    vi.stubGlobal("cancelIdleCallback", vi.fn());
    function EditablePage() {
      const [value, setValue] = useState("");
      return (
        <input
          aria-label="Team"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      );
    }
    const view = render(
      <ThemeProvider>
        <CommandPalette username="alice">
          <EditablePage />
        </CommandPalette>
      </ThemeProvider>,
    );
    const input = view.getByRole("textbox", { name: "Team" });
    input.focus();
    fireEvent.change(input, { target: { value: "https://example.com" } });

    act(() => idleCallback?.({ didTimeout: false, timeRemaining: () => 50 }));
    await waitFor(() => expect(capturedActions.length).toBeGreaterThan(0));

    expect(view.getByRole("textbox", { name: "Team" })).toBe(input);
    expect(input).toHaveValue("https://example.com");
    expect(input).toHaveFocus();
  });

  it("registers theme actions and updates the shared theme store", async () => {
    render(
      <ThemeProvider>
        <CommandPalette username="alice">
          <div>Child</div>
        </CommandPalette>
      </ThemeProvider>,
    );

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    await waitFor(() => {
      expect(capturedActions.map((action) => action.id)).toEqual(
        expect.arrayContaining(["theme-light", "theme-dark", "theme-system"]),
      );
    });

    const darkAction = capturedActions.find((action) => action.id === "theme-dark");
    act(() => {
      darkAction?.perform?.();
    });

    await waitFor(() => {
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
      expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    });

    const systemAction = capturedActions.find((action) => action.id === "theme-system");
    act(() => {
      systemAction?.perform?.();
    });

    await waitFor(() => {
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
      expect(document.documentElement).toHaveAttribute("data-theme", "light");
    });
  });
});
