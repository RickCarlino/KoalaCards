import { trpc } from "@/koala/trpc-config";
import { Grade } from "femto-fsrs";

interface UseQuizGradingOptions {
  quizId: number;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

export function useQuizGrading({
  quizId,
  onSuccess,
  onError,
}: UseQuizGradingOptions) {
  const gradeQuiz = trpc.gradeQuiz.useMutation({
    onSuccess,
    onError,
  });

  const createGrader = (perceivedDifficulty: Grade) => {
    return async (): Promise<void> => {
      await gradeQuiz
        .mutateAsync({
          perceivedDifficulty,
          quizID: quizId,
        })
        .then(onSuccess, onError);
    };
  };

  const gradeWithAgain = createGrader(Grade.AGAIN);
  const gradeWithHard = createGrader(Grade.HARD);
  const gradeWithGood = createGrader(Grade.GOOD);
  const gradeWithEasy = createGrader(Grade.EASY);

  return {
    gradeWithAgain,
    gradeWithHard,
    gradeWithGood,
    gradeWithEasy,
    isLoading: gradeQuiz.isLoading,
    error: gradeQuiz.error,
  };
}
