import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import assert from "node:assert/strict";
import { handleMcpRequest } from "../koala/mcp/http.ts";
import { prismaClient } from "../koala/prisma-client.ts";
import { saveStudyReportLink } from "../koala/study-report-link-server.ts";
import { getMcpPath } from "../koala/study-report-link.ts";

export type Fixture = {
  ownerId: string;
  otherId: string;
  token: string;
  url: URL;
  connect: (token?: string) => Promise<Client>;
};

export async function withMcp(run: (fixture: Fixture) => Promise<void>) {
  const [ownerId, otherId] = [randomUUID(), randomUUID()];
  await prismaClient.user.createMany({
    data: [ownerId, otherId].map((id) => ({ id })),
  });
  const clients: Client[] = [];
  const http = createServer((req, res) => {
    const token = new URL(req.url!, "http://localhost").pathname
      .split("/")
      .pop();
    void handleMcpRequest(req, res, token);
  });
  try {
    http.listen(0, "127.0.0.1");
    await once(http, "listening");
    const address = http.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    const { token } = await saveStudyReportLink(ownerId);
    const connect = async (linkToken = token) => {
      const client = new Client({
        name: "koala-mcp-test",
        version: "1.0.0",
      });
      clients.push(client);
      await client.connect(
        new StreamableHTTPClientTransport(
          new URL(getMcpPath(linkToken), base),
        ),
      );
      return client;
    };
    await run({
      ownerId,
      otherId,
      token,
      url: new URL(getMcpPath(token), base),
      connect,
    });
  } finally {
    await Promise.all(clients.map((client) => client.close()));
    await new Promise<void>((resolve, reject) => {
      http.close((error) => (error ? reject(error) : resolve()));
      http.closeAllConnections();
    });
    await prismaClient.user.deleteMany({
      where: { id: { in: [ownerId, otherId] } },
    });
  }
}
