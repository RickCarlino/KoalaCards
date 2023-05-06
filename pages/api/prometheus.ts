import { NextApiResponse } from "next";
import {
  Counter,
  CounterConfiguration,
  collectDefaultMetrics,
  register,
} from "prom-client";

const getOrCreateCounter = <T extends string>(
  i: CounterConfiguration<T>
): Counter<T> => {
  const existingMetric = register.getSingleMetric("seconds_spoken_total");

  if (existingMetric) {
    return existingMetric as Counter<T>;
  }

  return new Counter(i);
};

// Create a custom counter metric for counting HTTP requests
export const minutesSpoken = getOrCreateCounter({
  name: "seconds_spoken_total",
  help: "Total number of seconds that a user has spoken.",
  labelNames: ["user_id"],
});
if (!(global as any).defaultMetricsInitialized) {
  collectDefaultMetrics();
  (global as any).defaultMetricsInitialized = true;
}

// Export a middleware function to expose a /metrics endpoint
export default async function (_: unknown, res: NextApiResponse) {
  res.setHeader("Content-Type", register.contentType);
  res.end(await register.metrics());
}
