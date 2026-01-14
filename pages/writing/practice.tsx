import { getServersideUser } from "@/koala/get-serverside-user";
import { VisualDiff } from "@/koala/review/lesson-steps/visual-diff";
import { LangCode } from "@/koala/shared-types";
import { trpc } from "@/koala/trpc-config";
import {
  Alert,
  Box,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  Progress,
  Stack,
  Text,
  Textarea,
  Title,
  useMantineTheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck } from "@tabler/icons-react";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { alphabetical } from "radash";
import { useCallback, useMemo, useState } from "react";

type WritingPracticeProps = {
  returnTo: string | null;
};

type Feedback = {
  fullCorrection: string;
  fullText: string;
  feedback: string[];
};

type Definition = {
  word: string;
  lemma: string | null;
  definition: string;
};

type Step = "writing" | "feedback";

type WritingStepProps = {
  prompt: string;
  onPromptChange: (value: string) => void;
  essay: string;
  onEssayChange: (value: string) => void;
  loadingReview: boolean;
  onReview: () => void;
  progress: number;
  goal?: number;
};

type ClickableTextProps = {
  text: string;
  selectedWords: Record<string, boolean>;
  onToggleWord: (token: string) => void;
};

type FeedbackStepProps = {
  prompt: string;
  essay: string;
  corrected: string;
  feedbackItems: string[];
  selectedWords: Record<string, boolean>;
  onToggleWord: (token: string) => void;
  selectedCount: number;
  onExplain: () => void;
  onCreateCards: () => void;
  onWriteMore: () => void;
  onGoToReview: () => void;
  reviewLabel: string;
  canExplain: boolean;
  canCreate: boolean;
  definitions: Definition[];
  definitionsLoading: boolean;
  definitionsError: string | null;
};

type FeedbackActionsProps = {
  selectedCount: number;
  definitionsCount: number;
  onExplain: () => void;
  canExplain: boolean;
  onCreateCards: () => void;
  canCreate: boolean;
  onWriteMore: () => void;
  onGoToReview: () => void;
  reviewLabel: string;
};

type DefinitionsPanelProps = {
  definitions: Definition[];
  loading: boolean;
  error: string | null;
};

const DEFAULT_PROMPT = "Not set.";

const isSafeReturnTo = (value: string) =>
  value.startsWith("/") && !value.startsWith("//");

const normalizeToken = (token: string) =>
  token.replace(/[.,!?;:]$/, "").toLowerCase();

const shouldShowLemma = (definition: Definition) => {
  if (!definition.lemma) {
    return false;
  }

  return definition.lemma.toLowerCase() !== definition.word.toLowerCase();
};

const getCardWord = (definition: Definition) =>
  shouldShowLemma(definition) && definition.lemma
    ? definition.lemma
    : definition.word;

const buildContextText = (
  prompt: string,
  essay: string,
  corrected: string,
) => {
  const sections: string[] = [];

  if (prompt.trim()) {
    sections.push(`Prompt:\n${prompt}`);
  }

  if (essay.trim()) {
    sections.push(`Essay:\n${essay}`);
  }

  if (corrected.trim()) {
    sections.push(`Corrected Text:\n${corrected}`);
  }

  return sections.join("\n\n");
};

const getRemainingGoalCharacters = (progress: number, goal: number) =>
  Math.max(goal - progress, 0);

export const getServerSideProps: GetServerSideProps<
  WritingPracticeProps
> = async (ctx) => {
  const dbUser = await getServersideUser(ctx);
  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  const returnTo =
    typeof ctx.query.returnTo === "string" ? ctx.query.returnTo : null;

  return {
    props: {
      returnTo,
    },
  };
};

function WritingProgress({
  progress,
  goal,
  essayLength,
}: {
  progress: number;
  goal?: number;
  essayLength: number;
}) {
  const theme = useMantineTheme();
  const currentCount = progress + essayLength;
  const hasGoal = typeof goal === "number";
  const goalReached = hasGoal && currentCount >= goal;

  return (
    <Box mb="md">
      <Stack gap="xs" style={{ flexGrow: 1 }}>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {currentCount} characters
            {hasGoal ? ` / ${goal} goal` : ""}
          </Text>
          {goalReached && (
            <Group gap="xs">
              <IconCheck size={16} color={theme.colors.teal[6]} />
              <Text size="sm" c="teal">
                Goal reached!
              </Text>
            </Group>
          )}
        </Group>
        {hasGoal && (
          <Progress
            value={Math.min((currentCount / goal) * 100, 100)}
            size="sm"
            color="blue"
            {...(goalReached ? { striped: true, animated: true } : {})}
          />
        )}
      </Stack>
    </Box>
  );
}

