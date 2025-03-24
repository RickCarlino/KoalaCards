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
import { levelReviews } from "./level-reviews";
import { parseCards } from "./parse-cards";
import { remix } from "./remix";
import { transcribeAudio } from "./transcribe-audio";
import { turbine } from "./turbine";
import { deleteDeck } from "./delete-deck";
import { gradeWriting } from "./grade-writing";

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
  levelReviews,
  parseCards,
  transcribeAudio,
  gradeSpeakingQuiz,
  remix,
  createRemixCards,
  turbine,
  deleteDeck,
  gradeWriting,
});

export type AppRouter = typeof appRouter;
