import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export class StudyToolError extends Error {}

const toolResultSchema = z.object({
  generatedAt: z.string().datetime(),
  result: z.record(z.string(), z.unknown()),
});

export const idSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
export const dateFilters = {
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
};

export function dateWhere(input: { from?: string; to?: string }) {
  if (
    input.from &&
    input.to &&
    Date.parse(input.from) >= Date.parse(input.to)
  ) {
    throw new StudyToolError(
      "from must be earlier than to. The end is exclusive.",
    );
  }
  return {
    ...(input.from ? { gte: new Date(input.from) } : {}),
    ...(input.to ? { lt: new Date(input.to) } : {}),
  };
}

export function appUrl(path: string) {
  return new URL(
    path,
    process.env.NEXTAUTH_URL || "https://app.koala.cards",
  ).toString();
}

export function requireRecord<T>(record: T | null): T {
  if (record === null) {
    throw new StudyToolError("Record not found in your account.");
  }
  return record;
}

export function registerStudyTool<S extends z.ZodRawShape>(
  server: McpServer,
  options: {
    name: string;
    title: string;
    description: string;
    input: z.ZodObject<S>;
    write?: boolean;
    destructive?: boolean;
    run: (
      input: z.infer<z.ZodObject<S>>,
    ) => Promise<Record<string, unknown>>;
  },
) {
  server.registerTool<typeof toolResultSchema, z.ZodObject<S>>(
    options.name,
    {
      title: options.title,
      description: options.description,
      inputSchema: options.input,
      outputSchema: toolResultSchema,
      annotations: {
        readOnlyHint: !options.write,
        destructiveHint: options.destructive ?? false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const result = await options.run(options.input.parse(args));
        const structuredContent = JSON.parse(
          JSON.stringify(
            {
              generatedAt: new Date().toISOString(),
              result,
            },
            (_key, value) =>
              typeof value === "bigint" ? value.toString() : value,
          ),
        );
        return {
          structuredContent,
          content: [
            { type: "text", text: JSON.stringify(structuredContent) },
          ],
        };
      } catch (error) {
        console.error(`MCP ${options.name} failed`);
        const text =
          error instanceof StudyToolError
            ? error.message
            : "Could not complete this request. No result is available; try again.";
        return { isError: true, content: [{ type: "text", text }] };
      }
    },
  );
}
