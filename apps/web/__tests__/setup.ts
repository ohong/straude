import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  redirect: vi.fn(),
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: () => ({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

// Mock next/server `after` — throws outside a request scope in unit tests.
// Route handlers import `after` from `@/lib/utils/after` (a thin re-export)
// so we can mock it without loading the heavyweight `next/server` module.
vi.mock("@/lib/utils/after", () => ({
  after: vi.fn((cb: (...args: unknown[]) => unknown) => {
    try {
      const result = cb();
      if (result && typeof (result as Promise<unknown>).catch === "function") {
        (result as Promise<unknown>).catch(() => {});
      }
    } catch {
      // swallow — after() runs fire-and-forget in production
    }
  }),
}));
