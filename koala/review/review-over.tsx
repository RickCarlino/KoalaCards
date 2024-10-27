import { QuizState } from "./types";
import { Button, Card, Center, Stack, Text, Title, Alert } from "@mantine/core";
import { useEffect, useState } from "react";
import { DifficultyButtons } from "./grade-buttons";
import { Grade } from "femto-fsrs";

type ReviewOverProps = {
  state: QuizState[];
  onFinalize: () => void;
  onContinue: () => void;
  onUpdateDifficulty: (quizId: number, grade: Grade) => void;
  moreQuizzesAvailable: boolean;
};

export const ReviewOver = ({
  state,
  onFinalize,
  onContinue,
  onUpdateDifficulty,
  moreQuizzesAvailable,
}: ReviewOverProps) => {
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Simulate downloading the next set of quizzes in the background
    // This could be a stubbed function or a real API call
    // For now, we'll assume it's handled elsewhere
  }, []);

  const handleFinalize = () => {
    setIsSaving(true);
    // Call the onFinalize prop to commit results to the server
    onFinalize();
  };

  const handleContinue = () => {
    setIsSaving(true);
    // Call the onContinue prop to proceed to the next set of quizzes
    onContinue();
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
  const saveButton = moreQuizzesAvailable ? (
    <Button onClick={handleContinue} loading={isSaving}>
      Continue Studying
    </Button>
  ) : (
    <Button onClick={handleFinalize} loading={isSaving}>
      End Session
    </Button>
  );

  const dontShowCorrect = (quizState: QuizState) => {
    return quizState.serverGradingResult !== "pass";
  };

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
          <Title order={2}>Review Summary</Title>
          <Alert color="red">
            Closing the browser tab early will cause changes to be lost. Please
            finalize your review.
          </Alert>
          <Stack>{saveButton}</Stack>
          <Stack>
            {state.filter(dontShowCorrect).map((quizState) => (
              <Card
                key={quizState.quiz.quizId}
                shadow="sm"
                padding="md"
                radius="md"
                withBorder
                style={{ backgroundColor: getColor(quizState) }}
              >
                <Stack>
                <Text>{quizState.quiz.term}</Text>
                <DifficultyButtons
                    current={quizState.grade}
                    onSelectDifficulty={(grade) =>
                      onUpdateDifficulty(quizState.quiz.quizId, grade)
                    }
                  />
                  <Text>Type: {quizState.quiz.lessonType}</Text>
                  <Text>
                    Your Response:{" "}
                    {quizState.response || "No response provided."}
                  </Text>
                  <Text>Feedback: {quizState.serverResponse || ""}</Text>
                  <Text>Definition: {quizState.quiz.definition}</Text>
                  {quizState.quiz.imageURL && (
                    <img
                      src={quizState.quiz.imageURL}
                      alt="Card Illustration"
                      style={{ maxWidth: "100%" }}
                    />
                  )}
                </Stack>
              </Card>
            ))}
          </Stack>
          <Stack>{saveButton}</Stack>
        </Stack>
      </Card>
    </Center>
  );
};
