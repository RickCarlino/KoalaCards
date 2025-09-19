import { getLessonsDue } from "@/koala/fetch-lesson";
import { getServersideUser } from "@/koala/get-serverside-user";
import { playAudio } from "@/koala/play-audio";
import { useUserSettings } from "@/koala/settings-provider";
import { prismaClient } from "@/koala/prisma-client";
import { CardReview } from "@/koala/review";
import { HOTKEYS } from "@/koala/review/hotkeys";
import { useReview } from "@/koala/review/reducer";
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
import { useHotkeys } from "@mantine/hooks";
import { GetServerSideProps } from "next";
import Link from "next/link";
import React from "react";
import { trpc } from "@/koala/trpc-config";
import { InputFloodLesson as InputFloodLessonComponent } from "@/koala/input-flood/InputFloodLesson";
import type { InputFloodLesson as InputFloodLessonType } from "@/koala/types/input-flood";
import ReviewAssistantPane from "@/koala/components/ReviewAssistantPane";

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

type MinimalUserSettings = {
  id: number;
  playbackSpeed: number;
  cardsPerDayMax: number;
  playbackPercentage: number;
  dailyWritingGoal?: number;
  writingFirst?: boolean;
  updatedAt: string; // serialized
};

type ReviewDeckPageProps = {
  deckId: number;
  correctivePicks: PickedMistake[];
  userSettingsForEdit: MinimalUserSettings | null;
};

const redirect = (destination: string) => ({
  redirect: { destination, permanent: false } as const,
});

function shouldPerformCorrectiveReviews(s: unknown): boolean {
  if (!s || typeof s !== "object") {
    return true;
  }
  const v = (s as Record<string, unknown>).performCorrectiveReviews;
  return typeof v === "boolean" ? v : true;
}

async function getCorrectivePicksForUser(
  userId: string,
): Promise<PickedMistake[]> {
  const results = await prismaClient.quizResult.findMany({
    where: {
      userId,
      isAcceptable: false,
      reviewedAt: null,
      helpfulness: { gt: 0 },
    },
    orderBy: [{ createdAt: "asc" }],
    take: 10,
  });
  return results.map((r) => ({
    id: r.id,
    langCode: r.langCode,
    definition: r.definition,
    userInput: r.userInput,
    reason: r.reason,
    helpfulness: r.helpfulness,
  }));
}

export const getServerSideProps: GetServerSideProps<
  ReviewDeckPageProps
> = async (ctx) => {
  const user = await getServersideUser(ctx);
  if (!user) {
    return redirect("/api/auth/signin");
  }

  const deckId = Number(ctx.params?.deckId);
  if (!deckId) {
    return redirect("/review");
  }

  const deck = await prismaClient.deck.findUnique({
    where: { userId: user.id, id: deckId },
    select: { id: true },
  });

  if (!deck) {
    return redirect("/review");
  }

  const userSettings = await prismaClient.userSettings.findUnique({
    where: { userId: user.id },
  });

  if (!userSettings) {
    return redirect("/settings");
  }

  if ((await getLessonsDue(deck.id)) < 1) {
    return redirect("/review");
  }

  if (userSettings.writingFirst) {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    // Get user's writing progress in the last 24 hours
    const writingProgress = await prismaClient.writingSubmission.aggregate(
      {
        _sum: { correctionCharacterCount: true },
        where: {
          userId: user.id,
          createdAt: { gte: last24Hours },
        },
      },
    );

    const progress = writingProgress._sum.correctionCharacterCount ?? 0;
    const goal = userSettings.dailyWritingGoal ?? 100;
    if (progress < goal) {
      return {
        redirect: {
          destination: `/writing/${deckId}`,
          permanent: false,
        },
      };
    }
  }

  const correctivePicks = shouldPerformCorrectiveReviews(userSettings)
    ? await getCorrectivePicksForUser(user.id)
    : [];
  const userSettingsForEdit: MinimalUserSettings | null = userSettings
    ? {
        id: userSettings.id,
        playbackSpeed: userSettings.playbackSpeed,
        cardsPerDayMax: userSettings.cardsPerDayMax,
        playbackPercentage: userSettings.playbackPercentage,
        dailyWritingGoal: userSettings.dailyWritingGoal ?? undefined,
        writingFirst: userSettings.writingFirst ?? undefined,
        updatedAt: userSettings.updatedAt.toISOString(),
      }
    : null;

  return {
    props: {
      deckId,
      correctivePicks,
      userSettingsForEdit,
    },
  };
};