function WritingStep({
  prompt,
  onPromptChange,
  essay,
  onEssayChange,
  loadingReview,
  onReview,
  progress,
  goal,
}: WritingStepProps) {
  const canReview = essay.trim().length > 0;

  const reviewControl = loadingReview ? (
    <Group>
      <Loader size="sm" />
      <Text c="dimmed">Analyzing your writing...</Text>
    </Group>
  ) : (
    <Button onClick={onReview} disabled={!canReview}>
      Save and Review Feedback
    </Button>
  );

  return (
    <Paper withBorder shadow="sm" p="md">
      <Title order={4} mb="xs">
        Essay Title or Prompt
      </Title>
      <Textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.currentTarget.value)}
        autosize
        minRows={2}
        maxRows={4}
        mb="md"
        disabled={loadingReview}
      />
      <Text size="sm" c="dimmed" mb="xs">
        TIP: Don't know a word? Surround the word you want to use in
        question marks and it will be replaced with an appropriate word
        when graded. Example: ?apple?를 먹어요.
      </Text>

      <Textarea
        placeholder="Write your essay here..."
        autosize
        minRows={6}
        maxRows={12}
        value={essay}
        onChange={(e) => onEssayChange(e.currentTarget.value)}
        mb="xs"
        disabled={loadingReview}
      />

      <WritingProgress
        progress={progress}
        goal={goal}
        essayLength={essay.length}
      />

      {reviewControl}
    </Paper>
  );
}

function ClickableText({
  text,
  selectedWords,
  onToggleWord,
}: ClickableTextProps) {
  const theme = useMantineTheme();

  if (!text) {
    return null;
  }

  return (
    <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
      {text.split(/(\s+)/).map((token, index) => {
        if (/\s+/.test(token)) {
          return <span key={index}>{token}</span>;
        }

        const normalizedToken = normalizeToken(token);
        const isSelected = Boolean(selectedWords[normalizedToken]);

        return (
          <Text
            component="span"
            key={index}
            style={{
              cursor: "pointer",
              backgroundColor: isSelected
                ? theme.colors.yellow[2]
                : undefined,
              borderRadius: theme.radius.sm,
              padding: "0 2px",
              margin: "0 1px",
              display: "inline-block",
            }}
            onClick={() => onToggleWord(token)}
          >
            {token}
          </Text>
        );
      })}
    </Text>
  );
}

function DefinitionList({ definitions }: { definitions: Definition[] }) {
  return (
    <Stack gap="xs">
      <Text fw={600}>Word Definitions</Text>
      {alphabetical(definitions, (x) => x.definition).map((d, i) => {
        const showLemma = shouldShowLemma(d);
        return (
          <Box key={`${d.word}-${i}`}>
            <Text fw={700} component="span">
              {d.word}
            </Text>
            {showLemma && (
              <Text component="span" c="dimmed" fs="italic">
                {" "}
                ({d.lemma})
              </Text>
            )}
            <Text component="span">: {d.definition}</Text>
          </Box>
        );
      })}
    </Stack>
  );
}

function DefinitionsPanel({
  definitions,
  loading,
  error,
}: DefinitionsPanelProps) {
  const hasDefinitions = definitions.length > 0;

  if (loading) {
    return (
      <Box
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Loader size="sm" color="blue" />
        <Text ml="sm" c="dimmed">
          Getting definitions...
        </Text>
      </Box>
    );
  }

  return (
    <>
      {error && (
        <Alert title="Error" color="red">
          {error}
        </Alert>
      )}
      {hasDefinitions && <DefinitionList definitions={definitions} />}
    </>
  );
}

function FeedbackActions({
  selectedCount,
  definitionsCount,
  onExplain,
  canExplain,
  onCreateCards,
  canCreate,
  onWriteMore,
  onGoToReview,
  reviewLabel,
}: FeedbackActionsProps) {
  return (
    <Group>
      <Button onClick={onExplain} disabled={!canExplain}>
        Explain Selected Words ({selectedCount})
      </Button>
      {canCreate && (
        <Button onClick={onCreateCards}>
          Create Cards from Words ({definitionsCount})
        </Button>
      )}
      <Button onClick={onWriteMore} variant="outline">
        Write More
      </Button>
      <Button onClick={onGoToReview} variant="filled">
        {reviewLabel}
      </Button>
    </Group>
  );
}

