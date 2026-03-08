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
import { gradeQuiz } from "./grade-quiz";
import { gradeSpeakingQuiz } from "./grade-speaking-quiz";
import { gradeWriting } from "./grade-writing";
import { importDeck } from "./import-deck";
import { mergeDecks } from "./merge-decks";
import { parseCards } from "./parse-cards";
import {
  deleteReaderArticleHighlightRoute,
  deleteReaderArticleRoute,
  getReaderBookmarkletConfig,
  importReaderHighlightsToDeckRoute,
  listReaderArticleHighlightsRoute,
  listReaderArticlesRoute,
  refreshReaderArticleRoute,
  rotateReaderBookmarkletKey,
  setReaderArticleReadStateRoute,
  saveReaderArticleRoute,
  saveReaderRawTextRoute,
} from "./reader";
import {
  connectReaderInstapaperRoute,
  disconnectReaderInstapaperRoute,
  exportReaderArticleToInstapaperRoute,
  getReaderInstapaperConnectionRoute,
  importReaderInstapaperUnreadRoute,
  listReaderInstapaperUnreadRoute,
} from "./reader-instapaper";
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
  gradeQuiz,
  gradeSpeakingQuiz,
  gradeWriting,
  editQuizResult,
  createDeck,
  connectReaderInstapaperRoute,
  deleteReaderArticleHighlightRoute,
  deleteReaderArticleRoute,
  disconnectReaderInstapaperRoute,
  getReaderBookmarkletConfig,
  exportReaderArticleToInstapaperRoute,
  getReaderInstapaperConnectionRoute,
  importReaderHighlightsToDeckRoute,
  importReaderInstapaperUnreadRoute,
  mergeDecks,
  importDeck,
  listReaderArticleHighlightsRoute,
  listReaderInstapaperUnreadRoute,
  listReaderArticlesRoute,
  parseCards,
  refreshReaderArticleRoute,
  rotateReaderBookmarkletKey,
  setReaderArticleReadStateRoute,
  saveReaderArticleRoute,
  saveReaderRawTextRoute,
  archiveCard,
  turbine,
  updateDeck,
});

export type AppRouter = typeof appRouter;