const MessageState = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <Container size="md" py="xl">
    <Box p="md">
      <Title order={3} mb="md">
        {title}
      </Title>
      <Text>{children}</Text>
    </Box>
  </Container>
);

const NoMoreQuizzesState = ({
  deckId,
  onReload,
}: {
  deckId: number;
  onReload: () => void;
}) => {
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
};

function InterstitialPrompt({
  open,
  hasPicks,
  onYes,
  onNo,
  onDontAskAgain,
}: {
  open: boolean;
  hasPicks: boolean;
  onYes: () => void;
  onNo: () => void;
  onDontAskAgain: () => void;
}) {
  if (!open || !hasPicks) {
    return null;
  }
  return (
    <Card withBorder padding="md" mb="md">
      <Stack gap={8}>
        <Title order={4}>Work on speaking improvements now?</Title>
        <Text c="dimmed" size="sm">
          Pick one issue to practice after this session. It won’t interrupt
          your review.
        </Text>
        <Group>
          <Button variant="filled" onClick={onYes}>
            Yes
          </Button>
          <Button variant="default" onClick={onNo}>
            No
          </Button>
          <Button variant="subtle" color="red" onClick={onDontAskAgain}>
            Don’t ask again
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

function CorrectiveBanner({
  picks,
  onStart,
  onHelpful,
  onNotHelpful,
  onDismiss,
}: {
  picks: PickedMistake[];
  onStart: (id: number) => void;
  onHelpful: (id: number, helpful: boolean) => void;
  onNotHelpful: (id: number) => void;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());
  if (!picks.length) {
    return null;
  }
  return (
    <Box
      mb="md"
      p="sm"
      role="region"
      aria-label="Corrective practice"
      style={{
        border: "1px solid #eee",
        borderRadius: 8,
        position: "relative",
      }}
    >
      <Button
        variant="subtle"
        size="compact-sm"
        aria-label="Dismiss corrective banner"
        onClick={onDismiss}
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          padding: 4,
          minWidth: 32,
        }}
      >
        ×
      </Button>
      <Stack gap={6}>
        {picks.slice(0, 5).map((p) => (
          <Stack key={p.id} gap={4}>
            <Group gap={8} align="center">
              <Button
                size="sm"
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
            {expanded.has(p.id) && (
              <Text id={`reason-${p.id}`} size="sm" c="dimmed">
                {p.reason}
              </Text>
            )}
            <Group gap={6}>
              <Button
                size="sm"
                variant={p.helpfulness > 0 ? "filled" : "subtle"}
                color="green"
                aria-label="Mark helpful"
                aria-pressed={p.helpfulness > 0}
                onClick={() => onHelpful(p.id, !(p.helpfulness > 0))}
              >
                👍
              </Button>
              <Button
                size="sm"
                variant="subtle"
                color="red"
                aria-label="Mark not helpful"
                onClick={() => onNotHelpful(p.id)}
              >
                👎
              </Button>
              <Button
                size="sm"
                variant="light"
                aria-label="Prepare corrective drill"
                onClick={() => onStart(p.id)}
              >
                Add to Current Review
              </Button>
            </Group>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function InnerReviewPage({
  deckId,
  correctivePicks,
  userSettingsForEdit,
}: ReviewDeckPageProps) {
  const [assistantOpen, setAssistantOpen] = React.useState(false);
  const [picks, setPicks] =
    React.useState<PickedMistake[]>(correctivePicks);
  const [gen, setGen] = React.useState<GenerateResponse | null>(null);
  const genMutation = trpc.inputFloodGenerate.useMutation();
  const editResult = trpc.editQuizResult.useMutation();
  const editUserSettings = trpc.editUserSettings.useMutation();
  const [gateOpen, setGateOpen] = React.useState<boolean>(
    picks.length > 0,
  );
  const [showBanner, setShowBanner] = React.useState<boolean>(false);
  const {
    state,
    isFetching,
    error,
    currentItem,
    skipCard,
    giveUp,
    completeItem,
    refetchQuizzes,
    onGradingResultCaptured,
    progress,
    cardsRemaining,
  } = useReview(deckId);
  const userSettings = useUserSettings();

  async function playCard() {
    switch (currentItem?.itemType) {
      case "remedialIntro":
      case "newWordIntro":
        return await playAudio(
          card.termAndDefinitionAudio,
          userSettings.playbackSpeed,
        );
      case "speaking":
      case "newWordOutro":
      case "remedialOutro":
        return await playAudio(
          card.definitionAudio,
          userSettings.playbackSpeed,
        );
      default:
        console.warn("No audio available for this card type.");
    }
  }

  // useEffect, call playCard when the currentItem changes:
  React.useEffect(() => {
    if (currentItem) {
      playCard();
    }
  }, [currentItem]);
  const startDrill = async (id: number) => {
    try {
      const res = await genMutation.mutateAsync({ resultId: id });
      setGen(res as GenerateResponse);
    } catch {
      // non-blocking; ignore here
    }
  };

  if (error) {
    return <MessageState title="Error">{error.message}</MessageState>;
  }
  if (isFetching) {
    return <MessageState title="Loading">Fetching quizzes…</MessageState>;
  }
  if (!currentItem) {
    if (gen) {
      return (
        <Container size="md" py="xl">
          <InputFloodLessonComponent
            lesson={gen.lesson}
            langCode={gen.source.langCode}
            onComplete={() => {
              const id = gen?.source.quizResultId;
              const p = id
                ? editResult.mutateAsync({
                    resultId: id,
                    data: { reviewedAt: new Date() },
                  })
                : Promise.resolve();
              p.finally(() => location.replace("/review"));
            }}
          />
        </Container>
      );
    }
    return (
      <NoMoreQuizzesState deckId={deckId} onReload={refetchQuizzes} />
    );
  }

  const card = state.cards[currentItem.cardUUID];
  if (!card) {
    return <MessageState title="Oops">No card data.</MessageState>;
  }

  return (
    <Container size="xl" py="md">
      <Box p="md">
        <InterstitialPrompt
          open={gateOpen}
          hasPicks={picks.length > 0}
          onYes={() => {
            setShowBanner(true);
            setGateOpen(false);
          }}
          onNo={() => {
            setShowBanner(false);
            setGateOpen(false);
          }}
          onDontAskAgain={() => {
            if (!userSettingsForEdit) {
              setGateOpen(false);
              return;
            }
            void editUserSettings
              .mutateAsync({
                ...userSettingsForEdit,
                updatedAt: new Date(userSettingsForEdit.updatedAt),
                performCorrectiveReviews: false,
              })
              .finally(() => setGateOpen(false));
          }}
        />
        {showBanner && picks.length > 0 && !gen && (
          <CorrectiveBanner
            picks={picks}
            onStart={(id) => {
              setShowBanner(false);
              void startDrill(id);
            }}
            onDismiss={() => setShowBanner(false)}
            onHelpful={(id, helpful) => {
              setPicks((prev) =>
                prev.map((p) =>
                  p.id === id ? { ...p, helpfulness: helpful ? 1 : 0 } : p,
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
        )}
        <CardReview
          card={card}
          itemType={currentItem.itemType}
          onSkip={skipCard}
          onGiveUp={giveUp}
          onProceed={() => {
            completeItem(currentItem.stepUuid);
          }}
          onPlayAudio={playCard}
          currentStepUuid={currentItem.stepUuid}
          completeItem={completeItem}
          onGradingResultCaptured={onGradingResultCaptured}
          progress={progress}
          cardsRemaining={cardsRemaining}
          onOpenAssistant={() => setAssistantOpen(true)}
          disableRecord={Boolean(
            state.gradingResults[currentItem.cardUUID]?.isCorrect,
          )}
        />
        {gen && (
          <Group justify="center" mt="sm">
            <Text size="sm" c="dimmed">
              Corrective drill ready. It will start after this session.
            </Text>
          </Group>
        )}
      </Box>
      <ReviewAssistantPane
        deckId={deckId}
        current={{
          term: card.term,
          definition: card.definition,
          langCode: card.langCode,
          lessonType: card.lessonType,
        }}
        opened={assistantOpen}
        onOpen={() => setAssistantOpen(true)}
        onClose={() => setAssistantOpen(false)}
        showFloatingButton={false}
      />
    </Container>
  );
}

export default function ReviewDeckPageWrapper(props: ReviewDeckPageProps) {
  return <InnerReviewPage {...props} />;
}
