import { QuizState } from "./types";
import { Button, Card, Center, Stack, Text, Title, Alert } from "@mantine/core";
import { useState } from "react";
import { DifficultyButtons } from "./grade-buttons";
import { Grade } from "femto-fsrs";
import { useHotkeys } from "@mantine/hooks";
import Link from "next/link";

type ReviewOverProps = {
  state: QuizState[];
  onSave: () => Promise<void>;
  onUpdateDifficulty: (quizId: number, grade: Grade) => void;
};
type PerfectScoreProps = { onSave: () => void; isSaving: boolean };
const PerfectScore = ({ onSave, isSaving }: PerfectScoreProps) => {
  useHotkeys([["space", onSave]]);
  return (
    <Center style={{ width: "100%" }}>
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={2}>Lesson Complete</Title>
        <Stack>
          <Button loading={isSaving} onClick={onSave}>
            Save Progress
          </Button>
        </Stack>
      </Card>
    </Center>
  );
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

  if (numWrong === 0 && numTotal > 0) {
    return <PerfectScore onSave={handleSave} isSaving={isSaving} />;
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
          <Title order={2}>
            {numWrong}/{numTotal} Failed
          </Title>
          <Alert color="red">
            Closing the browser tab early will cause changes to be lost. Please
            finalize your review.
          </Alert>
          <Text>Please review the following quizzes and verify grades.</Text>
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
