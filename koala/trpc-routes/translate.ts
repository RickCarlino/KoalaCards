import { z } from "zod";
import { generateAIText } from "../ai";
import { procedure } from "../trpc-procedure";
import { TRPCError } from "@trpc/server";

const inputSchema = z.object({
  text: z.union([z.string(), z.array(z.string())]),
  targetLangCode: z.literal("en"),
});

const outputSchema = z.union([z.string(), z.array(z.string())]);

export const translate = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not found",
      });
    }

    const { text } = input;

    const textsToTranslate = Array.isArray(text) ? text : [text];
    if (
      textsToTranslate.length === 0 ||
      textsToTranslate.every((t) => !t.trim())
    ) {
      return Array.isArray(text) ? [] : "";
    }

    const systemPrompt = `Translate the following text accurately to English. Preserve the original meaning and tone. If multiple texts are provided (separated by '---'), translate each one individually and return them separated by '---'. Do not add any extra commentary or explanation.

Text to translate:
---
${textsToTranslate.join("\n---\n")}
---`;

    try {
      const rawTranslation =
        (await generateAIText({
          model: ["openai", "fast"] as const,
          messages: [{ role: "system", content: systemPrompt }],
        })) || "";
      const translatedTexts = rawTranslation
        .split("---")
        .map((t) => t.trim())
        .filter((t) => t);

      if (Array.isArray(text)) {
        if (translatedTexts.length === textsToTranslate.length) {
          return translatedTexts;
        } else {
          console.warn(
            "Translation output split mismatch, returning joined string.",
          );
          return [rawTranslation];
        }
      } else {
        return translatedTexts[0] || "";
      }
    } catch (error) {
      console.error("Error during translation:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to translate text.",
        cause: error,
      });
    }
  });
