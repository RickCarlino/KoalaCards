import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
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

type WritingPageProps = { deckId: number; langCode: LangCode };
type Feedback = {
  fullCorrection: string;
  fullText: string;
  feedback: string[];
};

export const getServerSideProps: GetServerSideProps<
  WritingPageProps
> = async (ctx) => {
  const dbUser = await getServersideUser(ctx);
  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }
  const { deckId } = ctx.params as { deckId: string };
  const parsedId = parseInt(deckId, 10);
  if (isNaN(parsedId)) {
    return { notFound: true };
  }

  const deckExists = await prismaClient.deck.findUnique({
    where: { id: parsedId, userId: dbUser.id },
    select: { id: true },
  });

  if (!deckExists) {
    return { redirect: { destination: "/review", permanent: false } };
  }
  return {
    props: {
      deckId: parsedId,
      langCode: "ko" as LangCode,
    },
  };
};

type Step = "writing" | "feedback";

export default function WritingPage({
  deckId,
  langCode,
}: WritingPageProps) {
  const theme = useMantineTheme();
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<Step>("writing");

  const [essay, setEssay] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState("Not set.");

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);

  const dailyWritingProgressQuery = trpc.getDailyWritingProgress.useQuery(
    {},
    { refetchOnWindowFocus: false },
  );

  const [selectedWords, setSelectedWords] = useState<
    Record<string, boolean>
  >({});
  const [definitions, setDefinitions] = useState<
    {
      word: string;
      lemma: string | null;
      definition: string;
    }[]
  >([]);
  const [definitionsLoading, setDefinitionsLoading] = useState(false);
  const [definitionsError, setDefinitionsError] = useState<string | null>(
    null,
  );

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

  const handleReview = () => {
    if (!essay.trim()) {
      return;
    }
    setLoadingReview(true);
    setFeedback(null);
    setSelectedWords({});
    setDefinitions([]);
    gradeWriting.mutate({
      prompt: selectedPrompt || "Not set.",
      text: essay,
      deckId,
    });
  };

  const handleWriteMore = () => {
    setCurrentStep("writing");
    setSelectedPrompt("Not set.");
    setEssay("");
    setFeedback(null);
    setSelectedWords({});
    setDefinitions([]);
    setDefinitionsError(null);
  };

  const toggleWord = useCallback((raw: string) => {
    const key = raw.replace(/[.,!?;:]$/, "").toLowerCase();
    if (!key) {
      return;
    }

    setSelectedWords((prev) => {
      const copy = { ...prev };
      copy[key] ? delete copy[key] : (copy[key] = true);
      return copy;
    });

    setDefinitions([]);
    setDefinitionsError(null);
  }, []);

  const clickableStyle = useCallback(
    (active: boolean) => ({
      cursor: "pointer",
      backgroundColor: active ? theme.colors.yellow[2] : undefined,
      borderRadius: theme.radius.sm,
      padding: "0 2px",
      margin: "0 1px",
      display: "inline-block",
    }),
    [theme],
  );

  const renderClickableText = (text: string) => {
    if (!text) {
      return null;
    }

    return (
      <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
        {text.split(/(\s+)/).map((token, i) => {
          if (/\s+/.test(token)) {
            return <span key={i}>{token}</span>;
          }

          const normalizedToken = token
            .replace(/[.,!?;:]$/, "")
            .toLowerCase();
          const isSelected = Boolean(selectedWords[normalizedToken]);

          return (
            <Text
              component="span"
              key={i}
              style={clickableStyle(isSelected)}
              onClick={() => toggleWord(token)}
            >
              {token}
            </Text>
          );
        })}
      </Text>
    );
  };

  const handleExplain = async () => {
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
      let contextText = "";

      if (selectedPrompt.trim()) {
        contextText += "Prompt:\n" + selectedPrompt + "\n\n";
      }

      if (essay.trim()) {
        contextText += "Essay:\n" + essay;
      }

      if (corrected) {
        contextText += "\n\nCorrected Text:\n" + corrected;
      }

      const res = await defineWords.mutateAsync({
        langCode,
        contextText: contextText,
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
  };

  const handleCreateCards = () => {
    const shouldDisplayLemma = (def: {
      word: string;
      lemma: string | null;
    }) =>
      !!def.lemma && def.lemma.toLowerCase() !== def.word.toLowerCase();

    if (!definitions || definitions.length === 0) {
      return;
    }

    const wordsForCards = definitions.map((def) =>
      shouldDisplayLemma(def) && def.lemma ? def.lemma : def.word,
    );

    const uniqueWords = Array.from(new Set(wordsForCards));

    if (uniqueWords.length === 0) {
      return;
    }

    const wordsParam = encodeURIComponent(uniqueWords.join(","));
    const url = `/create?mode=wordlist&deckId=${deckId}&words=${wordsParam}`;

    window.open(url, "_blank");
  };

  const selectedCount = Object.keys(selectedWords).length;
  const canExplain = !definitionsLoading;
  const canCreate = definitions.length > 0 && !definitionsLoading;
  const showDefs = definitions.length > 0 && !definitionsLoading;

  const corrected = useMemo(
    () => feedback?.fullCorrection || "",
    [feedback],
  );

  const writingProgressData = dailyWritingProgressQuery.data;

  const renderWritingStep = () => (
    <Paper withBorder shadow="sm" p="md">
      <Title order={4} mb="xs">
        Writing Prompt
      </Title>
      <Textarea
        value={selectedPrompt}
        onChange={(e) => setSelectedPrompt(e.currentTarget.value)}
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
        onChange={(e) => setEssay(e.currentTarget.value)}
        mb="xs"
        disabled={loadingReview}
      />

      <Box mb="md">
        <Stack gap="xs" style={{ flexGrow: 1 }}>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {(writingProgressData?.progress || 0) + essay.length}{" "}
              characters
              {writingProgressData?.goal
                ? ` / ${writingProgressData.goal} goal`
                : ""}
            </Text>
            {writingProgressData?.goal &&
              (writingProgressData?.progress || 0) + essay.length >=
                writingProgressData.goal && (
                <Group gap="xs">
                  <IconCheck size={16} color={theme.colors.teal[6]} />
                  <Text size="sm" c="teal">
                    Goal reached!
                  </Text>
                </Group>
              )}
          </Group>
          {writingProgressData?.goal && (
            <Progress
              value={
                (((writingProgressData?.progress || 0) + essay.length) /
                  writingProgressData.goal) *
                100
              }
              size="sm"
              color={"blue"}
              {...((writingProgressData?.progress || 0) + essay.length >=
              writingProgressData.goal
                ? { striped: true, animated: true }
                : {})}
            />
          )}
        </Stack>
      </Box>

      {loadingReview ? (
        <Group>
          <Loader size="sm" />
          <Text c="dimmed">Analyzing your writing...</Text>
        </Group>
      ) : (
        <Button onClick={handleReview} disabled={!essay.trim()}>
          Save and Review Feedback
        </Button>
      )}
    </Paper>
  );

  const renderFeedbackStep = () => (
    <Paper withBorder shadow="sm" p="md" mt="md">
      <Stack gap="md">
        <Title order={3}>Feedback (Click unknown words)</Title>
        <Text fw={600}>Selected Prompt</Text>
        {selectedPrompt && renderClickableText(selectedPrompt)}
        <Text fw={600}>Original Text</Text>
        {renderClickableText(essay)}
        <Text fw={600}>Corrected Text</Text>
        {renderClickableText(corrected)}
        <Text fw={600}>Changes</Text>
        <VisualDiff actual={essay} expected={corrected} />
        {feedback?.feedback && feedback.feedback.length > 0 && (
          <>
            <Text fw={600}>Feedback</Text>
            {feedback.feedback.map((feedbackItem, itemIdx) => (
              <Box key={itemIdx} mb="xs">
                {renderClickableText(`• ${feedbackItem}`)}
              </Box>
            ))}
          </>
        )}

        <Group>
          <Button onClick={handleExplain} disabled={!canExplain}>
            Explain Selected Words ({selectedCount})
          </Button>
          {canCreate && (
            <Button onClick={handleCreateCards}>
              Create Cards from Words ({definitions.length})
            </Button>
          )}
          <Button onClick={handleWriteMore} variant="outline">
            Write More
          </Button>
          <Button
            onClick={() => router.push(`/review/${deckId}`)}
            variant="filled"
          >
            Study Cards
          </Button>
        </Group>

        {definitionsLoading && (
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
        )}

        {definitionsError && (
          <Alert title="Error" color="red">
            {definitionsError}
          </Alert>
        )}

        {showDefs && (
          <Stack gap="xs">
            <Text fw={600}>Word Definitions</Text>
            {alphabetical(definitions, (x) => x.definition).map((d, i) => {
              const showLemma =
                d.lemma && d.lemma.toLowerCase() !== d.word.toLowerCase();
              return (
                <Box key={i}>
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
        )}
      </Stack>
    </Paper>
  );

  return (
    <Container size="sm" py="md">
      <Title order={2} mb="md">
        Writing Practice
      </Title>

      {currentStep === "writing" && renderWritingStep()}
      {currentStep === "feedback" && renderFeedbackStep()}
    </Container>
  );
}
