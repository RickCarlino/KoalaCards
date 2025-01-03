import { Alert, Button, Card, Center, Stack, Text, Title } from "@mantine/core";
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

export const ReviewOver = ({
  state,
  onSave,
  onUpdateDifficulty,
}: ReviewOverProps) => {
  const [isSaving, setIsSaving] = useState(false);
  useHotkeys([[HOTKEYS.SAVE, onSave]]);
  const handleSave = async () => {
    setIsSaving(true);
    await onSave().finally(() => setIsSaving(false));
  };

  const getColor = (quizState: QuizState): string => {
    switch (quizState.serverGradingResult) {
      case "pass":
        return "white";
      case "fail":
        return "red";
      case "error":
        return "yellow";
      default:
        return "gray";
    }
  };

  const dontShowCorrect = (quizState: QuizState) => {
    if (quizState.grade === Grade.AGAIN) {
      return true;
    }
    return quizState.serverGradingResult !== "pass";
  };

  if (state.length === 0) {
    return (
      <Center style={{ width: "100%", height: "100vh" }}>
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={2}>{isSaving ? "" : "No quizzes to review"}</Title>
        </Card>
      </Center>
    );
  }

  return (
    <Center style={{ width: "100%" }}>
      <Card
        shadow="sm"
        padding="lg"
        radius="md"
        withBorder
        style={{ width: "80%" }}
      >
        <Stack>
          <Title order={2}>Save Progress</Title>
          <Alert color="red">
            Closing the browser tab early will cause changes to be lost. Please
            finalize your review.
          </Alert>
          <Text>
            The server will return feedback (if any) below. Please take a look
            before moving to the next review session.
          </Text>
          <Stack>
            <Button onClick={handleSave} loading={isSaving}>
              Save Progress
            </Button>
          </Stack>
          <Stack>
            {state.filter(dontShowCorrect).map((quizState) => (
              <FeedbackRow
                key={quizState.quiz.quizId}
                quizState={quizState}
                onUpdateDifficulty={onUpdateDifficulty}
                getColor={getColor}
              />
            ))}
          </Stack>
        </Stack>
      </Card>
    </Center>
  );
};
