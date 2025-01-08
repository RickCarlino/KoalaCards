import { Card, Stack, Text } from "@mantine/core";
import { Grade } from "femto-fsrs";
import Link from "next/link";
import { QuizState } from "./types";
import RemixButton from "../remix-button";
import { ServerExplanation } from "./ServerExplanation";

type FeedbackRowProps = {
  quizState: QuizState;
  onUpdateDifficulty: (quizId: number, grade: Grade) => void;
};

export const FeedbackRow = ({
  quizState,
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
        <RemixButton card={card} />
        <Text>
          <Link target={"_blank"} href={`/cards/${quizState.quiz.cardId}`}>
            {quizState.quiz.term}
          </Link>
        </Text>
        <Text>Definition: {quizState.quiz.definition}</Text>
        <Text>You Said: {quizState.response || ""}</Text>
        <ServerExplanation expected={expected} actual={actual} />
      </Stack>
    </Card>
  );
};
