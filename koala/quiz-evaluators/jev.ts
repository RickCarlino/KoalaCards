import { z } from "zod";
import type { JevRequest } from "../ai-jev";
import {
  gradingLabels,
  gradingPolicy,
  gradeExamples,
  gradeCriteria,
  type GradingLabel,
  type SpeakingGradingInput,
} from "./grading-policy";

export const jevGrades = gradingLabels;
export type JevGrade = GradingLabel;
const gradeSchema = z.enum(jevGrades);
const probabilitySchema = z.number().min(0).max(1);

export const jevQuestions: JevRequest["questions"] = {
  grade: {
    type: "choice",
    instructions: `${gradingPolicy} ${gradeExamples} Choose exactly one overall grade.`,
    criteria: gradeCriteria,
  },
  grammar_unnatural_wording: {
    type: "noul",
    instructions: `${gradingPolicy} Does this attempted Korean answer have a genuine grammar or unnatural-wording problem?`,
    criteria: {
      true: "A particle, conjugation, word-order, or expression problem merits correction, beyond the harmless differences the grading policy permits.",
      false:
        "Acceptable Korean, merely different phrasing or tense, an explicit give-up response, or insufficient text to identify a genuine language problem.",
    },
  },
  possible_transcription_issue: {
    type: "noul",
    instructions: `${gradingPolicy} Is there concrete textual evidence of a possible speech-to-text error in this response? This is a possibility, not a finding about what was spoken.`,
    criteria: {
      true: "A plausible phonetic confusion or garbled spelling suggests the transcript may differ from the spoken answer.",
      false:
        "No specific evidence of transcription trouble. Different wording, an ordinary wrong answer, or giving up is not sufficient evidence.",
    },
  },
};

export const buildJevRequest = (
  input: SpeakingGradingInput,
  model: string,
): JevRequest => ({
  model,
  state: {
    prompt: input.prompt,
    possibleAnswer: input.possibleAnswer,
    response: input.response,
    ...(input.deckName ? { deckName: input.deckName } : {}),
    ...(input.deckDescription
      ? { deckDescription: input.deckDescription }
      : {}),
  },
  questions: jevQuestions,
});

const noulSchema = z.object({
  type: z.literal("noul"),
  noul: probabilitySchema,
});

export const jevResponseSchema = z.object({
  model: z.string().min(1),
  answers: z.object({
    grade: z.object({
      type: z.literal("choice"),
      choice: gradeSchema,
      confidence: probabilitySchema,
      probabilities: z
        .record(gradeSchema, probabilitySchema)
        .refine(
          (values) =>
            Math.abs(
              Object.values(values).reduce(
                (sum, value) => sum + value,
                0,
              ) - 1,
            ) < 0.01,
          "Grade probabilities must sum to 1.",
        ),
    }),
    grammar_unnatural_wording: noulSchema,
    possible_transcription_issue: noulSchema,
  }),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
  }),
});

export type JevResponse = z.infer<typeof jevResponseSchema>;
