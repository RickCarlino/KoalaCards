import { z } from "zod";

const Quiz = z.object({
  cardId: z.number(),
  definition: z.string(),
  term: z.string(),
  repetitions: z.number(),
  lapses: z.number(),
  lessonType: z.union([
    z.literal("speaking"),
    z.literal("new"),
    z.literal("remedial"),
  ]),
  definitionAudio: z.string(),
  termAndDefinitionAudio: z.string(),
  langCode: z.string(),
  lastReview: z.number(),
  imageURL: z.string().optional(),
  stability: z.number(),
  difficulty: z.number(),
});

export const QuizList = z.object({
  quizzes: z.array(Quiz),
  totalCards: z.number(),
  quizzesDue: z.number(),
  newCards: z.number(),
});

export const QuizInput = z.object({
  take: z.number(),
  deckId: z.number(),
});
