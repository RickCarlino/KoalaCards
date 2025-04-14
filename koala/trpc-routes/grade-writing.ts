import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { openai } from "../openai";
import { zodResponseFormat } from "openai/helpers/zod";

// Define the Zod schema for sentence grading
const SentenceGradeSchema = z.union([
  z.object({
    ok: z.literal(true),
    input: z.string(),
  }),
  z.object({
    ok: z.literal(false),
    input: z.string(),
    correction: z.string(),
    explanations: z.array(z.string()),
  }),
]);

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

export const gradeWriting = procedure
  .input(
    z.object({
      text: z.string().min(1),
      langCode: z.string().optional(),
    }),
  )
  .output(EssayResponseSchema)
  .mutation(async (opts): Promise<EssayResponse> => {
    const { text, langCode } = opts.input;
    const user = opts.ctx.user;

    if (!user) {
      throw new Error("User not authenticated");
    }
    // Call OpenAI to analyze the essay
    const response = await openai.beta.chat.completions.parse({
      messages: [
        {
          role: "system",
          content: ESSAY_GRADING_PROMPT,
        },
        {
          role: "user",
          content: `Language: ${
            langCode || "Unknown"
          }\n\nText to analyze: ${text}`,
        },
      ],
      // model: "o3-mini",
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 1024,
      response_format: zodResponseFormat(EssayResponseSchema, "essay"),
    });

    const parsedResponse = response.choices[0]?.message?.parsed;

    if (!parsedResponse) {
      throw new Error("Invalid response format from OpenAI.");
    }

    return parsedResponse;
  });
