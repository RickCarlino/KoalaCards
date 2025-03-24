import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { openai } from "../openai";
import { errorReport } from "../error-report";

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
    explanation: z.string(),
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

For each sentence in the input:
1. Determine if it's grammatically correct.
2. If correct, mark it as "ok: true".
3. If incorrect, provide:
   - The corrected version
   - A clear, concise explanation of the error and how to fix it
   - Mark it as "ok: false"

Format your response as a valid JSON object with the following structure:
{
  "sentences": [
    {
      "ok": true,
      "input": "Original correct sentence"
    },
    {
      "ok": false,
      "input": "Original incorrect sentence",
      "correction": "Corrected sentence",
      "explanation": "Explanation of the error"
    }
  ]
}

Focus on grammar, vocabulary, and natural phrasing. Be encouraging and educational in your explanations.`;

export const gradeWriting = procedure
  .input(
    z.object({
      text: z.string().min(1),
      langCode: z.string().optional(),
    })
  )
  .output(EssayResponseSchema)
  .mutation(async (opts): Promise<EssayResponse> => {
    const { text, langCode } = opts.input;
    const user = opts.ctx.user;

    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      // Call OpenAI to analyze the essay
      const response = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: ESSAY_GRADING_PROMPT,
          },
          {
            role: "user",
            content: `Language: ${langCode || "Unknown"}\n\nText to analyze: ${text}`,
          },
        ],
        model: "gpt-4o",
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      try {
        // Parse the JSON response
        const parsedResponse = JSON.parse(content) as EssayResponse;
        
        // Validate the response structure
        if (!Array.isArray(parsedResponse.sentences)) {
          throw new Error("Invalid response format from OpenAI");
        }

        // Validate each sentence against the schema
        const validatedResponse = EssayResponseSchema.parse(parsedResponse);
        return validatedResponse;
      } catch (parseError) {
        errorReport(`Failed to parse OpenAI response: ${parseError}`);
        return {
          sentences: [
            {
              ok: false,
              input: text,
              correction: text,
              explanation: "Sorry, there was an error analyzing your text. Please try again.",
            },
          ],
        };
      }
    } catch (error) {
      errorReport(`Error in gradeWriting: ${error}`);
      return {
        sentences: [
          {
            ok: false,
            input: text,
            correction: text,
            explanation: "Sorry, there was an error analyzing your text. Please try again.",
          },
        ],
      };
    }
  });
