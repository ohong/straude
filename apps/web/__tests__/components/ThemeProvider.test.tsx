import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "@/components/providers/ThemeProvider";
import {
  THEME_META_COLOR_DARK,
  THEME_META_COLOR_LIGHT,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

let store: Record<string, string> = {};
let systemPrefersDark = false;
const mediaListeners = new Set<(event: MediaQueryListEvent) => void>();

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
  get length() {
    return Object.keys(store).length;
  },
  key: (index: number) => Object.keys(store)[index] ?? null,
};

function emitSystemThemeChange(nextValue: boolean) {
  systemPrefersDark = nextValue;
  const event = { matches: systemPrefersDark } as MediaQueryListEvent;
  mediaListeners.forEach((listener) => listener(event));
}

function ThemeHarness() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div>
      <span data-testid="resolved-theme">{resolvedTheme}</span>
      <button type="button" onClick={() => setTheme("dark")}>
        Dark
      </button>
      <button type="button" onClick={() => setTheme("system")}>
        System
      </button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    store = {};
    systemPrefersDark = false;
    mediaListeners.clear();
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "";
    document.head.innerHTML = '<meta name="theme-color" content="#ffffff" />';
    vi.stubGlobal("localStorage", mockStorage);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation(() => ({
        get matches() {
          return systemPrefersDark;
        },
        media: "(prefers-color-scheme: dark)",
        onchange: null,
        addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
          mediaListeners.add(listener),
        removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
          mediaListeners.delete(listener),
        addListener: (listener: (event: MediaQueryListEvent) => void) =>
          mediaListeners.add(listener),
        removeListener: (listener: (event: MediaQueryListEvent) => void) =>
          mediaListeners.delete(listener),
        dispatchEvent: () => true,
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.head.innerHTML = "";
  });

  it("applies a stored dark preference to the DOM and theme-color meta tag", async () => {
    store[THEME_STORAGE_KEY] = "dark";

    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    });

    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(screen.getByTestId("resolved-theme")).toHaveTextContent("dark");
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      THEME_META_COLOR_DARK,
    );
  });

  it("removes the stored override for system theme and follows OS changes", async () => {
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Dark" }));

    await waitFor(() => {
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    });

    fireEvent.click(screen.getByRole("button", { name: "System" }));

    await waitFor(() => {
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
      expect(document.documentElement).toHaveAttribute("data-theme", "light");
    });

    act(() => {
      emitSystemThemeChange(true);
    });

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-theme", "dark");
      expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
        "content",
        THEME_META_COLOR_DARK,
      );
    });
  });

  it("keeps working when localStorage writes fail", async () => {
    vi.stubGlobal("localStorage", {
      ...mockStorage,
      setItem: () => {
        throw new Error("storage disabled");
      },
      removeItem: () => {
        throw new Error("storage disabled");
      },
    });

    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Dark" }));

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-theme", "dark");
      expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
        "content",
        THEME_META_COLOR_DARK,
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "System" }));

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-theme", "light");
      expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
        "content",
        THEME_META_COLOR_LIGHT,
      );
    });
  });
});
