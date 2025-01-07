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

  const dontShowCorrect = (quizState: QuizState) => {
    return quizState.serverGradingResult === "fail";
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

  const filtered = state.filter(dontShowCorrect);

  if (filtered.length === 0) {
    return (
      <Center style={{ width: "100%", marginTop: "10px" }}>
        <Card
          shadow="sm"
          padding="lg"
          radius="md"
          withBorder
          style={{ width: "80%" }}
        >
          <Stack>
            <Button onClick={handleSave} loading={isSaving}>
              Save Lesson Progress
            </Button>
          </Stack>
        </Card>
      </Center>
    );
  } else {
    return (
      <Center style={{ width: "100%", marginTop: "10px" }}>
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
              Closing the browser tab early will cause changes to be lost.
              Please finalize your review.
            </Alert>
            <Text>
              The server will return feedback (if any) below. Please take a look
              before moving to the next review session.
            </Text>
            <Stack>
              <Button onClick={handleSave} loading={isSaving}>
                Save Lesson Progress
              </Button>
            </Stack>
            <Stack>
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
};
