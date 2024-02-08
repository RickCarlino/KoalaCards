import { procedure, router } from "../trpc";
import { deleteCard } from "./delete-card";
import { deleteFlaggedCards } from "./delete-flagged-card";
import { editCard } from "./edit-card";
import { exportCards } from "./export-cards";
import { faucet } from "./faucet";
import { flagCard } from "./flag-card";
import { getAllCards } from "./get-all-cards";
import { getNextQuiz, getNextQuizzes } from "./get-next-quizzes";
import { getOneCard } from "./get-one-card";
import { bulkCreateCards } from "./bulk-create-cards";
import { failCard, performExam } from "./perform-exam";
import { importCards } from "./import-cards";
import { flagObnoxious } from "./flag-obnoxious";
import { editUserSettings } from "./edit-user-settings";
import { getUserSettings } from "./get-user-settings";
import { z } from "zod";
import { createCardsFromText } from "@/utils/create-cards-from-text";

export const appRouter = router({
  bulkCreateCards,
  deleteCard,
  deleteFlaggedCards,
  editCard,
  editUserSettings,
  exportCards,
  failCard,
  faucet,
  flagCard,
  flagObnoxious,
  getAllCards,
  getNextQuiz,
  getNextQuizzes,
  getOneCard,
  getUserSettings,
  importCards,
  performExam,
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
