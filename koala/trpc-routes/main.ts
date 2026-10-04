import { router } from "../trpc-procedure";
import { archiveCard } from "./archive-card";
import { bulkCreateCards } from "./bulk-create-cards";
import { completePassiveReview } from "./complete-passive-review";
import { completeRemedialReview } from "./complete-remedial-review";
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
import { gradeQuiz } from "./grade-quiz";
import { gradeSpeakingQuiz } from "./grade-speaking-quiz";
import { gradeWriting } from "./grade-writing";
import { importDeck } from "./import-deck";
import { mergeDecks } from "./merge-decks";
import { optimizeDeckFsrsRoute } from "./optimize-deck-fsrs";
import { parseCards } from "./parse-cards";
import {
  deleteReaderArticleRoute,
  listReaderArticlesRoute,
  setReaderArticleReadStateRoute,
  saveReaderArticleRoute,
  saveReaderRawTextRoute,
} from "./reader";
import {
  deleteReaderBookRoute,
  getReaderBookRoute,
  listReaderBooksRoute,
  updateReaderBookProgressRoute,
  upsertReaderBookRoute,
} from "./reader-books";
import {
  deleteReaderHighlightRoute,
  getReaderWorkspaceRoute,
  importReaderHighlightsToDeckRoute,
} from "./reader-highlights";
import { updateReaderPreferencesRoute } from "./reader-preferences";
import { turbine } from "./turbine";
import { updateDeck } from "./update-deck";

export const appRouter = router({
  bulkCreateCards,
  completePassiveReview,
  completeRemedialReview,
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
  gradeQuiz,
  gradeSpeakingQuiz,
  gradeWriting,
  editQuizResult,
  createDeck,
  deleteReaderArticleRoute,
  deleteReaderBookRoute,
  deleteReaderHighlightRoute,
  getReaderBookRoute,
  getReaderWorkspaceRoute,
  importReaderHighlightsToDeckRoute,
  mergeDecks,
  optimizeDeckFsrsRoute,
  importDeck,
  listReaderBooksRoute,
  listReaderArticlesRoute,
  parseCards,
  setReaderArticleReadStateRoute,
  saveReaderArticleRoute,
  saveReaderRawTextRoute,
  updateReaderPreferencesRoute,
  updateReaderBookProgressRoute,
  upsertReaderBookRoute,
  archiveCard,
  turbine,
  updateDeck,
});

export type AppRouter = typeof appRouter;
