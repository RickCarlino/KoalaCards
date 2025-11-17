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
import { useHotkeys } from "@mantine/hooks";

import { prismaClient } from "@/koala/prisma-client";
import { getServersideUser } from "@/koala/get-serverside-user";
import { trpc } from "@/koala/trpc-config";
import { InputFloodLesson as InputFloodLessonComponent } from "@/koala/input-flood/InputFloodLesson";
import type { InputFloodLesson as InputFloodLessonType } from "@/koala/types/input-flood";

type GenerateResponse = {
  lesson: InputFloodLessonType;
  source: { quizResultId: number; langCode: string };
};

type SpeakingPageProps = {
  deckId: number;
};

export const getServerSideProps: GetServerSideProps<
  SpeakingPageProps
> = async (ctx) => {
  const user = await getServersideUser(ctx);
  if (!user) {
    return { redirect: { destination: "/api/auth/signin", permanent: false } };
  }

  const deckIdParam = Array.isArray(ctx.params?.deckId)
    ? ctx.params?.deckId[0]
    : ctx.params?.deckId;
  const deckIdNum = Number(deckIdParam);

  if (!Number.isFinite(deckIdNum) || deckIdNum <= 0) {
    return { redirect: { destination: "/review", permanent: false } };
  }

  const deck = await prismaClient.deck.findUnique({
    where: { userId: user.id, id: deckIdNum },
    select: { id: true },
  });

  if (!deck) {
    return { redirect: { destination: "/review", permanent: false } };
  }

  return { props: { deckId: deckIdNum } };
};

export default function SpeakingImprovementsPage({
  deckId,
}: SpeakingPageProps) {
  const [gen, setGen] = React.useState<GenerateResponse | null>(null);
  const genMutation = trpc.inputFloodGenerate.useMutation();
  const editQuizResultMutation = trpc.editQuizResult.useMutation();

  const [hasAttempted, setHasAttempted] = React.useState(false);
  const [isLessonComplete, setIsLessonComplete] = React.useState(false);
  const startedRef = React.useRef(false);

  const startLesson = async () => {
    if (genMutation.isLoading) return;
    setIsLessonComplete(false);
    setHasAttempted(true);

    const res = await genMutation.mutateAsync({});
    setGen(res as GenerateResponse);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleLessonComplete = async () => {
    if (!gen) return;

    await editQuizResultMutation.mutateAsync({
      resultId: gen.source.quizResultId,
      data: { reviewedAt: new Date() },
    });

    setGen(null);
    setIsLessonComplete(true);
    void startLesson();
  };

  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void startLesson();
  }, []);

  useHotkeys([
    [
      "space",
      (event) => {
        if (gen) return;
        if (!isLessonComplete) return;
        if (genMutation.isLoading) return;
        event.preventDefault();
        void startLesson();
      },
    ],
  ]);

  const renderContent = () => {
    if (gen) {
      return (
        <>
          <InputFloodLessonComponent
            lesson={gen.lesson}
            langCode={gen.source.langCode}
            onComplete={handleLessonComplete}
          />
          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => {
                setGen(null);
                void startLesson();
              }}
            >
              Pick Another Issue
            </Button>
          </Group>
        </>
      );
    }

    if (genMutation.isLoading) {
      return (
        <Card withBorder padding="lg">
          <Group align="center" gap="sm">
            <Loader size="sm" />
            <Text>Finding an issue and generating a drill…</Text>
          </Group>
        </Card>
      );
    }

    if (hasAttempted) {
      return (
        <Group justify="flex-end">
          <Button onClick={() => void startLesson()} variant="default">
            Start Practice
          </Button>
        </Group>
      );
    }

    return null;
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
        {renderContent()}
      </Stack>
    </Container>
  );
}
