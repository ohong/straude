import { describe, it, expect } from "vitest";
import {
  parseMentions,
  getMentionQuery,
  mentionsToMarkdownLinks,
} from "@/lib/utils/mentions";

describe("parseMentions", () => {
  it("extracts unique usernames", () => {
    expect(parseMentions("hey @alice and @bob")).toEqual(["alice", "bob"]);
  });

  it("deduplicates and lowercases", () => {
    expect(parseMentions("@Alice @alice @ALICE")).toEqual(["alice"]);
  });

  it("returns empty array for no mentions", () => {
    expect(parseMentions("no mentions here")).toEqual([]);
  });

  it("does not match email addresses", () => {
    expect(parseMentions("email user@example.com")).toEqual([]);
  });

  it("matches at start of string", () => {
    expect(parseMentions("@startuser hello")).toEqual(["startuser"]);
  });

  it("handles hyphens and underscores", () => {
    expect(parseMentions("@user-name @user_name")).toEqual([
      "user-name",
      "user_name",
    ]);
  });

  it("matches after punctuation like parentheses", () => {
    expect(parseMentions("(@ohong)")).toEqual(["ohong"]);
  });

  it("matches after quotes and other non-word chars", () => {
    expect(parseMentions('"@alice" and /@bob')).toEqual(["alice", "bob"]);
  });
});

describe("getMentionQuery", () => {
  it("returns query when typing after @", () => {
    expect(getMentionQuery("hello @al", 9)).toBe("al");
  });

  it("returns empty string right after @", () => {
    expect(getMentionQuery("hello @", 7)).toBe("");
  });

  it("returns null when not in a mention", () => {
    expect(getMentionQuery("hello world", 11)).toBeNull();
  });

  it("returns null when cursor is after a space", () => {
    expect(getMentionQuery("hello @alice ", 13)).toBeNull();
  });

  it("handles @ at start of string", () => {
    expect(getMentionQuery("@bob", 4)).toBe("bob");
  });

  it("triggers after punctuation like parentheses", () => {
    expect(getMentionQuery("(@oh", 4)).toBe("oh");
  });

  it("triggers after quote", () => {
    expect(getMentionQuery('"@al', 4)).toBe("al");
  });

  it("does not trigger after word character", () => {
    expect(getMentionQuery("user@al", 7)).toBeNull();
  });
});

describe("mentionsToMarkdownLinks", () => {
  it("converts @user to markdown link", () => {
    expect(mentionsToMarkdownLinks("hello @alice")).toBe(
      "hello [@alice](/u/alice)"
    );
  });

  it("handles multiple mentions", () => {
    expect(mentionsToMarkdownLinks("@alice and @bob")).toBe(
      "[@alice](/u/alice) and [@bob](/u/bob)"
    );
  });

  it("preserves text without mentions", () => {
    expect(mentionsToMarkdownLinks("no mentions")).toBe("no mentions");
  });

  it("lowercases in the link href", () => {
    expect(mentionsToMarkdownLinks("@Alice")).toBe("[@Alice](/u/alice)");
  });

  it("converts mentions after punctuation", () => {
    expect(mentionsToMarkdownLinks("(@ohong)")).toBe(
      "([@ohong](/u/ohong))"
    );
  });
});
