import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AdminShell } from "@/app/admin/components/AdminShell";
import { THEME_STORAGE_KEY } from "@/lib/theme";

let store: Record<string, string> = {};
let systemPrefersDark = false;

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

describe("AdminShell", () => {
  beforeEach(() => {
    store = {};
    systemPrefersDark = false;
    document.documentElement.setAttribute("data-theme", "light");
    vi.stubGlobal("localStorage", mockStorage);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation(() => ({
        get matches() {
          return systemPrefersDark;
        },
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
  });

  it("uses the shared theme state and persists the admin toggle", async () => {
    store[THEME_STORAGE_KEY] = "dark";

    render(
      <ThemeProvider>
        <AdminShell>
          <div>Admin content</div>
        </AdminShell>
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Switch to light mode" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));

    await waitFor(() => {
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
      expect(document.documentElement).toHaveAttribute("data-theme", "light");
    });
  });
});
