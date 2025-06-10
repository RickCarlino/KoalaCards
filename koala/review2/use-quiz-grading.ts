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

  const gradeWithAgain = async (): Promise<void> => {
    await gradeQuiz.mutateAsync({
      perceivedDifficulty: Grade.AGAIN,
      quizID: quizId,
    });
  };

  const gradeWithHard = async (): Promise<void> => {
    await gradeQuiz.mutateAsync({
      perceivedDifficulty: Grade.HARD,
      quizID: quizId,
    });
  };

  const gradeWithGood = async (): Promise<void> => {
    await gradeQuiz.mutateAsync({
      perceivedDifficulty: Grade.GOOD,
      quizID: quizId,
    });
  };

  const gradeWithEasy = async (): Promise<void> => {
    await gradeQuiz.mutateAsync({
      perceivedDifficulty: Grade.EASY,
      quizID: quizId,
    });
  };

  return {
    gradeWithAgain,
    gradeWithHard,
    gradeWithGood,
    gradeWithEasy,
    isLoading: gradeQuiz.isLoading,
    error: gradeQuiz.error,
  };
}
