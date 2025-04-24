import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { openai } from "../openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { prismaClient } from "../prisma-client"; // Added prisma client
import { TRPCError } from "@trpc/server"; // Added TRPCError
import { getLangName } from "../get-lang-name"; // Added getLangName

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

const ESSAY_GRADING_PROMPT = `You are an AI language tutor helping foreign language learners improve their writing skills.

Analyze the provided essay or sentences in the target language and provide detailed feedback.
Only provide REQUIRED feedback, not nice-to-have feedback.

I want you to return a response object with only:
1. fullCorrection: The fully corrected text
2. feedback: An array of written feedback explaining individual corrections (see my note about typos below)

DO NOT include the original full text in your response as we already have it.

Use the feedback array as a list of clear, concise explanations of errors and how to fix them in English (explanations)
NOTE: For spelling, capitalization, spacing and punctuation errors, just fix them and leave a bullet that says "Spelling and punctuation fixes."
It's really annoying for the user to see 10 "Spacing and punctuation fixes" bullet points.

If a word is surrounded by question marks (e.g., "?apple?"), treat it as an unknown word the user replaced with English:
- Translate the English word (e.g., "apple") into the target language, ensuring it fits grammatically and contextually within the sentence
- Provide the corrected sentence with the translated word
- Include an explanation bullet point like: "Replaced '?apple?' with the correct word: [translated word]"

Only include feedback for sentences that need correction. Grammatically correct sentences should not appear in the feedback array.

Focus on grammar, vocabulary, and natural phrasing. Be encouraging and educational in your explanations.
Double check your work against the guidelines before submitting.`;

// Updated input schema
const inputSchema = z.object({
  text: z.string().min(1).max(2000), // Added max length for submission
  prompt: z.string(), // Added prompt
  deckId: z.number(), // Added deckId, removed langCode
});

export const gradeWriting = procedure
  .input(inputSchema) // Use updated schema
  .output(EssayResponseSchema)
  .mutation(async (opts): Promise<EssayResponse> => {
    const { text, prompt, deckId } = opts.input; // Use updated input fields
    const user = opts.ctx.user;
    const userId = user?.id; // Get userId directly

    if (!userId) {
      // Use TRPCError for better client-side handling
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      });
    }

    // Fetch the deck to verify ownership and get langCode
    const deck = await prismaClient.deck.findUnique({
      where: { id: deckId, userId },
      select: { langCode: true }, // Only select langCode
    });

    if (!deck) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Deck not found or user does not have access.",
      });
    }
    const { langCode } = deck; // Extract langCode

    // Call OpenAI to analyze the essay
    const response = await openai.beta.chat.completions.parse({
      messages: [
        {
          role: "system",
          content: ESSAY_GRADING_PROMPT,
        },
        {
          role: "user",
          // Use fetched langCode and getLangName for clarity in the prompt
          content: `Language: ${getLangName(
            langCode,
          )}\n\nText to analyze: ${text}`,
        },
      ],
      model: "gpt-4.1",
      // reasoning_effort: "low",
      // model: "gpt-4.1-nano",
      // temperature: 0.3,
      // max_tokens: 1024,
      response_format: zodResponseFormat(ApiResponseSchema, "essay"),
    });

    const apiResponse = response.choices[0]?.message?.parsed;

    if (!apiResponse) {
      // Use TRPCError for better error propagation
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Invalid response format from OpenAI.",
      });
    }

    // Calculate submission character count
    const submissionCharacterCount = text.length;

    // Calculate correction character count
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
        // createdAt is handled by @default(now())
      },
    });

    // Construct the complete response including the original text
    const completeResponse: EssayResponse = {
      fullText: text,
      fullCorrection: apiResponse.fullCorrection,
      feedback: apiResponse.feedback,
    };

    // Return the structured feedback to the client
    return completeResponse;
  });
