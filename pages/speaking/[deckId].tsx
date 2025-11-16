import { GetServerSideProps } from "next";
import Link from "next/link";
import React from "react";
import {
  Anchor,
  Button,
  Card,
  Container,
  Loader,
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

export default function SpeakingImprovementsPage({
  deckId,
  picks: _initialPicks,
}: SpeakingPageProps) {
  const [gen, setGen] = React.useState<GenerateResponse | null>(null);
  const genMutation = trpc.inputFloodGenerate.useMutation();
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(
    null,
  );
  const [hasAttempted, setHasAttempted] = React.useState<boolean>(false);
  const startedRef = React.useRef<boolean>(false);

  const startRandom = async () => {
    if (isLoading) {
      return;
    }
    setHasAttempted(true);
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await genMutation.mutateAsync({});
      setGen(res as GenerateResponse);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    } catch {
      setErrorMessage(
        "We couldn't find an issue to practice right now. Please try again in a moment.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    void startRandom();
  }, []);

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
          <>
            <InputFloodLessonComponent
              lesson={gen.lesson}
              langCode={gen.source.langCode}
              onComplete={() => setGen(null)}
            />
            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => {
                  setGen(null);
                  void startRandom();
                }}
              >
                Pick Another Issue
              </Button>
            </Group>
          </>
        ) : null}

        {!gen && (genMutation.isLoading || isLoading) ? (
          <Card withBorder padding="lg">
            <Group align="center" gap="sm">
              <Loader size="sm" />
              <Text>Finding an issue and generating a drill…</Text>
            </Group>
          </Card>
        ) : null}

        {!gen && !isLoading && errorMessage ? (
          <Card withBorder padding="lg">
            <Stack gap="sm">
              <Text c="red">{errorMessage}</Text>
              <Group justify="flex-end">
                <Button
                  onClick={() => void startRandom()}
                  variant="default"
                >
                  Try Again
                </Button>
              </Group>
            </Stack>
          </Card>
        ) : null}

        {!gen && !isLoading && !errorMessage && hasAttempted ? (
          <Group justify="flex-end">
            <Button onClick={() => void startRandom()} variant="default">
              Start Practice
            </Button>
          </Group>
        ) : null}
      </Stack>
    </Container>
  );
}
