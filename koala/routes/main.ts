import { router } from "../trpc-procedure";
import { bulkCreateCards } from "./bulk-create-cards";
import { deleteCard } from "./delete-card";
import { deleteFlaggedCards } from "./delete-flagged-card";
import { editCard } from "./edit-card";
import { editUserSettings } from "./edit-user-settings";
import { exportCards } from "./export-cards";
import { faucet } from "./faucet";
import { flagCard } from "./flag-card";
import { getAllCards } from "./get-all-cards";
import { getMirrorCards } from "./get-mirroring-cards";
import { getNextQuizzes } from "./get-next-quizzes";
import { getOneCard } from "./get-one-card";
import { getPlaybackAudio } from "./get-playback-audio";
import { getRadioItem } from "./get-radio-item";
import { getUserSettings } from "./get-user-settings";
import { gradeQuiz } from "./grade-quiz";
import { levelReviews } from "./level-reviews";
import { manuallyGrade } from "./manually-grade";
import { parseCards } from "./parse-cards";
import { rollbackGrade } from "./rollback-grade";
import { speakText } from "./speak-text";
import { transcribeAudio } from "./transcribe-audio";
import { translateText } from "./translate-text";
import { viewTrainingData } from "./view-training-data";

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
  getNextQuizzes,
  getOneCard,
  getPlaybackAudio,
  getRadioItem,
  getUserSettings,
  gradeQuiz,
  levelReviews,
  manuallyGrade,
  parseCards,
  rollbackGrade,
  speakText,
  transcribeAudio,
  translateText,
  viewTrainingData,
  getMirrorCards,
});

export type AppRouter = typeof appRouter;
