import { describe, expect, it } from "vitest";
import { buildProfileUpdatePayload } from "@/app/(app)/settings/page";

const baseInput = {
  username: "alice",
  displayName: "Alice",
  bio: "Builder",
  heardAbout: "Friend",
  link: "https://example.com",
  country: "US",
  githubUsername: "alicehub",
  teamUrl: "https://anthropic.com",
  isPublic: true,
  emailNotifications: true,
  emailMentionNotifications: true,
  emailDmNotifications: true,
  timezone: "America/Vancouver",
};

describe("settings profile update payload", () => {
  it("sends null for cleared optional profile fields", () => {
    expect(
      buildProfileUpdatePayload({
        ...baseInput,
        displayName: "",
        bio: "",
        link: "",
        country: "",
        githubUsername: "",
        teamUrl: "",
      })
    ).toMatchObject({
      username: "alice",
      display_name: null,
      bio: null,
      link: null,
      country: null,
      github_username: null,
      team_url: null,
    });
  });

  it("trims and forwards a non-empty team URL", () => {
    expect(
      buildProfileUpdatePayload({
        ...baseInput,
        teamUrl: "  https://anthropic.com  ",
      })
    ).toMatchObject({
      team_url: "https://anthropic.com",
    });
  });

  it("does not clear username when the field is blank", () => {
    expect(
      buildProfileUpdatePayload({
        ...baseInput,
        username: " ",
      })
    ).toMatchObject({
      username: undefined,
      display_name: "Alice",
    });
  });

  it("trims optional text fields before saving", () => {
    expect(
      buildProfileUpdatePayload({
        ...baseInput,
        displayName: " Alice Liddell ",
        bio: " Hello ",
        link: " https://example.com/me ",
        githubUsername: " alice ",
      })
    ).toMatchObject({
      display_name: "Alice Liddell",
      bio: "Hello",
      link: "https://example.com/me",
      github_username: "alice",
    });
  });
});
