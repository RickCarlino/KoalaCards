import { router } from "../trpc-procedure";
import { archiveCard } from "./archive-card";
import { bulkCreateCards } from "./bulk-create-cards";
import { copyDeck } from "./copy-deck";
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
import { gradeUtteranceRoute } from "./grade-utterance";
import { gradeWriting } from "./grade-writing";
import { correctiveDrillGenerate } from "./corrective-drill";
import { importDeck } from "./import-deck";
import { mergeDecks } from "./merge-decks";
import { parseCards } from "./parse-cards";
import { reportDeck } from "./report-deck";
import { turbine } from "./turbine";
import { updateDeck } from "./update-deck";

export const appRouter = router({
  bulkCreateCards,
  copyDeck,
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
  gradeUtterance: gradeUtteranceRoute,
  correctiveDrillGenerate,
  editQuizResult,
  createDeck,
  mergeDecks,
  importDeck,
  parseCards,
  archiveCard,
  reportDeck,
  turbine,
  updateDeck,
});

export type AppRouter = typeof appRouter;
