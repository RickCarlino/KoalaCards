import { useState } from "react";
import { useRouter } from "next/router";
import {
  Button,
  Card,
  Center,
  Group,
  Loader,
  Grid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { InputFloodLesson } from "@/koala/test-zone/PrototypeLesson";
import { trpc } from "@/koala/trpc-config";
import type { GetServerSideProps } from "next";
import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { IconThumbUp, IconThumbDown } from "@tabler/icons-react";
type Sentence = { text: string; en: string };
type InputFloodLite = {
  language: string;
  diagnosis: {
    target_label: string;
    contrast_label?: string | null;
    why_error: string;
    rules: string[];
  };
  flood: { A: Sentence[]; B?: Sentence[] | null };
  production: { prompt_en: string; answer: string }[];
  takeaways: string[];
  fix: { original: string; corrected: string };
};
type GenerateResponseLite = {
  lesson: InputFloodLite;
  source: { quizResultId: number; langCode: string };
};

type PickedMistake = {
  id: number;
  langCode: string;
  definition: string;
  userInput: string;
  reason: string;
  helpfulness: number;
};

type TestZoneProps = {
  picks: PickedMistake[];
};

export default function TestZone({ picks }: TestZoneProps) {
  const router = useRouter();
  const [data, setData] = useState<GenerateResponseLite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gen = trpc.inputFloodGenerate.useMutation();
  const editResult = trpc.editQuizResult.useMutation();
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [helpfulIds, setHelpfulIds] = useState<Set<number>>(
    () => new Set(picks.filter((p) => p.helpfulness > 0).map((p) => p.id)),
  );

  const startFromPick = async (resultId: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await gen.mutateAsync({ resultId });
      setData(res as GenerateResponseLite);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Failed to load";
      setError(m);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center style={{ width: "100%", padding: "1.5rem" }}>
      <Stack style={{ width: "min(1000px, 92%)" }} gap="lg">
        <Group justify="space-between">
          <Title order={2}>Practice</Title>
        </Group>
        {loading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : null}
        {error ? (
          <Card withBorder padding="md">
            <Text c="red">{error}</Text>
          </Card>
        ) : null}
        {!loading && !error && !data ? (
          picks.length === 0 ? (
            <Card withBorder padding="md">
              <Stack>
                <Text>No recent items found.</Text>
                <Text c="dimmed" size="sm">
                  Try practicing first, then come back to generate a
                  lesson.
                </Text>
              </Stack>
            </Card>
          ) : (
            <Stack>
              <Text c="dimmed">Pick something to work on</Text>
              <Grid gutter="md">
                {picks
                  .filter((p) => !hidden.has(p.id))
                  .map((p) => (
                    <Grid.Col key={p.id} span={{ base: 12, sm: 6, md: 4 }}>
                      <Card withBorder padding="sm">
                        <Stack gap={6}>
                          <Text size="xs" c="dimmed">
                            Expected
                          </Text>
                          <Text fw={600} size="sm" lineClamp={2}>
                            {p.definition}
                          </Text>
                          <Text size="xs" c="dimmed">
                            Your attempt
                          </Text>
                          <Text c="red" size="sm" lineClamp={2}>
                            {p.userInput}
                          </Text>
                          <Stack gap="xs">
                            <Button
                              onClick={() => startFromPick(p.id)}
                              loading={loading}
                              variant="light"
                              size="sm"
                            >
                              Start lesson
                            </Button>
                            <Group gap="xs">
                              <Button
                                variant={
                                  helpfulIds.has(p.id)
                                    ? "filled"
                                    : "subtle"
                                }
                                color="green"
                                size="sm"
                                aria-pressed={helpfulIds.has(p.id)}
                                onClick={() => {
                                  setHelpfulIds((prev) => {
                                    const next = new Set(prev);
                                    const isHelpful = next.has(p.id);
                                    if (isHelpful) {
                                      next.delete(p.id);
                                    } else {
                                      next.add(p.id);
                                    }
                                    // Persist toggle: 1 -> 0, 0 -> 1
                                    editResult.mutate({
                                      resultId: p.id,
                                      data: {
                                        helpfulness: isHelpful ? 0 : 1,
                                      },
                                    });
                                    return next;
                                  });
                                }}
                                leftSection={<IconThumbUp size={16} />}
                              >
                                Helpful
                              </Button>
                              <Button
                                variant="subtle"
                                size="sm"
                                color="red"
                                onClick={() => {
                                  setHelpfulIds((prev) => {
                                    const next = new Set(prev);
                                    next.delete(p.id);
                                    return next;
                                  });
                                  setHidden((prev) =>
                                    new Set(prev).add(p.id),
                                  );
                                  editResult.mutate({
                                    resultId: p.id,
                                    data: { helpfulness: -1 },
                                  });
                                }}
                                leftSection={<IconThumbDown size={16} />}
                              >
                                Not helpful
                              </Button>
                            </Group>
                          </Stack>
                        </Stack>
                      </Card>
                    </Grid.Col>
                  ))}
              </Grid>
            </Stack>
          )
        ) : null}
        {data ? (
          <InputFloodLesson
            lesson={data.lesson}
            langCode={data.source.langCode}
            onComplete={() => {
              const id = data?.source.quizResultId;
              const p = id
                ? editResult.mutateAsync({
                    resultId: id,
                    data: { reviewedAt: new Date() },
                  })
                : Promise.resolve();
              p.finally(() => router.reload());
            }}
          />
        ) : null}
      </Stack>
    </Center>
  );
}

export const getServerSideProps: GetServerSideProps<
  TestZoneProps
> = async (context) => {
  const dbUser = await getServersideUser(context);
  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  const results = await prismaClient.quizResult.findMany({
    where: {
      userId: dbUser.id,
      isAcceptable: false,
      reviewedAt: null,
      helpfulness: { gte: 0 },
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  const picks = results.map((r) => ({
    id: r.id,
    langCode: r.langCode,
    definition: r.definition,
    userInput: r.userInput,
    reason: r.reason,
    helpfulness: r.helpfulness,
  }));

  return { props: { picks } };
};
