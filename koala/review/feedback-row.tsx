import { Card, Stack, Text } from "@mantine/core";
import { Grade } from "femto-fsrs";
import Link from "next/link";
import { DifficultyButtons } from "./grade-buttons";
import { QuizState } from "./types";
import { VisualDiff } from "./visual-diff";
import RemixButton from "../remix-button";

type FeedbackRowProps = {
  quizState: QuizState;
  onUpdateDifficulty: (quizId: number, grade: Grade) => void;
  getColor: (quizState: QuizState) => string;
};

const PENCIL_EMOJI = "✏️";

const LastRow = ({
  expected,
  actual,
}: {
  expected: string;
  actual: string;
}) => {
  // HACK: Stringly typed server response for now
  // Will re-do schema if I like the results.
  // This is an experiment.
  // - RC 16 NOV 2024
  if (expected.includes(PENCIL_EMOJI)) {
    return (
      <VisualDiff
        expected={expected.slice(1)}
        actual={actual}
        heading="Feedback: "
      />
    );
  } else {
    return <Text>Feedback: {expected}</Text>;
  }
};
export const FeedbackRow = ({
  quizState,
  onUpdateDifficulty,
  getColor,
}: FeedbackRowProps) => {
  const expected = quizState.serverResponse || "";
  const actual = quizState.response || expected;
  const card = {
    id: quizState.quiz.cardId,
    term: quizState.quiz.term,
    definition: quizState.quiz.definition,
  };
  return (
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
          quiz={quizState.quiz}
          disableHotkeys={true}
          current={quizState.grade}
          onSelectDifficulty={(grade) =>
            onUpdateDifficulty(quizState.quiz.quizId, grade)
          }
        />
        <RemixButton card={card} />
        <Text>Type: {quizState.quiz.lessonType}</Text>
        <Text>
          <Link target={"_blank"} href={`/cards/${quizState.quiz.cardId}`}>
            {quizState.quiz.term}
          </Link>
        </Text>
        <Text>Definition: {quizState.quiz.definition}</Text>
        <Text>Your Entered: {quizState.response || ""}</Text>
        <LastRow expected={expected} actual={actual} />
      </Stack>
    </Card>
  );
};
