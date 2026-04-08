import { PostHog } from "posthog-node";

const apiKey = process.env.POSTHOG_API_KEY;
const host = process.env.POSTHOG_HOST;

// No-op stub used when the API key is absent (e.g. user's machine after npm install)
const noop = new Proxy({} as PostHog, {
  get: () => () => Promise.resolve(),
});

// For short-lived CLI processes: flush immediately after every event
export const posthog: PostHog = apiKey
  ? new PostHog(apiKey, {
      host,
      flushAt: 1,
      flushInterval: 0,
      enableExceptionAutocapture: true,
    })
  : noop;
