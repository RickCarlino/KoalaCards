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
You are an AI writing assistant in a language learning app.
Your task is to provide feedback on a learner's writing submission.

Return **only** this JSON:

{
  "fullCorrection": "<corrected text>",
  "feedback": ["<brief explanation 1>", "..."]
}

Guidelines ▼

* You'll receive the learner's draft **and** a topic *prompt* for context.
* **fullCorrection** → fully polished version (omit the original).
* **feedback** → bullets in English for every fix; skip perfect sentences.
* If the fix is just spelling / caps / spacing / punctuation, DO NOT make comments about it in the feedback section.
* Fix spelling / capitalization / punctuation issues, but do not add feedback for these items.
* You will be penalized for saying things like "adjusted spelling" or "corrected spacing" etc... Just make the correction and move on.
* For words wrapped in \`?word?\`: translate the English word to the target language, insert it, and add a bullet like:
    \`"Replaced '?apple?' with the correct word: 사과"\`
* Prioritize grammar, vocabulary, and natural fluency.
* Maintain the writer's tone and formality level.
* Focus on strictly necessary changes rather than stylistic ones.
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
