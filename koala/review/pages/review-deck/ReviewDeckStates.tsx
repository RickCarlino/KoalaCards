import { HOTKEYS } from "@/koala/review/hotkeys";
import {
  Anchor,
  Box,
  Button,
  Container,
  Text,
  Title,
} from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import Link from "next/link";
import React from "react";

export function MessageState({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Container size="md" py="xl">
      <Box p="md">
        <Title order={3} mb="md">
          {title}
        </Title>
        <Text>{children}</Text>
      </Box>
    </Container>
  );
}

export function NoMoreQuizzesState({
  deckId,
  onReload,
}: {
  deckId: number;
  onReload: () => void;
}) {
  useHotkeys([[HOTKEYS.CONTINUE, onReload]]);

  return (
    <Container size="md" py="xl">
      <Box p="md">
        <Title order={3} mb="md">
          Lesson Complete
        </Title>
        <Box mb="lg">
          <Button onClick={onReload} variant="filled" fullWidth mb="xs">
            Fetch More Quizzes ({HOTKEYS.CONTINUE})
          </Button>
        </Box>
        <Text mb="md">
          You've reviewed all available quizzes for this session. You can:
        </Text>
        <Box mb="xs">
          <Anchor component={Link} href={`/cards?deckId=${deckId}`}>
            Add more cards to this deck
          </Anchor>
        </Box>
        <Box mb="xs">
          <Anchor component={Link} href={`/writing/${deckId}`}>
            Practice Writing
          </Anchor>
        </Box>
        <Box>
          <Anchor component={Link} href="/review">
            Go back to deck selection
          </Anchor>
        </Box>
      </Box>
    </Container>
  );
}
