import { router } from "../trpc-procedure";
import { archiveCard } from "./archive-card";
import { bulkCreateCards } from "./bulk-create-cards";
import { createDeck } from "./create-deck";
import { defineUnknownWords } from "./define-unknown-words";
import { deleteCard } from "./delete-card";
import { deleteDeck } from "./delete-deck";
import { deletePausedCards } from "./delete-paused-card";
import { editCard } from "./edit-card";
import { editQuizResult } from "./edit-quiz-results";
import { editUserSettings } from "./edit-user-settings";
import { exportDeck } from "./export-deck";
import { getDailyWritingProgress } from "./get-daily-writing-progress";
import { getNextQuizzes } from "./get-next-quizzes";
import { getUserSettings } from "./get-user-settings";
import { generateMnemonic } from "./generate-mnemonic";
import { gradeQuiz } from "./grade-quiz";
import { gradeSpeakingQuiz } from "./grade-speaking-quiz";
import { gradeWriting } from "./grade-writing";
import { importDeck } from "./import-deck";
import { mergeDecks } from "./merge-decks";
import { parseCards } from "./parse-cards";
import { turbine } from "./turbine";
import { updateDeck } from "./update-deck";

export const appRouter = router({
  bulkCreateCards,
  defineUnknownWords,
  deleteCard,
  deleteDeck,
  deletePausedCards,
  editCard,
  editUserSettings,
  getDailyWritingProgress,
  exportDeck,
  getNextQuizzes,
  getUserSettings,
  generateMnemonic,
  gradeQuiz,
  gradeSpeakingQuiz,
  gradeWriting,
  editQuizResult,
  createDeck,
  mergeDecks,
  importDeck,
  parseCards,
  archiveCard,
  turbine,
  updateDeck,
});

export type AppRouter = typeof appRouter;
