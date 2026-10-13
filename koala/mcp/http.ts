import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createKoalaMcpServer } from "@/koala/mcp/server";
import { getStudyReportOwner } from "@/koala/study-report-link-server";

function sendError(res: ServerResponse, status: number, message: string) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32000, message },
    }),
  );
}

function isAllowedOrigin(origin: string | undefined) {
  if (!origin) {
    return true;
  }
  const appOrigin = new URL(
    process.env.NEXTAUTH_URL || "http://localhost:3000",
  ).origin;
  return [appOrigin, "https://chatgpt.com"].includes(origin);
}

async function handleAuthorizedRequest(
  req: IncomingMessage,
  res: ServerResponse,
  token: unknown,
  parsedBody?: unknown,
) {
  if (!isAllowedOrigin(req.headers.origin)) {
    sendError(res, 403, "Origin not allowed");
    return;
  }
  const userId = await getStudyReportOwner(token);
  if (!userId) {
    sendError(res, 404, "Connection not found");
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendError(res, 405, "Method not allowed");
    return;
  }

  const server = createKoalaMcpServer(userId);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, parsedBody);
  } finally {
    await server.close();
  }
}

export async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  token: unknown,
  parsedBody?: unknown,
) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("Referrer-Policy", "no-referrer");
  try {
    await handleAuthorizedRequest(req, res, token, parsedBody);
  } catch {
    console.error("MCP request failed");
    if (!res.headersSent) {
      sendError(res, 500, "Could not process the request. Try again.");
    }
  }
}
