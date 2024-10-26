import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { getCardOrFail } from "@/koala/get-card-or-fail";
import { Quiz } from "./get-next-quizzes";
import { LessonType } from "../shared-types";
import { maybeGetCardImageUrl } from "../image";

export const getOneCard = procedure
  .input(
    z.object({
      id: z.number(),
    }),
  )
  .output(
    z.object({
      id: z.number(),
      definition: z.string(),
      term: z.string(),
      flagged: z.boolean(),
      quizzes: z.array(Quiz),
      imageURL: z.string().optional(),
    }),
  )
  .query(async ({ input, ctx }) => {
    const card = await getCardOrFail(input.id, ctx.user?.id);
    return {
      id: card.id,
      definition: card.definition,
      term: card.term,
      flagged: card.flagged,
      imageURL: await maybeGetCardImageUrl(card.imageBlobId),
      quizzes: card.Quiz.map((quiz) => {
        return {
          quizId: quiz.id,
          cardId: card.id,
          definition: card.definition,
          term: card.term,
          repetitions: quiz.repetitions,
          lapses: quiz.lapses,
          lessonType: quiz.quizType as LessonType,
          audio: "",
          translationAudioUrl: "",
          langCode: card.langCode,
          lastReview: quiz.lastReview,
        };
      }),
    };
  });
