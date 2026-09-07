import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  createSignedUrls: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => ({
    storage: { from: mocks.from },
  })),
}));

import {
  buildSignedMessageAttachmentBatches,
  buildSignedMessageAttachments,
} from "@/lib/message-attachments";

const attachment = (bucket: string, path: string) => ({
  bucket,
  path,
  name: path.split("/").at(-1) ?? "file",
  type: "image/png",
  size: 123,
});

describe("message attachment URL signing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ createSignedUrls: mocks.createSignedUrls });
    mocks.createSignedUrls.mockImplementation(async (paths: string[]) => ({
      data: paths.map((path) => ({
        path,
        signedUrl: `https://storage.test/${path}`,
        error: null,
      })),
      error: null,
    }));
  });

  it("batches all paths in the same bucket into one signing request", async () => {
    const signed = await buildSignedMessageAttachmentBatches([
      { rawAttachments: [attachment("dm-attachments", "user-1/one.png")] },
      { rawAttachments: [attachment("dm-attachments", "user-1/two.png")] },
    ]);

    expect(mocks.from).toHaveBeenCalledOnce();
    expect(mocks.createSignedUrls).toHaveBeenCalledWith(
      ["user-1/one.png", "user-1/two.png"],
      3600,
    );
    expect(signed.map((group) => group[0]?.url)).toEqual([
      "https://storage.test/user-1/one.png",
      "https://storage.test/user-1/two.png",
    ]);
  });

  it("filters paths outside the message sender's storage prefix before signing", async () => {
    const signed = await buildSignedMessageAttachments(
      [
        attachment("dm-attachments", "user-1/mine.png"),
        attachment("dm-attachments", "user-2/theirs.png"),
      ],
      "user-1",
    );

    expect(mocks.createSignedUrls).toHaveBeenCalledWith(
      ["user-1/mine.png"],
      3600,
    );
    expect(signed).toHaveLength(1);
  });
});
