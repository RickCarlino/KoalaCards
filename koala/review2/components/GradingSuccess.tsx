import { Stack, Text, Button } from "@mantine/core";
import { getGradeButtonText } from "@/koala/trpc-routes/calculate-scheduling-data";
import { Grade } from "femto-fsrs";

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
}

const gradeColors = {
  [Grade.AGAIN]: "red",
  [Grade.HARD]: "orange",
  [Grade.GOOD]: "green",
  [Grade.EASY]: "blue",
} as const;

export function GradingSuccess({
  quizData,
  onGradeSelect,
  isLoading,
}: GradingSuccessProps) {
  const gradeOptions = getGradeButtonText(quizData);

  return (
    <Stack gap="md" align="center">
      <Text ta="center" c="green" fw={500} size="lg">
        You got it right!
      </Text>
      <Text ta="center" size="sm" c="dimmed" mt="md">
        How difficult was this for you?
      </Text>
      <Stack gap="sm" w="100%" maw={400}>
        {gradeOptions.map(([grade, timeText]) => {
          const gradeLabels = {
            [Grade.AGAIN]: "AGAIN",
            [Grade.HARD]: "HARD",
            [Grade.GOOD]: "GOOD",
            [Grade.EASY]: "EASY",
          };

          return (
            <Button
              key={grade}
              onClick={() => onGradeSelect(grade as Grade)}
              color={gradeColors[grade as Grade]}
              variant="outline"
              size="md"
              fullWidth
              disabled={isLoading}
              styles={{
                root: {
                  height: 48,
                  display: "flex",
                  justifyContent: "space-between",
                  paddingLeft: 16,
                  paddingRight: 16,
                },
                label: {
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                },
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {gradeLabels[grade as Grade]}
              </span>
              <span style={{ fontSize: "0.875em", opacity: 0.8 }}>
                {timeText}
              </span>
            </Button>
          );
        })}
      </Stack>
    </Stack>
  );
}
