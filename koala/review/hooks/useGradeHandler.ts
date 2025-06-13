import { Grade } from "femto-fsrs";

interface UseGradeHandlerProps {
  gradeWithAgain: () => Promise<void>;
  gradeWithHard: () => Promise<void>;
  gradeWithGood: () => Promise<void>;
  gradeWithEasy: () => Promise<void>;
}

export function useGradeHandler({
  gradeWithAgain,
  gradeWithHard,
  gradeWithGood,
  gradeWithEasy,
}: UseGradeHandlerProps) {
  const handleGradeSelect = async (grade: Grade) => {
    switch (grade) {
      case Grade.AGAIN:
        await gradeWithAgain();
        break;
      case Grade.HARD:
        await gradeWithHard();
        break;
      case Grade.GOOD:
        await gradeWithGood();
        break;
      case Grade.EASY:
        await gradeWithEasy();
        break;
    }
  };

  return { handleGradeSelect };
}
