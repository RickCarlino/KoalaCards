import { Alert, Button, Card, Center, Stack, Text, Title } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { Grade } from "femto-fsrs";
import Link from "next/link";
import { useState } from "react";
import { DifficultyButtons } from "./grade-buttons";
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
    return quizState.serverGradingResult !== "pass";
  };

  const showFailed = (quizState: QuizState) => {
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

  const numWrong = state.filter(showFailed).length;
  const numTotal = state.length;

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
          <Title order={2}>
            {numWrong}/{numTotal} Failed
          </Title>
          <Alert color="red">
            Closing the browser tab early will cause changes to be lost. Please
            finalize your review.
          </Alert>
          <Text>The server will return feedback (if any) below. Please take a look before moving to the next review session.</Text>
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
                  <Text>
                    <Link
                      target={"_blank"}
                      href={`/cards/${quizState.quiz.cardId}`}
                    >
                      {quizState.quiz.term}
                    </Link>
                  </Text>
                  <Text>Definition: {quizState.quiz.definition}</Text>
                  <Text>
                    Your Entered:{" "}
                    {quizState.response || ""}
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
