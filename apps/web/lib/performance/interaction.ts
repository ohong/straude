"use client";

import posthog from "posthog-js";

type MeasureMetadata = Record<string, string | number | boolean | null>;

const PREFIX = "straude:interaction";

function markName(name: string, point: "start" | "ready") {
  return `${PREFIX}:${name}:${point}`;
}

export function markInteractionStart(name: string) {
  if (typeof performance === "undefined" || !performance.mark) return;
  performance.mark(markName(name, "start"));
}

export function markInteractionReady(name: string) {
  if (typeof performance === "undefined" || !performance.mark) return;
  performance.mark(markName(name, "ready"));
}

export function measureInteraction(
  name: string,
  metadata: MeasureMetadata = {},
): number | null {
  if (
    typeof performance === "undefined" ||
    !performance.measure ||
    !performance.getEntriesByName
  ) {
    return null;
  }

  const start = markName(name, "start");
  const ready = markName(name, "ready");
  const measure = `${PREFIX}:${name}`;

  try {
    performance.measure(measure, start, ready);
  } catch {
    return null;
  }

  const entry = performance.getEntriesByName(measure).at(-1);
  const duration = entry?.duration ?? null;

  if (duration === null) {
    return null;
  }

  const payload = { name, duration_ms: duration, ...metadata };

  if (posthog.__loaded) {
    posthog.capture("interaction_ready", payload);
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[performance] interaction_ready", payload);
  }

  return duration;
}
