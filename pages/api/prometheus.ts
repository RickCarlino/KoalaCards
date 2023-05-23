import { NextApiResponse } from "next";
import {
  Counter,
  CounterConfiguration,
  collectDefaultMetrics,
  register,
} from "prom-client";

if (!(global as any).defaultMetricsInitialized) {
  collectDefaultMetrics();
  (global as any).defaultMetricsInitialized = true;
}

// Export a middleware function to expose a /metrics endpoint
export default async function (_: unknown, res: NextApiResponse) {
  res.setHeader("Content-Type", register.contentType);
  res.end(await register.metrics());
}
