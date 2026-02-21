import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { generateStructuredOutput } from "../ai";
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

type EssayResponse = z.infer<typeof EssayResponseSchema>;
const PracticeModeSchema = z.enum(["writing", "speaking"]);
type PracticeMode = z.infer<typeof PracticeModeSchema>;

const ESSAY_GRADING_PROMPT = String.raw`
You are a Korean language instructor. Grade the student's Korean writing for correctness, not style.

- Fix spelling, spacing, punctuation, and obvious typos silently in the correction; never mention them in feedback.
- Change only objective errors: grammar, conjugation, agreement, particles that are required, or clearly unnatural collocations. If the sentence works as-is, leave it. Do not add optional particles (e.g., 를/을) or rephrase to "sound better."
- Keep tone/register and sentence order; never add or remove sentences.
- If text contains ?word?, replace it with the best Korean equivalent and add one feedback bullet in English: "Replaced '?word?' with: <translation>."
- Feedback bullets: English only, include **only** substantive grammar/word-choice/collocation fixes (including ?word? replacements). Omit bullets for spelling, spacing, punctuation, or standard spelling changes. Keep bullets short; max 6.

Return JSON only:
{
  "fullCorrection": "<corrected Korean text>",
  "feedback": ["<one concise English note per real correction>"]
}`;

const SPEAKING_GRADING_PROMPT = String.raw`
You are a Korean language instructor. Grade the student's Korean speaking practice from an automatic speech transcription.

- The input is transcribed speech, so do not penalize spacing, punctuation, capitalization, filler artifacts, or minor transcription noise. Do not mention spacing/punctuation issues in feedback.
- Focus only on objective language issues: grammar, conjugation, required particles, agreement, or clearly wrong word choice/collocation.
- Keep the student's meaning, tone/register, and sentence order; never add or remove sentences.
- Feedback bullets: English only, include only substantive grammar/word-choice/collocation fixes. Keep bullets short; max 6.

Return JSON only:
{
  "fullCorrection": "<corrected Korean text>",
  "feedback": ["<one concise English note per real correction>"]
}`;

const getGradingPrompt = (practiceMode: PracticeMode): string => {
  if (practiceMode === "speaking") {
    return SPEAKING_GRADING_PROMPT;
  }
  return ESSAY_GRADING_PROMPT;
};

const getSubmissionSource = (practiceMode: PracticeMode): string => {
  if (practiceMode === "speaking") {
    return "Speech transcription";
  }
  return "Typed writing";
};

const inputSchema = z.object({
  text: z.string().min(1).max(2000),
  prompt: z.string(),
  practiceMode: PracticeModeSchema.default("writing"),
});

export const gradeWriting = procedure
  .input(inputSchema)
  .output(EssayResponseSchema)
  .mutation(async ({ input, ctx }): Promise<EssayResponse> => {
    const { text, prompt, practiceMode } = input;
    const userId = ctx.user?.id;

    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      });
    }

    const feedback = await generateStructuredOutput({
      model: "good",
      schema: ApiResponseSchema,
      messages: [
        { role: "system", content: getGradingPrompt(practiceMode) },
        {
          role: "user",
          content: [
            `Language: Korean`,
            `Submission source: ${getSubmissionSource(practiceMode)}`,
            prompt ? `Prompt context: ${prompt}` : null,
            `Text to analyze:\n${text.trim()}`,
          ]
            .filter(Boolean)
            .join("\n\n"),
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

    await prismaClient.writingSubmission.create({
      data: {
        userId,
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