function FeedbackStep({
  prompt,
  essay,
  corrected,
  feedbackItems,
  selectedWords,
  onToggleWord,
  selectedCount,
  onExplain,
  onCreateCards,
  onWriteMore,
  onGoToReview,
  reviewLabel,
  canExplain,
  canCreate,
  definitions,
  definitionsLoading,
  definitionsError,
}: FeedbackStepProps) {
  return (
    <Paper withBorder shadow="sm" p="md" mt="md">
      <Stack gap="md">
        <Title order={3}>Feedback (Click unknown words)</Title>
        <Text fw={600}>Selected Prompt</Text>
        <ClickableText
          text={prompt}
          selectedWords={selectedWords}
          onToggleWord={onToggleWord}
        />
        <Text fw={600}>Original Text</Text>
        <ClickableText
          text={essay}
          selectedWords={selectedWords}
          onToggleWord={onToggleWord}
        />
        <Text fw={600}>Corrected Text</Text>
        <ClickableText
          text={corrected}
          selectedWords={selectedWords}
          onToggleWord={onToggleWord}
        />
        <Text fw={600}>Changes</Text>
        <VisualDiff actual={essay} expected={corrected} />
        {feedbackItems.length > 0 && (
          <>
            <Text fw={600}>Feedback</Text>
            {feedbackItems.map((feedbackItem, itemIdx) => (
              <Box key={itemIdx} mb="xs">
                <ClickableText
                  text={`• ${feedbackItem}`}
                  selectedWords={selectedWords}
                  onToggleWord={onToggleWord}
                />
              </Box>
            ))}
          </>
        )}

        <FeedbackActions
          selectedCount={selectedCount}
          definitionsCount={definitions.length}
          onExplain={onExplain}
          canExplain={canExplain}
          onCreateCards={onCreateCards}
          canCreate={canCreate}
          onWriteMore={onWriteMore}
          onGoToReview={onGoToReview}
          reviewLabel={reviewLabel}
        />

        <DefinitionsPanel
          definitions={definitions}
          loading={definitionsLoading}
          error={definitionsError}
        />
      </Stack>
    </Paper>
  );
}

