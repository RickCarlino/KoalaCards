import { Stack, Text, Button } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { getGradeButtonText } from "@/koala/trpc-routes/calculate-scheduling-data";
import { Grade } from "femto-fsrs";
import { HOTKEYS } from "../hotkeys";
import { FeedbackVote } from "./FeedbackVote";

interface GradingSuccessProps {
  quizData: {
    difficulty: number;
    stability: number;
    lastReview: number;
    lapses: number;
    repetitions: number;
  };
  onGradeSelect: (grade: Grade) => void;
  isLoading?: boolean;
  feedback?: string;
  quizResultId?: number | null;
}

const gradeColors = {
  [Grade.AGAIN]: "red",
  [Grade.HARD]: "orange",
  [Grade.GOOD]: "green",
  [Grade.EASY]: "blue",
} as const;

const gradeLabels: Record<Grade, string> = {
  [Grade.AGAIN]: "AGAIN",
  [Grade.HARD]: "HARD",
  [Grade.GOOD]: "GOOD",
  [Grade.EASY]: "EASY",
};

const gradeHotkeys: Record<Grade, string> = {
  [Grade.AGAIN]: HOTKEYS.GRADE_AGAIN,
  [Grade.HARD]: HOTKEYS.GRADE_HARD,
  [Grade.GOOD]: HOTKEYS.GRADE_GOOD,
  [Grade.EASY]: HOTKEYS.GRADE_EASY,
};

export function GradingSuccess({
  quizData,
  onGradeSelect,
  isLoading,
  feedback,
  quizResultId,
}: GradingSuccessProps) {
  const gradeOptions = getGradeButtonText(quizData);

  useHotkeys([
    [HOTKEYS.GRADE_AGAIN, () => !isLoading && onGradeSelect(Grade.AGAIN)],
    [HOTKEYS.GRADE_HARD, () => !isLoading && onGradeSelect(Grade.HARD)],
    [HOTKEYS.GRADE_GOOD, () => !isLoading && onGradeSelect(Grade.GOOD)],
    [HOTKEYS.GRADE_EASY, () => !isLoading && onGradeSelect(Grade.EASY)],
  ]);

  return (
    <Stack gap="md" align="center">
      {renderSuccessHeader(feedback, quizResultId)}
      <Text ta="center" size="sm" c="dimmed" mt="md">
        How difficult was this for you?
      </Text>
      <Stack gap="sm" w="100%" maw={400}>
        {gradeOptions.map(([grade, timeText]) => {
          const gradeValue = grade as Grade;
          const label = gradeLabels[gradeValue];
          const hotkey = gradeHotkeys[gradeValue];

          return (
            <Button
              key={grade}
              onClick={() => onGradeSelect(gradeValue)}
              color={gradeColors[gradeValue]}
              variant="outline"
              size="md"
              fullWidth
              disabled={isLoading}
              justify="space-between"
              h={48}
              px="md"
              rightSection={
                <Text span fz="sm" opacity={0.8}>
                  {timeText}
                </Text>
              }
            >
              <Text span fw={600}>
                {label} ({hotkey})
              </Text>
            </Button>
          );
        })}
      </Stack>
    </Stack>
  );
}

function renderSuccessHeader(
  feedback?: string,
  quizResultId?: number | null,
) {
  const hasFeedback =
    feedback && !feedback.toLowerCase().includes("exact match");
  if (hasFeedback) {
    return (
      <Stack gap={4} align="center">
        <Text ta="center" c="green" fw={500} size="lg">
          {feedback}
        </Text>
        {quizResultId && <FeedbackVote resultId={quizResultId} />}
      </Stack>
    );
  }
  return (
    <Text ta="center" c="green" fw={500} size="lg">
      Correct!
    </Text>
  );
}
