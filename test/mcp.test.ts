import { withMcp } from "./mcp-helpers.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { studyReportSchema } from "../koala/mcp/study-report-tool.ts";
import { prismaClient } from "../koala/prisma-client.ts";
import {
  disableStudyReportLink,
  saveStudyReportLink,
} from "../koala/study-report-link-server.ts";
import { getMcpPath } from "../koala/study-report-link.ts";

test.after(() => prismaClient.$disconnect());

test("MCP client discovers tools and receives fresh, isolated study reports", async () => {
  await withMcp(async ({ ownerId, otherId, connect, token }) => {
    await prismaClient.writingSubmission.createMany({
      data: [ownerId, otherId].map((userId, index) => ({
        userId,
        prompt: "Daily writing",
        submission:
          index === 0
            ? "Owner's writing"
            : "Other learner's private writing",
        correction: "Private correction",
        submissionCharacterCount: 15,
        correctionCharacterCount: 18,
      })),
    });
    const client = await connect();
    assert.equal(client.getServerVersion()?.name, "koala-cards");
    const { tools } = await client.listTools();
    assert.deepEqual(
      tools.map((tool) => tool.name),
      [
        "get_study_report",
        "get_study_overview",
        "list_quiz_events",
        "search_study_data",
        "fetch_study_record",
        "list_due_cards",
        "create_cards",
        "import_highlights",
        "edit_card",
      ],
    );
    assert.deepEqual(tools[0].annotations, {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
    assert.ok(tools[0].outputSchema);
    assert.equal(tools[0].inputSchema.additionalProperties, false);
    const startedAt = Date.now();
    const result = await client.callTool({
      name: "get_study_report",
      arguments: {},
    });
    assert.notEqual(result.isError, true);
    const report = studyReportSchema.parse(result.structuredContent);
    assert.equal(report.writingSamples[0].submission, "Owner's writing");
    assert.ok(Date.parse(report.generatedAt) >= startedAt);
    const content = result.content as { type: string; text: string }[];
    assert.deepEqual(JSON.parse(content[0].text), report);
    const serialized = JSON.stringify(result);
    for (const excluded of [
      otherId,
      ownerId,
      token,
      "Other learner's private writing",
      "Private correction",
    ]) {
      assert.equal(serialized.includes(excluded), false, excluded);
    }
    const second = await client.callTool({
      name: "get_study_report",
      arguments: {},
    });
    const nextReport = studyReportSchema.parse(second.structuredContent);
    assert.notEqual(nextReport.generatedAt, report.generatedAt);
    assert.deepEqual(nextReport.writingSamples, report.writingSamples);
    const otherLink = await saveStudyReportLink(otherId);
    const otherClient = await connect(otherLink.token);
    const otherResult = await otherClient.callTool({
      name: "get_study_report",
    });
    assert.equal(
      studyReportSchema.parse(otherResult.structuredContent)
        .writingSamples[0].submission,
      "Other learner's private writing",
    );
  });
});

test("MCP checks revocation on existing clients and accepts regenerated connections", async () => {
  await withMcp(async ({ ownerId, connect }) => {
    const client = await connect();
    const replacement = await saveStudyReportLink(ownerId, true);
    await assert.rejects(
      client.callTool({ name: "get_study_report" }),
      /Connection not found/,
    );
    const replacementClient = await connect(replacement.token);
    assert.equal((await replacementClient.listTools()).tools.length, 9);
    await disableStudyReportLink(ownerId);
    await assert.rejects(
      replacementClient.callTool({ name: "get_study_report" }),
      /Connection not found/,
    );
  });
});

test("MCP rejects tool arguments that could change ownership and unknown tools", async () => {
  await withMcp(async ({ otherId, connect }) => {
    const client = await connect();
    const result = await client.callTool({
      name: "get_study_report",
      arguments: { userId: otherId },
    });
    assert.equal(result.isError, true);
    const unknown = await client.callTool({
      name: "delete_cards",
      arguments: {},
    });
    assert.equal(unknown.isError, true);
  });
});

test("MCP enforces token access, origin and protocol headers without sessions or caching", async () => {
  await withMcp(async ({ url }) => {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });
    const call = (extraHeaders = {}, extraBody = body) =>
      fetch(url, {
        method: "POST",
        headers: { ...headers, ...extraHeaders },
        body: extraBody,
      });
    const response = await call({ Origin: "https://chatgpt.com" });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("mcp-session-id"), null);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(
      response.headers.get("x-robots-tag"),
      "noindex, nofollow, noarchive",
    );
    assert.equal(
      (await response.json()).result.tools[0].name,
      "get_study_report",
    );
    assert.equal(
      (await call({ Origin: "https://untrusted.example" })).status,
      403,
    );
    assert.equal(
      (await call({ "Content-Type": "text/plain" })).status,
      415,
    );
    assert.equal((await call({ Accept: "text/html" })).status, 406);
    assert.equal((await call({}, "{")).status, 400);
    assert.equal(
      (await call({ "MCP-Protocol-Version": "1900-01-01" })).status,
      400,
    );
    for (const token of ["invalid", "a".repeat(64)]) {
      const denied = await fetch(new URL(getMcpPath(token), url), {
        method: "POST",
        headers,
        body,
      });
      assert.equal(denied.status, 404);
      assert.equal(
        (await denied.json()).error.message,
        "Connection not found",
      );
    }
    for (const method of ["GET", "DELETE", "PUT", "HEAD"]) {
      const denied = await fetch(url, { method });
      assert.equal(denied.status, 405);
      assert.equal(denied.headers.get("allow"), "POST");
    }
    const notification = await call(
      {},
      JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    );
    assert.equal(notification.status, 202);
  });
});
