import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { openai } from "../openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { prismaClient } from "../prisma-client"; // Added prisma client
import { TRPCError } from "@trpc/server"; // Added TRPCError
import { getLangName } from "../get-lang-name"; // Added getLangName

// Define the Zod schema for sentence grading
const SentenceGradeSchema = z.object({
  ok: z.literal(false),
  input: z.string(),
  correction: z.string(),
  explanations: z.array(z.string()),
});

// Schema for the complete response
const EssayResponseSchema = z.object({
  sentences: z.array(SentenceGradeSchema),
});

// Export types derived from the schema
export type SentenceGrade = z.infer<typeof SentenceGradeSchema>;
export type EssayResponse = z.infer<typeof EssayResponseSchema>;

// Define the system prompt for essay grading
const ESSAY_GRADING_PROMPT = `You are an AI language tutor helping foreign language learners improve their writing skills.

Analyze the provided essay or sentences in the target language and provide detailed feedback.
Only provide REQUIRED feedback, not nice-to-have feedback.

For each sentence in the input:
1. Determine if it's grammatically correct.
2. If correct, mark it as "ok: true".
3. If incorrect:
   - Mark it as "ok: false"
   - The corrected version
   - A list of clear, concise explanations of errors and how to fix them in English.
     NOTE: For spelling, capitalization, spacing and punctuation errors, just fix them and leave a bullet that says "Spelling and punctuation fixes."
4. If a word is surrounded by question marks (e.g., "?apple?"), treat it as an unknown word the user replaced with English.
   - Translate the English word (e.g., "apple") into the target language, ensuring it fits grammatically and contextually within the sentence.
   - Provide the corrected sentence with the translated word.
   - Include an explanation bullet point like: "Replaced '?apple?' with the correct word: [translated word]".
   - Mark the sentence as "ok: false" because the user didn't know the word.

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
      response_format: zodResponseFormat(EssayResponseSchema, "essay"),
    });

    const parsedResponse = response.choices[0]?.message?.parsed;

    if (!parsedResponse) {
      // Use TRPCError for better error propagation
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Invalid response format from OpenAI.",
      });
    }

    // Calculate submission character count
    const submissionCharacterCount = text.length;

    // Process response to reconstruct the full corrected text
    let fullCorrection = "";
    fullCorrection = parsedResponse.sentences
      .map((sentence) => {
        if (sentence.ok) {
          return sentence.input;
        } else {
          // Ensure correction exists, fallback to input if not (shouldn't happen with schema)
          return sentence.correction ?? sentence.input;
        }
      })
      .join(" "); // Join sentences with a space, adjust if needed based on language/formatting

    // Calculate correction character count
    const correctionCharacterCount = fullCorrection.length;

    await prismaClient.writingSubmission.create({
      data: {
        userId,
        deckId,
        prompt,
        submission: text,
        submissionCharacterCount,
        correction: fullCorrection,
        correctionCharacterCount,
        // createdAt is handled by @default(now())
      },
    });

    // Return the structured feedback from OpenAI
    return parsedResponse;
  });
