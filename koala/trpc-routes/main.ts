import { router } from "../trpc-procedure";
import { bulkCreateCards } from "./bulk-create-cards";
import { deleteCard } from "./delete-card";
import { deleteFlaggedCards } from "./delete-flagged-card";
import { editCard } from "./edit-card";
import { editUserSettings } from "./edit-user-settings";
import { faucet } from "./faucet";
import { flagCard } from "./flag-card";
import { getNextQuizzes } from "./get-next-quizzes";
import { getUserSettings } from "./get-user-settings";
import { gradeQuiz } from "./grade-quiz";
import { gradeSpeakingQuiz } from "./grade-speaking-quiz";
import { levelReviews } from "./level-reviews";
import { parseCards } from "./parse-cards";
import { remix } from "./remix";
import { transcribeAudio } from "./transcribe-audio";
import { viewTrainingData } from "./view-training-data";

export const appRouter = router({
  bulkCreateCards,
  deleteCard,
  deleteFlaggedCards,
  editCard,
  editUserSettings,
  faucet,
  flagCard,
  getNextQuizzes,
  getUserSettings,
  gradeQuiz,
  levelReviews,
  parseCards,
  transcribeAudio,
  viewTrainingData,
  gradeSpeakingQuiz,
  remix,
});

export type AppRouter = typeof appRouter;
