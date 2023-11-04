import { router } from "../trpc";
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

export const appRouter = router({
  deleteCard,
  deleteFlaggedCards,
  editCard,
  exportCards,
  failCard,
  faucet,
  flagCard,
  getAllCards,
  getNextQuiz,
  getNextQuizzes,
  getOneCard,
  bulkCreateCards,
  performExam,
});

export type AppRouter = typeof appRouter;
