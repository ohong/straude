import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAllowedAvatarUrl, isAllowedUserAvatarUrl } from "@/lib/storage";

describe("storage avatar URL safety", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  });

  it("allows first-party avatar bucket URLs", () => {
    expect(
      isAllowedAvatarUrl(
        "https://test.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg"
      )
    ).toBe(true);
  });

  it("allows legacy first-party post image avatar URLs", () => {
    expect(
      isAllowedAvatarUrl(
        "https://test.supabase.co/storage/v1/object/public/post-images/user-1/avatar.jpg"
      )
    ).toBe(true);
  });

  it("rejects first-party URLs from non-avatar buckets", () => {
    expect(
      isAllowedAvatarUrl(
        "https://test.supabase.co/storage/v1/object/public/dm-attachments/user-1/file.jpg"
      )
    ).toBe(false);
  });

  it("requires first-party avatar storage URLs to be owned by the user", () => {
    expect(
      isAllowedUserAvatarUrl(
        "https://test.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg",
        "user-1"
      )
    ).toBe(true);
    expect(
      isAllowedUserAvatarUrl(
        "https://test.supabase.co/storage/v1/object/public/post-images/user-1/avatar.jpg",
        "user-1"
      )
    ).toBe(true);
    expect(
      isAllowedUserAvatarUrl(
        "https://test.supabase.co/storage/v1/object/public/avatars/user-2/avatar.jpg",
        "user-1"
      )
    ).toBe(false);
  });
});
