import { useState } from "react";
import { useRouter } from "next/router";
import {
  ActionIcon,
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
import { InputFloodLesson as InputFloodLessonComponent } from "@/koala/input-flood/InputFloodLesson";
import type { InputFloodLesson as InputFloodLessonType } from "@/koala/types/input-flood";
import { trpc } from "@/koala/trpc-config";
import type { GetServerSideProps } from "next";
import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { INPUT_FLOOD_UI_PICKS_TAKE } from "@/koala/types/input-flood";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";

type GenerateResponse = {
  lesson: InputFloodLessonType;
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

type BetaProps = { picks: PickedMistake[] };

function PickCard({
  p,
  helpful,
  onToggleHelpful,
  onNotHelpful,
  onStart,
  loading,
}: {
  p: PickedMistake;
  helpful: boolean;
  onToggleHelpful: () => void;
  onNotHelpful: () => void;
  onStart: () => void;
  loading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card withBorder padding="sm">
      <Stack gap={6}>
        <Group
          gap={6}
          align="center"
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpanded((v) => !v);
            }
          }}
          style={{ cursor: "pointer" }}
        >
          <ActionIcon
            variant="subtle"
            aria-label={
              expanded ? "Collapse explanation" : "Expand explanation"
            }
          >
            {expanded ? (
              <IconChevronUp size={14} />
            ) : (
              <IconChevronDown size={14} />
            )}
          </ActionIcon>
          <Text fw={600} size="sm" lineClamp={2}>
            {p.definition}
          </Text>
        </Group>
        <Text size="sm" c="dimmed" lineClamp={expanded ? 999 : 3}>
          {p.reason}
        </Text>
        <Group gap="xs">
          <Button
            variant={helpful ? "filled" : "subtle"}
            color="green"
            size="sm"
            aria-pressed={helpful}
            aria-label="Mark helpful"
            onClick={onToggleHelpful}
          >
            👍
          </Button>
          <Button
            variant="subtle"
            size="sm"
            color="red"
            aria-label="Mark not helpful and hide"
            onClick={onNotHelpful}
          >
            👎
          </Button>
          <Button
            onClick={onStart}
            loading={loading}
            variant="light"
            size="sm"
            aria-label="Start lesson"
          >
            Study This
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

export default function Beta({ picks }: BetaProps) {
  const router = useRouter();
  const [data, setData] = useState<GenerateResponse | null>(null);
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
      setData(res as GenerateResponse);
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
                {(() => {
                  const visible = picks.filter((p) => !hidden.has(p.id));
                  const helpful = visible.filter((p) =>
                    helpfulIds.has(p.id),
                  );
                  const neutral = visible.filter(
                    (p) => !helpfulIds.has(p.id),
                  );
                  return [...helpful, ...neutral];
                })().map((p) => (
                  <Grid.Col key={p.id} span={{ base: 12, sm: 6, md: 4 }}>
                    <PickCard
                      p={p}
                      helpful={helpfulIds.has(p.id)}
                      onToggleHelpful={() => {
                        setHelpfulIds((prev) => {
                          const next = new Set(prev);
                          const isHelpful = next.has(p.id);
                          if (isHelpful) {
                            next.delete(p.id);
                          } else {
                            next.add(p.id);
                          }
                          editResult.mutate({
                            resultId: p.id,
                            data: { helpfulness: isHelpful ? 0 : 1 },
                          });
                          return next;
                        });
                      }}
                      onNotHelpful={() => {
                        setHelpfulIds((prev) => {
                          const next = new Set(prev);
                          next.delete(p.id);
                          return next;
                        });
                        setHidden((prev) => new Set(prev).add(p.id));
                        editResult.mutate({
                          resultId: p.id,
                          data: { helpfulness: -1 },
                        });
                      }}
                      onStart={() => startFromPick(p.id)}
                      loading={loading}
                    />
                  </Grid.Col>
                ))}
              </Grid>
            </Stack>
          )
        ) : null}
        {data ? (
          <InputFloodLessonComponent
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

export const getServerSideProps: GetServerSideProps<BetaProps> = async (
  context,
) => {
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
    orderBy: [{ helpfulness: "desc" }, { createdAt: "desc" }],
    take: INPUT_FLOOD_UI_PICKS_TAKE,
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
