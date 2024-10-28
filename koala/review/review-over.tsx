import { QuizState } from "./types";
import { Button, Card, Center, Stack, Text, Title, Alert } from "@mantine/core";
import { useState } from "react";
import { DifficultyButtons } from "./grade-buttons";
import { Grade } from "femto-fsrs";

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
    return quizState.serverGradingResult !== "pass";
  };

  if (state.length === 0) {
    return (
      <Center style={{ width: "100%", height: "100vh" }}>
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={2}>No quizzes to review</Title>
        </Card>
      </Center>
    );
  }

  const numWrong = state.filter(dontShowCorrect).length;
  const numTotal = state.length;

  return (
    <Center style={{ width: "100%", height: "100vh", overflowY: "auto" }}>
      <Card
        shadow="sm"
        padding="lg"
        radius="md"
        withBorder
        style={{ width: "80%", maxHeight: "90vh", overflowY: "auto" }}
      >
        <Stack>
          <Title order={2}>{numWrong}/{numTotal} Failed</Title>
          <Alert color="red">
            Closing the browser tab early will cause changes to be lost. Please
            finalize your review.
          </Alert>
          <Text>
            Please review the following quizzes and verify grades.
          </Text>
          <Stack>
            <Button onClick={handleSave} loading={isSaving}>
              Save Progress
            </Button>
          </Stack>
          <Stack>
            {state.filter(dontShowCorrect).map((quizState) => (
              <Card
                key={quizState.quiz.quizId}
                shadow="sm"
                padding="md"
                radius="md"
                withBorder
                style={{ borderColor: getColor(quizState) }}
              >
                <Stack>
                  <DifficultyButtons
                    current={quizState.grade}
                    onSelectDifficulty={(grade) =>
                      onUpdateDifficulty(quizState.quiz.quizId, grade)
                    }
                  />
                  <Text>Type: {quizState.quiz.lessonType}</Text>
                  <Text>{quizState.quiz.term}</Text>
                  <Text>Definition: {quizState.quiz.definition}</Text>
                  <Text>
                    Your Entered:{" "}
                    {quizState.response || "No response provided."}
                  </Text>
                  <Text>Feedback: {quizState.serverResponse || ""}</Text>
                </Stack>
              </Card>
            ))}
          </Stack>
        </Stack>
      </Card>
    </Center>
  );
};