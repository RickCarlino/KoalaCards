import { Card, Stack, Text } from "@mantine/core";
import { Grade } from "femto-fsrs";
import Link from "next/link";
import { DifficultyButtons } from "./grade-buttons";
import { QuizState } from "./types";
import RemixButton from "../remix-button";
import { ServerExplanation } from "./ServerExplanation";

type FeedbackRowProps = {
  quizState: QuizState;
  onUpdateDifficulty: (quizId: number, grade: Grade) => void;
};

export const FeedbackRow = ({
  quizState,
  onUpdateDifficulty,
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
        <ServerExplanation expected={expected} actual={actual} />
      </Stack>
    </Card>
  );
};
