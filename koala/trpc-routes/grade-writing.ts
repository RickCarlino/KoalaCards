import { TRPCError } from "@trpc/server";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getLangName } from "../get-lang-name";
import { openai } from "../openai";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";

const ApiResponseSchema = z.object({
  fullCorrection: z.string(),
  feedback: z.array(z.string()),
});

const EssayResponseSchema = z.object({
  fullText: z.string(),
  fullCorrection: z.string(),
  feedback: z.array(z.string()),
});

export type FeedbackItem = string[];
export type ApiResponse = z.infer<typeof ApiResponseSchema>;
export type EssayResponse = z.infer<typeof EssayResponseSchema>;

const BASIC_CLEANUP_PROMPT = `You are a meticulous copyeditor. Correct only spelling, capitalization, spacing, and punctuation errors in the text provided. **Do not** change word choice, grammar, or style. **Output exactly the corrected text and nothing else.**`;

const ESSAY_GRADING_PROMPT = `You are a foreign-language instructor grading an essay.
Correct crucial grammar issues, word choice errors and unnatural wording.
Focus on substantive issues that would affect comprehension or correctness in the target language.

Output **exactly**:
\n\n\`\`\`json
{
  "fullCorrection": "<corrected text>",
  "feedback": ["<brief note on each substantive fix>"]
}
\`\`\`

For words marked \`?word?\`, translate to the target language in \`fullCorrection\` and add a feedback bullet of the form:
"Replaced '?word?' with the correct word: <translation>".`;

const inputSchema = z.object({
  text: z.string().min(1).max(2000),
  prompt: z.string(),
  deckId: z.number(),
});

export const gradeWriting = procedure
  .input(inputSchema)
  .output(EssayResponseSchema)
  .mutation(async (opts): Promise<EssayResponse> => {
    const { text, prompt, deckId } = opts.input;
    const user = opts.ctx.user;
    const userId = user?.id;

    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      });
    }

    const deck = await prismaClient.deck.findUnique({
      where: { id: deckId, userId },
      select: { langCode: true },
    });

    if (!deck) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Deck not found or user does not have access.",
      });
    }
    const { langCode } = deck;

    const cleanupResponse = await openai.beta.chat.completions.parse({
      model: "o3-mini",
      messages: [
        { role: "system", content: BASIC_CLEANUP_PROMPT },
        { role: "user", content: text },
      ],
    });

    const cleanedText =
      cleanupResponse.choices[0]?.message?.content?.trim();
    if (!cleanedText) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Cleanup step produced no output.",
      });
    }

    const gradingResponse = await openai.beta.chat.completions.parse({
      model: "o3-mini",
      response_format: zodResponseFormat(ApiResponseSchema, "essay"),
      messages: [
        { role: "system", content: ESSAY_GRADING_PROMPT },
        {
          role: "user",
          content: `Language: ${getLangName(
            langCode,
          )}\n\nText to analyze: ${cleanedText}`,
        },
      ],
    });

    const apiResponse = gradingResponse.choices[0]?.message?.parsed;
    if (!apiResponse) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Invalid response format from OpenAI.",
      });
    }

    await prismaClient.writingSubmission.create({
      data: {
        userId,
        deckId,
        prompt,
        submission: text,
        submissionCharacterCount: text.length,
        correction: apiResponse.fullCorrection,
        correctionCharacterCount: apiResponse.fullCorrection.length,
      },
    });

    return {
      fullText: text,
      fullCorrection: apiResponse.fullCorrection,
      feedback: apiResponse.feedback,
    };
  });
