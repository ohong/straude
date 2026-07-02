import { describe, expect, it } from "vitest";
import {
  ACTIVATION_EVENTS,
  deriveActivationState,
  sanitizeActivationProperties,
} from "@/lib/analytics/activation";

describe("activation funnel contract", () => {
  it("keeps the canonical event names stable", () => {
    expect(ACTIVATION_EVENTS).toEqual([
      "landing_primary_cta_clicked",
      "guest_signup_cta_clicked",
      "signup_started",
      "signup_completed",
      "onboarding_profile_started",
      "sync_command_copied",
      "first_sync_nudge_clicked",
      "usage_submit_succeeded",
      "first_sync_confirmed",
      "activation_completed",
    ]);
  });

  it("treats unauthenticated visitors as anonymous", () => {
    expect(deriveActivationState({ isAuthenticated: false })).toBe("anonymous");
  });

  it("does not treat signup or profile setup as activation", () => {
    expect(deriveActivationState({ isAuthenticated: true })).toBe("signed_up");
    expect(deriveActivationState({
      isAuthenticated: true,
      profileStarted: true,
    })).toBe("profile_started");
  });

  it("does not treat command copy or usage submit as activation", () => {
    expect(deriveActivationState({
      isAuthenticated: true,
      syncCommandCopied: true,
    })).toBe("sync_command_copied");
    expect(deriveActivationState({
      isAuthenticated: true,
      usageSubmitted: true,
    })).toBe("first_usage_submitted");
  });

  it("defines activated as first sync confirmed in web", () => {
    expect(deriveActivationState({
      isAuthenticated: true,
      profileStarted: true,
      syncCommandCopied: true,
      usageSubmitted: true,
      webSyncConfirmed: true,
    })).toBe("activated");
  });

  it("strips private and high-cardinality fields from activation properties", () => {
    expect(sanitizeActivationProperties({
      surface: "onboarding",
      activation_state: "activated",
      is_authenticated: true,
      total_tokens: 1234,
      ccusage_agents: ["claude", "codex"],
      email: "user@example.com",
      prompt: "secret prompt",
      path: "/Users/someone/project",
      raw_usage_rows: [{ date: "2026-01-01" }],
    })).toEqual({
      surface: "onboarding",
      activation_state: "activated",
      is_authenticated: true,
      total_tokens: 1234,
      ccusage_agents: ["claude", "codex"],
    });
  });
});
