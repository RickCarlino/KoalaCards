import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getLangName } from "../get-lang-name";
import { generateAIText, generateStructuredOutput } from "../ai";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";

/**
 * ----------------------------
 *  Schema definitions
 * ----------------------------
 */
const ApiResponseSchema = z.object({
  fullCorrection: z.string(),
  feedback: z.array(z.string()),
});

const EssayResponseSchema = z.object({
  fullText: z.string(),
  fullCorrection: z.string(),
  feedback: z.array(z.string()),
});

type EssayResponse = z.infer<typeof EssayResponseSchema>;

/**
 * ----------------------------
 *  Prompt definitions
 * ----------------------------
 */
const BASIC_CLEANUP_PROMPT = `You are a meticulous copy-editor. Correct only spelling, capitalization, spacing, and punctuation errors in the text provided. **Do not** change word choice, grammar, or style. **Output exactly the corrected text and nothing else.**`;

const ESSAY_GRADING_PROMPT = String.raw`
You are a certified native-speaker instructor grading a student essay written in the target language.

🔍 **Your mission**
Identify and correct only **objective errors** (grammar, conjugation, agreement, particles, clearly unnatural word choice) **and** phrasing that *collocates unnaturally* or mixes fixed expressions in a way a native speaker would find odd.  If the sentence is already correct and idiomatic, **leave it untouched** - do **not** paraphrase, reorder, or replace words merely for stylistic preference.
All explanations and feedback bullets must be written **in English**.

📏 **Rules**
1. Prefer the *smallest possible edit* that resolves the problem.  
   **1-B.** If a phrase is grammatically correct but *collocates unnaturally* (e.g., 잠이 푹 좋아졌어요), replace only the minimum words necessary so it sounds natural.
   **1-C.** If you change a word for collocation reasons, prefer the most common native phrasing (consult corpus frequency) rather than simply swapping synonyms.
2. Keep the author's tone, register, and vocabulary whenever they are acceptable.
3. Colloquial or creative phrasing is fine if natural; do not “formalize” unless the original register demands it.
4. When several variants are equally correct, keep the author's choice.
5. Never introduce personal style preferences (e.g., punctuation quirks, synonyms like "등" vs "같은").
6. Do **not** add or remove whole sentences.
7. If a word is wrapped like \`?word?\`, translate that word into the target language in the correction and add a feedback bullet (in English):  
   "Replaced '?word?' with the correct word: <translation>."

📤 **Output exactly**

{
  "fullCorrection": "<complete corrected essay in the target language>",
  "feedback": ["<one concise English note per substantive change>"]
}

Do **not** output anything else - no prose before or after the JSON block.`;

/**
 * ----------------------------
 *  Procedure definition
 * ----------------------------
 */
const inputSchema = z.object({
  text: z.string().min(1).max(2000),
  prompt: z.string(),
  deckId: z.number(),
});

export const gradeWriting = procedure
  .input(inputSchema)
  .output(EssayResponseSchema)
  .mutation(async ({ input, ctx }): Promise<EssayResponse> => {
    const { text, prompt, deckId } = input;
    const userId = ctx.user?.id;

    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      });
    }

    // 1️⃣ Verify deck ownership / language
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

    /**
     * 2️⃣ Basic cleanup - purely mechanical fixes
     */
    const cleanedText = await generateAIText({
      model: ["openai", "fast"] as const,
      messages: [
        { role: "system", content: BASIC_CLEANUP_PROMPT },
        { role: "user", content: text },
      ],
    });

    if (!cleanedText?.trim()) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Cleanup step produced no output.",
      });
    }

    /**
     * 3️⃣ Substantive grading - grammar + collocation checks
     */
    const feedback = await generateStructuredOutput({
      model: ["openai", "good"],
      schema: ApiResponseSchema,
      messages: [
        { role: "system", content: ESSAY_GRADING_PROMPT },
        {
          role: "user",
          content: `Language: ${getLangName(
            deck.langCode,
          )}\n\nText to analyze:\n${cleanedText.trim()}`,
        },
      ],
      maxTokens: 5000,
    });

    if (!feedback) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Invalid response format from AI model.",
      });
    }

    // 4️⃣ Persist submission & correction
    await prismaClient.writingSubmission.create({
      data: {
        userId,
        deckId,
        prompt,
        submission: text,
        submissionCharacterCount: text.length,
        correction: feedback.fullCorrection,
        correctionCharacterCount: feedback.fullCorrection.length,
      },
    });

    return {
      fullText: text,
      fullCorrection: feedback.fullCorrection,
      feedback: feedback.feedback,
    };
  });
