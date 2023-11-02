import { router } from "../trpc";
import { deleteCard } from "./delete-card";
import { editCard } from "./edit-card";
import { faucet } from "./faucet";
import { flagPhrase } from "./flag-phrase";
import { getAllPhrases } from "./get-all-phrases";
import { getNextQuiz, getNextQuizzes } from "./get-next-quizzes";
import { getOneCard } from "./get-one-card";
import { importPhrases } from "./import-phrases";
import { failPhrase, performExam } from "./perform-exam";

export const appRouter = router({
  faucet,
  importPhrases,
  getAllPhrases,
  deleteCard,
  editCard,
  getOneCard,
  flagPhrase,
  getNextQuizzes,
  getNextQuiz,
  failPhrase,
  performExam,
});

export type AppRouter = typeof appRouter;
