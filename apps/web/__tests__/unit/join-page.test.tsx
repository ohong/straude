import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

const mocks = vi.hoisted(() => ({
  getServiceClient: vi.fn(),
  imageElement: null as unknown,
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: mocks.getServiceClient,
}));

vi.mock("@/lib/og-fonts", () => ({
  loadFonts: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/og-safe-image", () => ({
  loadSafeOgAvatar: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/og", () => ({
  ImageResponse: class MockImageResponse {
    constructor(element: unknown) {
      mocks.imageElement = element;
    }
  },
}));

vi.mock("@/components/landing/Navbar", () => ({
  Navbar: () => <nav />,
}));

vi.mock("@/components/landing/Footer", () => ({
  Footer: () => <footer />,
}));

vi.mock("@/components/landing/HalftoneCanvas", () => ({
  HalftoneCanvas: () => null,
}));

vi.mock("@/app/(landing)/join/[username]/ref-cookie", () => ({
  RefCookie: () => null,
}));

vi.mock("@/components/ui/Avatar", () => ({
  Avatar: ({ alt }: { alt?: string }) => <span>{alt}</span>,
}));

vi.mock("lucide-react", () => ({
  Flame: () => <span />,
}));

import JoinPage, {
  generateMetadata,
} from "@/app/(landing)/join/[username]/page";
import JoinOgImage from "@/app/(landing)/join/[username]/opengraph-image";

type UsageRow = {
  cost_usd: number;
  model_breakdown?: Array<{ model: string; cost_usd: number }>;
  agents?: string[];
};

function makeQuery(data: unknown) {
  const result = { data, error: null };
  const query: Record<string, any> = {
    eq: vi.fn(() => query),
    gte: vi.fn(() => query),
    single: vi.fn().mockResolvedValue(result),
    then: (onFulfilled: (value: typeof result) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return query;
}

function mockServiceClient(rows: UsageRow[]) {
  const profile = {
    id: "user-1",
    username: "agent-athlete",
    display_name: "Agent Athlete",
    avatar_url: null,
    is_public: true,
  };
  const client = {
    from: vi.fn((table: string) => {
      if (table === "users") {
        return { select: vi.fn(() => makeQuery(profile)) };
      }
      if (table === "daily_usage") {
        return { select: vi.fn(() => makeQuery(rows)) };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
  };

  mocks.getServiceClient.mockReturnValue(client);
  return client;
}

const params = { params: Promise.resolve({ username: "agent-athlete" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.imageElement = null;
});

describe("join pages", () => {
  it("uses generic metadata for a Gemini-only profile", async () => {
    mockServiceClient([
      {
        cost_usd: 12.34,
        model_breakdown: [{ model: "gemini-2.5-pro", cost_usd: 12.34 }],
        agents: ["gemini"],
      },
    ]);

    const metadata = await generateMetadata(params);

    expect(metadata.description).toBe(
      "@agent-athlete has spent $12.34 on AI coding. Think you can keep up?",
    );
    expect(metadata.description).not.toMatch(/Claude Code|Codex/);
  });

  it("does not infer the rendered provider from a GPT model", async () => {
    mockServiceClient([
      {
        cost_usd: 56.78,
        model_breakdown: [{ model: "gpt-5.6", cost_usd: 56.78 }],
        agents: ["opencode"],
      },
    ]);

    const markup = renderToStaticMarkup(await JoinPage(params));

    expect(markup).toContain(
      "@agent-athlete has spent $56.78 on AI coding.",
    );
    expect(markup).not.toMatch(/Claude Code|Codex/);
  });

  it("uses generic copy in the Open Graph image", async () => {
    mockServiceClient([
      {
        cost_usd: 90.12,
        model_breakdown: [{ model: "gpt-5.6", cost_usd: 90.12 }],
        agents: ["opencode"],
      },
    ]);

    await JoinOgImage(params);

    const markup = renderToStaticMarkup(mocks.imageElement as ReactElement);
    expect(markup).toContain(
      "@agent-athlete has spent $90.12 on AI coding.",
    );
    expect(markup).not.toMatch(/Claude Code|Codex/);
  });
});
