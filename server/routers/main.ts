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
import { importCards } from "./import-cards";
import { flagObnoxious } from "./flag-obnoxious";
import { editUserSettings } from "./edit-user-settings";

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
  importCards,
  performExam,
});

export type AppRouter = typeof appRouter;
