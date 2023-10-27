// Example Prometheus scrap config:
// ===============================
// scrape_configs:
//   - job_name: 'koala-app-metrics'
//     static_configs:
//       - targets: ['koala.example.xyz']
//     metrics_path: '/metrics'
//     scheme: 'https'
//     basic_auth:
//       username: 'Bearer'
//       password: 'secret123'
//     tls_config:
//       insecure_skip_verify: false  # Set this to false if you have a valid SSL certificate.

import { NextApiResponse, NextApiRequest } from "next";
import { collectDefaultMetrics, register } from "prom-client";

if (!(global as any).defaultMetricsInitialized) {
  collectDefaultMetrics();
  (global as any).defaultMetricsInitialized = true;
}

export default async function registerMetrics(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Check for the password in the request headers
  const authHeader = req.headers.authorization;

  if (!authHeader || authHeader !== `Bearer ${process.env.PROMETHEUS_SECRET}`) {
    return res.status(401).send("Unauthorized");
  }

  res.setHeader("Content-Type", register.contentType);
  res.end(await register.metrics());
}
