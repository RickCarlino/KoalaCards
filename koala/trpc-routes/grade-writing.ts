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

const ESSAY_GRADING_PROMPT = `
You are a foreign language instructor grading an essay from a student learning a foreign language.
Correct only crucial grammar or wording errors- leave style intact and only change word choice if it is awkward or wrong.

Output **exactly**:

\`\`\`json
{
  "fullCorrection": "<corrected text>",
  "feedback": ["<brief note on each substantive fix, but not for silent fixes (see note)>"]
}
\`\`\`

Silent fixes: spelling, caps, spacing, punctuation (give no feedback for these).
For words marked \`?word?\`, translate to the target language in \`fullCorrection\` and add a feedback bullet:
\`"Replaced '?word?' with the correct word: <translation>"\`.
`;

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

    const response = await openai.beta.chat.completions.parse({
      messages: [
        {
          role: "system",
          content: ESSAY_GRADING_PROMPT,
        },
        {
          role: "user",
          content: `Language: ${getLangName(
            langCode,
          )}\n\nText to analyze: ${text}`,
        },
      ],
      model: "o3-mini",

      response_format: zodResponseFormat(ApiResponseSchema, "essay"),
    });

    const apiResponse = response.choices[0]?.message?.parsed;

    if (!apiResponse) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Invalid response format from OpenAI.",
      });
    }

    const submissionCharacterCount = text.length;

    const correctionCharacterCount = apiResponse.fullCorrection.length;

    await prismaClient.writingSubmission.create({
      data: {
        userId,
        deckId,
        prompt,
        submission: text,
        submissionCharacterCount,
        correction: apiResponse.fullCorrection,
        correctionCharacterCount,
      },
    });

    const completeResponse: EssayResponse = {
      fullText: text,
      fullCorrection: apiResponse.fullCorrection,
      feedback: apiResponse.feedback,
    };

    return completeResponse;
  });
