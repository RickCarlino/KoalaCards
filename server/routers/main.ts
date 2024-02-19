import { router } from "../trpc";
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
import { gradeQuiz } from "./grade-quiz";
import { importCards } from "./import-cards";
import { manuallyGrade } from "./manually-grade";
import { parseCards } from "./parse-cards";
import { rollbackGrade } from "./rollback-grade";

export const appRouter = router({
  bulkCreateCards,
  deleteCard,
  deleteFlaggedCards,
  editCard,
  editUserSettings,
  exportCards,
  faucet,
  flagCard,
  getAllCards,
  getNextQuiz,
  getNextQuizzes,
  getOneCard,
  getUserSettings,
  gradeQuiz,
  importCards,
  manuallyGrade,
  parseCards,
  rollbackGrade,
});

export type AppRouter = typeof appRouter;
