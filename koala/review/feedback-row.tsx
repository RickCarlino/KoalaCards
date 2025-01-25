import { Card, Stack, Text, Title, Box, useMantineTheme } from "@mantine/core";
import { Grade } from "femto-fsrs";
import Link from "next/link";
import { QuizState } from "./types";
import RemixButton from "../remix-button";
import { ServerExplanation } from "./ServerExplanation";

type FeedbackRowProps = {
  quizState: QuizState;
  onUpdateDifficulty: (quizId: number, grade: Grade) => void;
};

export function FeedbackRow({ quizState }: FeedbackRowProps) {
  const DARK_MODE = !!window?.matchMedia?.("(prefers-color-scheme: dark)")
    ?.matches;
  const theme = useMantineTheme();
  const expected = quizState.serverResponse || "";
  const actual = quizState.response || expected;
  const card = {
    id: quizState.quiz.cardId,
    term: quizState.quiz.term,
    definition: quizState.quiz.definition,
  };

  const cardStyles = {
    border: `1px solid ${
      DARK_MODE ? theme.colors.dark[5] : theme.colors.gray[2]
    }`,
  };

  return (
    <Card
      key={quizState.quiz.quizId}
      style={cardStyles}
      radius="md"
      p="md"
      withBorder
    >
      <Stack gap="sm">
        <Box>
          <RemixButton card={card} />
        </Box>
        <Title order={4} mt="xs">
          <Link
            target="_blank"
            href={`/cards/${quizState.quiz.cardId}`}
            style={{ color: theme.colors.blue[6], textDecoration: "none" }}
          >
            {quizState.quiz.term}
          </Link>
        </Title>
        <Text size="sm">
          <strong>Definition:</strong> {quizState.quiz.definition}
        </Text>
        <Text size="sm">
          <strong>You said:</strong> {quizState.response || "—"}
        </Text>
        <ServerExplanation expected={expected} actual={actual} />
      </Stack>
    </Card>
  );
}
