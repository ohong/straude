import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { POST } from "@/app/api/upload/route";
import { createClient } from "@/lib/supabase/server";

function mockSupabase(opts: {
  user?: { id: string } | null;
  uploadError?: any;
  publicUrl?: string;
}) {
  const {
    user = { id: "user-1" },
    uploadError = null,
    publicUrl = "https://cdn.example.com/img.jpg",
  } = opts;

  const client: Record<string, any> = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: uploadError }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl },
        }),
      }),
    },
  };
  (createClient as any).mockResolvedValue(client);
  return client;
}

/**
 * Build a mock NextRequest with a stubbed formData() method.
 * This avoids jsdom FormData + body streaming incompatibilities.
 */
function makeUploadRequest(file: { name: string; type: string; size: number } | null) {
  const formData = new Map<string, any>();
  if (file) {
    formData.set("file", {
      name: file.name,
      type: file.type,
      size: file.size,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(file.size)),
    });
  }

  return {
    formData: () =>
      Promise.resolve({
        get: (key: string) => formData.get(key) ?? null,
      }),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/upload", () => {
  it("rejects unauthenticated requests", async () => {
    mockSupabase({ user: null });

    const res = await POST(makeUploadRequest({ name: "test.jpg", type: "image/jpeg", size: 100 }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("rejects when no file is provided", async () => {
    mockSupabase({});

    const res = await POST(makeUploadRequest(null));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("No file provided");
  });

  it("rejects invalid file types", async () => {
    mockSupabase({});

    const res = await POST(
      makeUploadRequest({ name: "test.pdf", type: "application/pdf", size: 100 })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("File type not allowed");
  });

  it("accepts heic files", async () => {
    mockSupabase({ publicUrl: "https://cdn.example.com/user-1/abc.heic" });

    const res = await POST(
      makeUploadRequest({ name: "photo.heic", type: "image/heic", size: 100 })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.url).toBe("https://cdn.example.com/user-1/abc.heic");
  });

  it("accepts heif files", async () => {
    mockSupabase({ publicUrl: "https://cdn.example.com/user-1/abc.heif" });

    const res = await POST(
      makeUploadRequest({ name: "photo.heif", type: "image/heif", size: 100 })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.url).toBe("https://cdn.example.com/user-1/abc.heif");
  });

  it("accepts jpeg files", async () => {
    mockSupabase({ publicUrl: "https://cdn.example.com/user-1/abc.jpg" });

    const res = await POST(
      makeUploadRequest({ name: "photo.jpg", type: "image/jpeg", size: 100 })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.url).toBe("https://cdn.example.com/user-1/abc.jpg");
  });

  it("accepts png files", async () => {
    mockSupabase({ publicUrl: "https://cdn.example.com/img.png" });

    const res = await POST(
      makeUploadRequest({ name: "img.png", type: "image/png", size: 100 })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.url).toBeDefined();
  });

  it("accepts webp files", async () => {
    mockSupabase({ publicUrl: "https://cdn.example.com/img.webp" });

    const res = await POST(
      makeUploadRequest({ name: "img.webp", type: "image/webp", size: 100 })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
  });

  it("accepts gif files", async () => {
    mockSupabase({ publicUrl: "https://cdn.example.com/img.gif" });

    const res = await POST(
      makeUploadRequest({ name: "img.gif", type: "image/gif", size: 100 })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
  });

  it("rejects files over 20MB", async () => {
    mockSupabase({});

    const res = await POST(
      makeUploadRequest({ name: "huge.jpg", type: "image/jpeg", size: 21 * 1024 * 1024 })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("20MB");
  });

  it("returns url on success", async () => {
    mockSupabase({ publicUrl: "https://cdn.example.com/user-1/uuid.jpg" });

    const res = await POST(
      makeUploadRequest({ name: "test.jpg", type: "image/jpeg", size: 100 })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.url).toBe("https://cdn.example.com/user-1/uuid.jpg");
  });

  it("returns 500 on upload error", async () => {
    mockSupabase({ uploadError: { message: "Storage full" } });

    const res = await POST(
      makeUploadRequest({ name: "test.jpg", type: "image/jpeg", size: 100 })
    );
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Storage full");
  });
});
