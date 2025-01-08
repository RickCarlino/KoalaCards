import {
  Alert,
  Button,
  Card,
  Center,
  Stack,
  Text,
  Title,
  useMantineTheme,
} from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { Grade } from "femto-fsrs";
import { useState } from "react";
import { FeedbackRow } from "./feedback-row";
import { HOTKEYS } from "./hotkeys";
import { QuizState } from "./types";

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
  const DARK_MODE = !!window?.matchMedia?.("(prefers-color-scheme: dark)")
  ?.matches;
  const theme = useMantineTheme();
  const [isSaving, setIsSaving] = useState(false);
  useHotkeys([[HOTKEYS.SAVE, onSave]]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave().finally(() => setIsSaving(false));
  };

  const dontShowCorrect = (quizState: QuizState) =>
    quizState.serverGradingResult === "fail";

  if (state.length === 0) {
    return (
      <Center style={{ width: "100%", height: "100vh" }}>
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={2}>{isSaving ? "" : "All Done!"}</Title>
          {!isSaving && (
            <Text color="dimmed" mt="sm">
              There are no quizzes to review.
            </Text>
          )}
        </Card>
      </Center>
    );
  }

  const filtered = state.filter(dontShowCorrect);

  if (filtered.length === 0) {
    return (
      <Center style={{ width: "100%", marginTop: "2rem" }}>
        <Card
          shadow="sm"
          padding="lg"
          radius="md"
          withBorder
          style={{
            width: "90%",
            maxWidth: 900,
            border: `1px solid ${
              DARK_MODE ? theme.colors.dark[5] : theme.colors.gray[2]
            }`,
          }}
        >
          <Stack gap="md">
            <Title order={3}>Review Completed</Title>
            <Text size="sm">
              Great job! Everything looks correct. You can now save your
              progress to finish.
            </Text>
            <div
              style={{
                display: "flex",
                gap: theme.spacing.sm,
                flexWrap: "wrap",
                justifyContent: "flex-start",
              }}
            >
              <Button onClick={handleSave} loading={isSaving} variant="filled">
                Save Lesson Progress
              </Button>
            </div>
          </Stack>
        </Card>
      </Center>
    );
  } else {
    return (
      <Center style={{ width: "100%", marginTop: "2rem" }}>
        <Card
          shadow="sm"
          padding="lg"
          radius="md"
          withBorder
          style={{
            width: "90%",
            maxWidth: 900,
            border: `1px solid ${
              DARK_MODE ? theme.colors.dark[5] : theme.colors.gray[2]
            }`,
          }}
        >
          <Stack gap="md">
            <Title order={2}>Almost There!</Title>
            <Alert color="red" variant="light">
              <Text fw={500}>Important:</Text>
              <Text size="sm">
                Closing this tab early will cause changes to be lost. Please
                finalize your review and save your progress.
              </Text>
            </Alert>
            <Text size="sm">
              The server found some issues with your responses. Check the
              feedback below.
            </Text>
            <div
              style={{
                display: "flex",
                gap: theme.spacing.sm,
                flexWrap: "wrap",
                justifyContent: "flex-start",
              }}
            >
              <Button onClick={handleSave} loading={isSaving} variant="filled">
                Save Lesson Progress
              </Button>
            </div>
            <Stack gap="sm">
              {filtered.map((quizState) => (
                <FeedbackRow
                  key={quizState.quiz.quizId}
                  quizState={quizState}
                  onUpdateDifficulty={onUpdateDifficulty}
                />
              ))}
            </Stack>
          </Stack>
        </Card>
      </Center>
    );
  }
}
