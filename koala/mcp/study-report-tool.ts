import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getStudyReport } from "@/koala/study-report";

const outcomeSchema = z.object({
  id: z.number().int(),
  cardId: z.number().int(),
  term: z.string(),
  definition: z.string(),
  userInput: z.string(),
  isAcceptable: z.boolean(),
  grade: z.string().nullable(),
  reason: z.string(),
  createdAt: z.string().datetime(),
});

export const studyReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  writingSamples: z.array(
    z.object({
      id: z.number().int(),
      prompt: z.string(),
      submission: z.string(),
      createdAt: z.string().datetime(),
    }),
  ),
  wrongOutcomes: z.array(outcomeSchema),
  correctOutcomes: z.array(outcomeSchema),
  recentHighlights: z.array(
    z.object({
      key: z.string(),
      selectedText: z.string(),
      createdAt: z.string().datetime(),
      context: z.string(),
      source: z.string(),
    }),
  ),
});

export function registerStudyReportTool(
  server: McpServer,
  userId: string,
) {
  server.registerTool(
    "get_study_report",
    {
      title: "Get study report",
      description:
        "Read the connected learner's current Koala Cards study report for language coaching. " +
        "Includes recent writing, highlights, and latest correct and incorrect card answers. " +
        "This is a rolling snapshot, not a daily activity log. generatedAt is the time of this fetch; " +
        "compare record IDs and createdAt timestamps to identify new activity.",
      inputSchema: z.object({}).strict(),
      outputSchema: studyReportSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const startedAt = Date.now();
      try {
        const report = studyReportSchema.parse(
          await getStudyReport(userId),
        );
        console.info("MCP get_study_report succeeded", {
          generatedAt: report.generatedAt,
          durationMs: Date.now() - startedAt,
        });
        return {
          structuredContent: report,
          content: [{ type: "text", text: JSON.stringify(report) }],
        };
      } catch {
        console.error("MCP get_study_report failed");
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Could not load the study report. Try again.",
            },
          ],
        };
      }
    },
  );
}
