import { z } from "zod";
import {
  REVIEW_TAKE_MAX,
  REVIEW_TAKE_MIN,
} from "@/koala/settings/review-take";

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
  termAudio: z.string(),
  langCode: z.string(),
  lastReview: z.number(),
  nextReview: z.number(),
  imageURL: z.string().optional(),
  stability: z.number(),
  difficulty: z.number(),
  scheduler: z.object({
    deckId: z.number(),
    configId: z.number(),
    requestedRetention: z.number(),
    parameters: z.object({
      request_retention: z.number(),
      maximum_interval: z.number(),
      w: z.array(z.number()),
      enable_fuzz: z.boolean(),
      enable_short_term: z.boolean(),
      learning_steps: z.array(z.string()),
      relearning_steps: z.array(z.string()),
    }),
    flags: z.object({
      enable_fuzz: z.boolean(),
      enable_short_term: z.boolean(),
    }),
    tsFsrsVersion: z.string(),
    updatedAt: z.string(),
    cacheKey: z.string(),
  }),
});

export const QuizList = z.object({
  quizzes: z.array(Quiz),
  totalCards: z.number(),
  quizzesDue: z.number(),
  newCards: z.number(),
});

export const QuizInput = z.object({
  take: z.number().int().min(REVIEW_TAKE_MIN).max(REVIEW_TAKE_MAX),
  deckId: z.number(),
});