export default function WritingPracticePage({
  returnTo,
}: WritingPracticeProps) {
  const router = useRouter();
  const langCode: LangCode = "ko";
  const safeReturnTo = useMemo(() => {
    if (!returnTo) {
      return null;
    }

    return isSafeReturnTo(returnTo) ? returnTo : null;
  }, [returnTo]);
  const reviewLabel = safeReturnTo ? "Continue Review" : "Study Cards";
  const reviewTarget = safeReturnTo ?? "/review";

  const [currentStep, setCurrentStep] = useState<Step>("writing");
  const [essay, setEssay] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [selectedWords, setSelectedWords] = useState<
    Record<string, boolean>
  >({});
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [definitionsLoading, setDefinitionsLoading] = useState(false);
  const [definitionsError, setDefinitionsError] = useState<string | null>(
    null,
  );

  const dailyWritingProgressQuery = trpc.getDailyWritingProgress.useQuery(
    {},
    { refetchOnWindowFocus: false },
  );
  const { data: writingProgressData, refetch: refetchWritingProgress } =
    dailyWritingProgressQuery;

  const gradeWriting = trpc.gradeWriting.useMutation({
    onSuccess: (data) => {
      setFeedback(data);
      setLoadingReview(false);
      setCurrentStep("feedback");
      dailyWritingProgressQuery.refetch();
    },
    onError: (err) => {
      notifications.show({
        title: "Review Failed",
        message: err.message,
        color: "red",
      });
      setLoadingReview(false);
    },
  });

  const defineWords = trpc.defineUnknownWords.useMutation();

  const clearDefinitionResults = useCallback(() => {
    setDefinitions([]);
    setDefinitionsError(null);
  }, []);

  const resetSelection = useCallback(() => {
    setSelectedWords({});
    clearDefinitionResults();
  }, [clearDefinitionResults]);

  const handleReview = useCallback(() => {
    if (!essay.trim()) {
      return;
    }

    setLoadingReview(true);
    setFeedback(null);
    resetSelection();
    gradeWriting.mutate({
      prompt,
      text: essay,
    });
  }, [essay, gradeWriting, prompt, resetSelection]);

  const handleWriteMore = useCallback(() => {
    setCurrentStep("writing");
    setPrompt(DEFAULT_PROMPT);
    setEssay("");
    setFeedback(null);
    resetSelection();
  }, [resetSelection]);

  const toggleWord = useCallback(
    (raw: string) => {
      const key = normalizeToken(raw);
      if (!key) {
        return;
      }

      setSelectedWords((prev) => {
        const copy = { ...prev };
        copy[key] ? delete copy[key] : (copy[key] = true);
        return copy;
      });

      clearDefinitionResults();
    },
    [clearDefinitionResults],
  );

  const corrected = useMemo(
    () => feedback?.fullCorrection ?? "",
    [feedback],
  );

  const handleExplain = useCallback(async () => {
    const words = Object.keys(selectedWords);
    if (words.length === 0) {
      notifications.show({
        title: "No Words Selected",
        message: "Click words first.",
        color: "blue",
      });
      return;
    }

    setDefinitionsError(null);
    setDefinitionsLoading(true);
    try {
      const contextText = buildContextText(prompt, essay, corrected);
      const res = await defineWords.mutateAsync({
        langCode,
        contextText,
        wordsToDefine: words,
      });
      setDefinitions(res.definitions);

      if (res.definitions.length > 0) {
        notifications.show({
          title: "Words Defined",
          message: `Found ${res.definitions.length} definitions.`,
          color: "green",
        });
      } else {
        notifications.show({
          title: "No Definitions Found",
          message: "Could not find definitions for the selected words.",
          color: "yellow",
        });
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get definitions.";
      setDefinitionsError(errorMessage);
    } finally {
      setDefinitionsLoading(false);
    }
  }, [corrected, defineWords, essay, langCode, prompt, selectedWords]);

  const handleCreateCards = useCallback(() => {
    if (definitions.length === 0) {
      return;
    }

    const wordsForCards = definitions.map((definition) =>
      getCardWord(definition),
    );
    const uniqueWords = Array.from(new Set(wordsForCards));

    if (uniqueWords.length === 0) {
      return;
    }

    const wordsParam = encodeURIComponent(uniqueWords.join(","));
    const url = `/create?mode=wordlist&words=${wordsParam}`;

    window.open(url, "_blank");
  }, [definitions]);

  const handleGoToReview = useCallback(() => {
    if (!safeReturnTo) {
      void router.push(reviewTarget);
      return;
    }

    const checkProgressAndContinue = async () => {
      let latestProgress = writingProgressData;

      try {
        const result = await refetchWritingProgress();
        latestProgress = result.data ?? latestProgress;
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to refresh writing progress.";
        notifications.show({
          title: "Progress Check Failed",
          message: errorMessage,
          color: "red",
        });
        return;
      }

      if (!latestProgress) {
        notifications.show({
          title: "Checking Progress",
          message: "Please try again in a moment.",
          color: "yellow",
        });
        return;
      }

      const remaining = getRemainingGoalCharacters(
        latestProgress.progress,
        latestProgress.goal,
      );

      if (remaining > 0) {
        notifications.show({
          title: "Write More to Continue",
          message: `Write ${remaining} more characters to unlock review.`,
          color: "blue",
        });
        return;
      }

      window.location.assign(reviewTarget);
    };

    void checkProgressAndContinue();
  }, [
    refetchWritingProgress,
    reviewTarget,
    router,
    safeReturnTo,
    writingProgressData,
  ]);

  const selectedCount = Object.keys(selectedWords).length;
  const canExplain = !definitionsLoading;
  const hasDefinitions = definitions.length > 0;
  const canCreate = hasDefinitions && !definitionsLoading;
  const feedbackItems = feedback?.feedback ?? [];
  const stepContent: Record<Step, JSX.Element> = {
    writing: (
      <WritingStep
        prompt={prompt}
        onPromptChange={setPrompt}
        essay={essay}
        onEssayChange={setEssay}
        loadingReview={loadingReview}
        onReview={handleReview}
        progress={writingProgressData?.progress ?? 0}
        goal={writingProgressData?.goal}
      />
    ),
    feedback: (
      <FeedbackStep
        prompt={prompt}
        essay={essay}
        corrected={corrected}
        feedbackItems={feedbackItems}
        selectedWords={selectedWords}
        onToggleWord={toggleWord}
        selectedCount={selectedCount}
        onExplain={handleExplain}
        onCreateCards={handleCreateCards}
        onWriteMore={handleWriteMore}
        onGoToReview={handleGoToReview}
        reviewLabel={reviewLabel}
        canExplain={canExplain}
        canCreate={canCreate}
        definitions={definitions}
        definitionsLoading={definitionsLoading}
        definitionsError={definitionsError}
      />
    ),
  };

  return (
    <Container size="sm" py="md">
      <Title order={2} mb="md">
        Writing Practice
      </Title>

      {stepContent[currentStep]}
    </Container>
  );
}
