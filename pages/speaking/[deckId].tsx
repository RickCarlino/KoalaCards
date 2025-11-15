import { GetServerSideProps } from "next";
import Link from "next/link";
import React from "react";
import {
  Anchor,
  Box,
  Button,
  Card,
  Container,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";

import { prismaClient } from "@/koala/prisma-client";
import { getServersideUser } from "@/koala/get-serverside-user";
import { trpc } from "@/koala/trpc-config";
import { InputFloodLesson as InputFloodLessonComponent } from "@/koala/input-flood/InputFloodLesson";
import type { InputFloodLesson as InputFloodLessonType } from "@/koala/types/input-flood";

type PickedMistake = {
  id: number;
  langCode: string;
  definition: string;
  userInput: string;
  reason: string;
  helpfulness: number;
};

type GenerateResponse = {
  lesson: InputFloodLessonType;
  source: { quizResultId: number; langCode: string };
};

type SpeakingPageProps = {
  deckId: number;
  picks: PickedMistake[];
};

async function getCorrectivePicksForUser(
  userId: string,
): Promise<PickedMistake[]> {
  const results = await prismaClient.quizResult.findMany({
    where: {
      userId,
      isAcceptable: false,
      helpfulness: { gt: 0 },
    },
    orderBy: [{ createdAt: "asc" }],
    take: 25,
  });
  return results.map((r) => ({
    id: r.id,
    langCode: "ko",
    definition: r.definition,
    userInput: r.userInput,
    reason: r.reason,
    helpfulness: r.helpfulness,
  }));
}

export const getServerSideProps: GetServerSideProps<
  SpeakingPageProps
> = async (ctx) => {
  const user = await getServersideUser(ctx);
  if (!user) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  const deckId = Number(ctx.params?.deckId);
  if (!deckId) {
    return { redirect: { destination: "/review", permanent: false } };
  }

  const deck = await prismaClient.deck.findUnique({
    where: { userId: user.id, id: deckId },
    select: { id: true },
  });
  if (!deck) {
    return { redirect: { destination: "/review", permanent: false } };
  }

  const picks = await getCorrectivePicksForUser(user.id);
  return { props: { deckId, picks } };
};

function PicksList({
  picks,
  onStart,
  onHelpful,
  onNotHelpful,
}: {
  picks: PickedMistake[];
  onStart: (id: number) => void;
  onHelpful: (id: number, helpful: boolean) => void;
  onNotHelpful: (id: number) => void;
}) {
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());
  if (!picks.length) {
    return (
      <Card withBorder padding="lg">
        <Stack gap="xs">
          <Title order={4}>No suggestions yet</Title>
          <Text c="dimmed" size="sm">
            We’ll show speaking improvements here after you make a few
            attempts during reviews.
          </Text>
        </Stack>
      </Card>
    );
  }
  return (
    <Stack gap={8}>
      {picks.map((p) => (
        <Card key={p.id} withBorder padding="md">
          <Stack gap={6}>
            <Group gap={8} align="center">
              <Button
                size="xs"
                variant="subtle"
                aria-expanded={expanded.has(p.id)}
                aria-controls={`reason-${p.id}`}
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    next.has(p.id) ? next.delete(p.id) : next.add(p.id);
                    return next;
                  })
                }
              >
                Details
              </Button>
              <Text
                size="sm"
                style={{ flex: 1 }}
                lineClamp={1}
                title={p.definition}
              >
                {p.definition}
              </Text>
            </Group>
            {expanded.has(p.id) ? (
              <Text id={`reason-${p.id}`} size="sm" c="dimmed">
                {p.reason}
              </Text>
            ) : null}
            <Group gap={8}>
              <Button
                size="sm"
                variant="light"
                onClick={() => onStart(p.id)}
              >
                Start Drill
              </Button>
              <Button
                size="sm"
                variant={p.helpfulness > 0 ? "filled" : "subtle"}
                color="green"
                aria-pressed={p.helpfulness > 0}
                onClick={() => onHelpful(p.id, !(p.helpfulness > 0))}
              >
                Helpful
              </Button>
              <Button
                size="sm"
                variant="subtle"
                color="red"
                onClick={() => onNotHelpful(p.id)}
              >
                Not Helpful
              </Button>
            </Group>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

export default function SpeakingImprovementsPage({
  deckId,
  picks: initialPicks,
}: SpeakingPageProps) {
  const [picks, setPicks] = React.useState<PickedMistake[]>(initialPicks);
  const [gen, setGen] = React.useState<GenerateResponse | null>(null);
  const genMutation = trpc.inputFloodGenerate.useMutation();
  const editResult = trpc.editQuizResult.useMutation();

  const startDrill = async (id: number) => {
    try {
      const res = await genMutation.mutateAsync({ resultId: id });
      setGen(res as GenerateResponse);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // do nothing; non-blocking UI
    }
  };

  return (
    <Container size="md" py="xl">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={2}>Speaking Improvements</Title>
          <Anchor component={Link} href={`/review/${deckId}`}>
            Back to Review
          </Anchor>
        </Group>

        {gen ? (
          <Card withBorder padding="lg">
            <Stack gap="md">
              <Title order={4}>Drill</Title>
              <InputFloodLessonComponent
                lesson={gen.lesson}
                langCode={gen.source.langCode}
                onComplete={() => setGen(null)}
              />
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setGen(null)}>
                  Pick Another Issue
                </Button>
              </Group>
            </Stack>
          </Card>
        ) : null}

        {!gen ? (
          <Box>
            <Title order={4} mb="xs">
              Pick an issue to practice
            </Title>
            <PicksList
              picks={picks}
              onStart={startDrill}
              onHelpful={(id, helpful) => {
                setPicks((prev) =>
                  prev.map((p) =>
                    p.id === id
                      ? { ...p, helpfulness: helpful ? 1 : 0 }
                      : p,
                  ),
                );
                editResult.mutate({
                  resultId: id,
                  data: { helpfulness: helpful ? 1 : 0 },
                });
              }}
              onNotHelpful={(id) => {
                setPicks((prev) => prev.filter((p) => p.id !== id));
                editResult.mutate({
                  resultId: id,
                  data: { helpfulness: -1 },
                });
              }}
            />
          </Box>
        ) : null}
      </Stack>
    </Container>
  );
}
