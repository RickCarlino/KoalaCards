import {
  Alert,
  Button,
  Card,
  Stack,
  Text,
  Title,
  useMantineTheme,
  Box,
  Container,
} from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { Grade } from "femto-fsrs";
import { useState, CSSProperties } from "react";
import { FeedbackRow } from "./feedback-row";
import { HOTKEYS } from "./hotkeys";
import { QuizState } from "./types";
import Link from "next/link";

type ReviewOverProps = {
  state: QuizState[];
  onSave: () => Promise<void>;
  onUpdateDifficulty: (quizId: number, grade: Grade) => void;
};

export function ReviewOver({
  state,
  onSave,
  onUpdateDifficulty,
}: ReviewOverProps) {
  const isDarkMode = !!window?.matchMedia?.("(prefers-color-scheme: dark)")
    ?.matches;
  const theme = useMantineTheme();
  const [isSaving, setIsSaving] = useState(false);
  useHotkeys([[HOTKEYS.SAVE, onSave]]);

  // Responsive styles
  const CARD_STYLE: CSSProperties = {
    width: "100%",
    border: `1px solid ${
      isDarkMode ? theme.colors.dark[5] : theme.colors.gray[2]
    }`,
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSave().finally(() => setIsSaving(false));
  };

  const hasError = (quiz: QuizState) => quiz.serverGradingResult === "fail";

  if (state.length === 0) {
    return (
      <Container size="md" py="xl">
        <Card shadow="sm" p="lg" radius="md" withBorder>
          <Stack gap="md">
            <Title order={2}>
              {isSaving ? "" : <Link href="/">Go Back</Link>}
            </Title>
            {!isSaving && (
              <Text color="dimmed">There are no quizzes to review.</Text>
            )}
          </Stack>
        </Card>
      </Container>
    );
  }

  const errorQuizzes = state.filter(hasError);
  const errorRate = Math.round((errorQuizzes.length / state.length) * 100);
  const correctPercent = 100 - errorRate;

  if (errorQuizzes.length === 0) {
    return (
      <Container size="md" py="xl">
        <Card shadow="sm" p="lg" radius="md" withBorder style={CARD_STYLE}>
          <Stack gap="md">
            <Title order={3}>Review Completed</Title>
            <Text size="md">
              Great job! Everything looks correct. You can now save your
              progress to finish.
            </Text>
            <Box mt="md">
              <Button
                onClick={handleSave}
                loading={isSaving}
                variant="filled"
                fullWidth
                size="lg"
              >
                Save Lesson Progress
              </Button>
            </Box>
          </Stack>
        </Card>
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <Card shadow="sm" p="lg" radius="md" withBorder style={CARD_STYLE}>
        <Stack gap="md">
          <Title order={2}>Almost There!</Title>
          <Alert color="red" variant="light">
            <Text fw={500}>Important:</Text>
            <Text size="md">
              Closing this tab early will cause changes to be lost. Please
              finalize your review and save your progress.
            </Text>
          </Alert>
          <Text size="md">
            The server found some issues with your responses. Check the feedback
            below. {correctPercent}% correct
          </Text>
          <Box mt="md">
            <Button
              onClick={handleSave}
              loading={isSaving}
              variant="filled"
              fullWidth
              size="lg"
            >
              Save Lesson Progress
            </Button>
          </Box>
          <Stack gap="md" mt="md">
            {errorQuizzes.map((quiz) => (
              <FeedbackRow
                key={quiz.quiz.quizId}
                quizState={quiz}
                onUpdateDifficulty={onUpdateDifficulty}
              />
            ))}
          </Stack>
        </Stack>
      </Card>
    </Container>
  );
}
