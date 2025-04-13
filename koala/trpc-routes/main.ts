import { router } from "../trpc-procedure";
import { bulkCreateCards } from "./bulk-create-cards";
import { createRemixCards } from "./create-remix-cards";
import { deleteCard } from "./delete-card";
import { deletePausedCards } from "./delete-paused-card";
import { editCard } from "./edit-card";
import { editUserSettings } from "./edit-user-settings";
import { faucet } from "./faucet";
import { pauseCard } from "./pause-card";
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

export const appRouter = router({
  bulkCreateCards,
  deleteCard,
  deletePausedCards,
  editCard,
  editUserSettings,
  faucet,
  pauseCard,
  getNextQuizzes,
  getUserSettings,
  gradeQuiz,
  parseCards,
  transcribeAudio,
  gradeSpeakingQuiz,
  remix,
  createRemixCards,
  turbine,
  deleteDeck,
  gradeWriting,
  updateDeck,
  copyDeck,
  reportDeck,
  generateWritingPrompts,
  defineUnknownWords,
});

export type AppRouter = typeof appRouter;
