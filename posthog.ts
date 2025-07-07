import { PostHog } from "posthog-node";

// TODO: use ENVs - why does this not work in NorthFlank?
const NEXT_PUBLIC_POSTHOG_KEY =
  "phc_1P2p1T7Neq6KQ2brenIAWZFaSRnpzXpz4SQsDuVuuYS";
const NEXT_PUBLIC_POSTHOG_HOST = "https://us.i.posthog.com";

export default function PostHogClient() {
  const posthogClient = new PostHog(NEXT_PUBLIC_POSTHOG_KEY, {
    host: NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
  return posthogClient;
}
