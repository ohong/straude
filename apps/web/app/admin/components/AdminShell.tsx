"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";

type Theme = "light" | "dark";

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

export function useAdminTheme() {
  return useContext(ThemeCtx);
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const theme = useSyncExternalStore<Theme>(
    () => () => {},
    () => resolvedTheme,
    () => "light",
  );

  return (
    <ThemeCtx.Provider value={{ theme, toggle: toggleTheme }}>
      <div
        className="admin-shell min-h-screen"
        style={{ backgroundColor: "var(--admin-bg)", color: "var(--admin-fg)" }}
      >
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-3"
          style={{
            backgroundColor: "var(--admin-bg)",
            borderBottom: "1px solid var(--admin-border)",
          }}
        >
          <div className="flex items-center gap-3">
            <Link
              href="/feed"
              className="text-sm font-bold tracking-tight"
              style={{ color: "var(--admin-fg)" }}
            >
              STRAUDE
            </Link>
            <span
              className="rounded-[4px] px-2 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: "var(--admin-fg)",
                color: "var(--admin-bg)",
              }}
            >
              Admin
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-7 w-7 items-center justify-center rounded-md"
              style={{ color: "var(--admin-fg-secondary)" }}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <Sun size={15} aria-hidden />
              ) : (
                <Moon size={15} aria-hidden />
              )}
            </button>
            <Link
              href="/feed"
              className="text-sm"
              style={{ color: "var(--admin-fg-secondary)" }}
            >
              Back to app
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </div>
    </ThemeCtx.Provider>
  );
}
