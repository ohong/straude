import { act, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { CommandPalette } from "@/components/app/shared/CommandPalette";
import { THEME_STORAGE_KEY } from "@/lib/theme";

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

  it("registers theme actions and updates the shared theme store", async () => {
    render(
      <ThemeProvider>
        <CommandPalette username="alice">
          <div>Child</div>
        </CommandPalette>
      </ThemeProvider>,
    );

    expect(capturedActions.map((action) => action.id)).toEqual(
      expect.arrayContaining(["theme-light", "theme-dark", "theme-system"]),
    );

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
