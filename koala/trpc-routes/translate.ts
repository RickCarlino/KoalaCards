import { z } from "zod";
import { openai } from "../openai";
import { procedure } from "../trpc-procedure";
import { TRPCError } from "@trpc/server";

// Input can be a single string or an array of strings
const inputSchema = z.object({
  text: z.union([z.string(), z.array(z.string())]),
  targetLangCode: z.literal("en"), // Currently only supporting English translation
});

// Output will match the input type (string or array of strings)
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

    // Handle both single string and array input
    const textsToTranslate = Array.isArray(text) ? text : [text];
    if (
      textsToTranslate.length === 0 ||
      textsToTranslate.every((t) => !t.trim())
    ) {
      return Array.isArray(text) ? [] : ""; // Return empty based on input type
    }

    const systemPrompt = `Translate the following text accurately to English. Preserve the original meaning and tone. If multiple texts are provided (separated by '---'), translate each one individually and return them separated by '---'. Do not add any extra commentary or explanation.

Text to translate:
---
${textsToTranslate.join("\n---\n")}
---`;

    try {
      const aiResponse = await openai.beta.chat.completions.parse({
        model: "o4-mini", // Use a cost-effective model for translation
        reasoning_effort: "low",
        messages: [{ role: "system", content: systemPrompt }],
      });

      const rawTranslation = aiResponse.choices[0].message.content || "";
      const translatedTexts = rawTranslation
        .split("---")
        .map((t) => t.trim())
        .filter((t) => t);

      // Return result matching the input format
      if (Array.isArray(text)) {
        // Ensure the output array length matches the input array length if possible
        if (translatedTexts.length === textsToTranslate.length) {
          return translatedTexts;
        } else {
          // Fallback if splitting doesn't match perfectly (e.g., AI added extra '---')
          // Return the raw joined string in this case, or handle more gracefully
          console.warn(
            "Translation output split mismatch, returning joined string.",
          );
          return [rawTranslation]; // Or potentially throw an error
        }
      } else {
        return translatedTexts[0] || ""; // Return the first element or empty string
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
