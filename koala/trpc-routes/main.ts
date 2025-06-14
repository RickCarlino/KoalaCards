import { router } from "../trpc-procedure";
import { bulkCreateCards } from "./bulk-create-cards";
import { createRemixCards } from "./create-remix-cards";
import { deleteCard } from "./delete-card";
import { deletePausedCards } from "./delete-paused-card";
import { editCard } from "./edit-card";
import { editUserSettings } from "./edit-user-settings";
import { faucet } from "./faucet";
import { archiveCard } from "./archive-card";
import { getNextQuizzes } from "./get-next-quizzes";
import { getUserSettings } from "./get-user-settings";
import { gradeQuiz } from "./grade-quiz";
import { gradeSpeakingQuiz } from "./grade-speaking-quiz";
import { parseCards } from "./parse-cards";
import { remix } from "./remix";
import { transcribeAudio } from "./transcribe-audio";
import { turbine } from "./turbine";
import { deleteDeck } from "./delete-deck";
import { gradeWriting } from "./grade-writing";
import { updateDeck } from "./update-deck";
import { copyDeck } from "./copy-deck";
import { reportDeck } from "./report-deck";
import { generateWritingPrompts } from "./generate-writing-prompts";
import { defineUnknownWords } from "./define-unknown-words";
import { translate } from "./translate";
import { getDailyWritingProgress } from "./get-daily-writing-progress"; // Added import
import { mergeDecks } from "./merge-decks";
import { generateWritingSample } from "./generate-writing-sample";

export const appRouter = router({
  bulkCreateCards,
  copyDeck,
  createRemixCards,
  defineUnknownWords,
  deleteCard,
  deleteDeck,
  deletePausedCards,
  editCard,
  editUserSettings,
  faucet,
  generateWritingPrompts,
  generateWritingSample,
  getDailyWritingProgress,
  getNextQuizzes,
  getUserSettings,
  gradeQuiz,
  gradeSpeakingQuiz,
  gradeWriting,
  mergeDecks,
  parseCards,
  archiveCard,
  remix,
  reportDeck,
  transcribeAudio,
  translate,
  turbine,
  updateDeck,
});

export type AppRouter = typeof appRouter;
