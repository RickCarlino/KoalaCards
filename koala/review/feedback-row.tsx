import {
  Card,
  Stack,
  Text,
  Title,
  Box,
  useMantineTheme,
  Group,
} from "@mantine/core";
import { linkStyle } from "../styles";
import { Grade } from "femto-fsrs";
import Link from "next/link";
import { QuizState } from "./types";
import RemixButton from "../remix-button";
import { ServerExplanation } from "./ServerExplanation";

type FeedbackRowProps = {
  quizState: QuizState;
  onUpdateDifficulty: (uuid: string, grade: Grade) => void;
};

export function FeedbackRow({ quizState }: FeedbackRowProps) {
  const theme = useMantineTheme();
  const expected = quizState.serverResponse || "";
  const actual = quizState.response || expected;
  const card = {
    id: quizState.quiz.cardId,
    term: quizState.quiz.term,
    definition: quizState.quiz.definition,
  };

  return (
    <Card key={quizState.quiz.uuid} radius="md" p="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={4}>
            <Link
              target="_blank"
              href={`/cards/${quizState.quiz.cardId}`}
              style={linkStyle(theme)}
            >
              {quizState.quiz.term}
            </Link>
          </Title>
          <RemixButton card={card} />
        </Group>
        <Text size="md" fw={500}>
          <strong>Definition:</strong> {quizState.quiz.definition}
        </Text>
        <Box mt="xs">
          <ServerExplanation expected={expected} actual={actual} />
        </Box>
      </Stack>
    </Card>
  );
}
