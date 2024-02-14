import { createCardsFromText } from "@/utils/create-cards-from-text";
import { z } from "zod";
import { procedure, router } from "../trpc";
import { bulkCreateCards } from "./bulk-create-cards";
import { deleteCard } from "./delete-card";
import { deleteFlaggedCards } from "./delete-flagged-card";
import { editCard } from "./edit-card";
import { editUserSettings } from "./edit-user-settings";
import { exportCards } from "./export-cards";
import { faucet } from "./faucet";
import { flagCard } from "./flag-card";
import { getAllCards } from "./get-all-cards";
import { getNextQuiz, getNextQuizzes } from "./get-next-quizzes";
import { getOneCard } from "./get-one-card";
import { getUserSettings } from "./get-user-settings";
import { importCards } from "./import-cards";
import { manuallyGrade } from "./manually-grade";
import { gradeQuiz } from "./grade-quiz";

export const appRouter = router({
  bulkCreateCards,
  deleteCard,
  deleteFlaggedCards,
  editCard,
  editUserSettings,
  exportCards,
  manuallyGrade,
  faucet,
  flagCard,
  getAllCards,
  getNextQuiz,
  getNextQuizzes,
  getOneCard,
  getUserSettings,
  importCards,
  performExam: gradeQuiz,
  parseCards: procedure
    .input(
      z.object({
        text: z.string().max(3000),
      }),
    )
    .output(
      z.object({
        cards: z.array(
          z.object({
            definition: z.string(),
            term: z.string(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const cards = await createCardsFromText(input.text);
        return { cards };
      } catch (error) {
        console.error(error);
        throw new Error("Failed to parse cards");
      }
    }),
});

export type AppRouter = typeof appRouter;
