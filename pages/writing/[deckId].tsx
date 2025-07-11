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
import { alphabetical } from "radash";
import { useCallback, useMemo, useState } from "react";

type WritingPageProps = { deckId: number; langCode: LangCode };
// Match the schema defined in koala/trpc-routes/grade-writing.ts
type Feedback = {
  fullCorrection: string;
  fullText: string;
  feedback: string[]; // Per schema in grade-writing.ts
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

  const langCode = (
    await prismaClient.deck.findUnique({
      where: { id: parsedId, userId: dbUser.id },
      select: { langCode: true },
    })
  )?.langCode as LangCode | undefined;

  if (!langCode) {
    return { redirect: { destination: "/review", permanent: false } };
  }
  return {
    props: {
      deckId: parsedId,
      langCode,
    },
  };
};

// Step type to track the current writing flow step
type Step = "prompt-selection" | "sample-reading" | "writing" | "feedback";

export default function WritingPage({
  deckId,
  langCode,
}: WritingPageProps) {
  const theme = useMantineTheme();

  // State for tracking the current step in the writing flow
  const [currentStep, setCurrentStep] = useState<Step>("prompt-selection");

  const [prompts, setPrompts] = useState<string[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [promptsError, setPromptsError] = useState<string | null>(null);

  const [essay, setEssay] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(
    null,
  );

  const [translations, setTranslations] = useState<string[]>([]);
  const [translatingIdx, setTranslatingIdx] = useState<number | null>(
    null,
  );

  const [sampleResponse, setSampleResponse] = useState<string>("");
  const [loadingSample, setLoadingSample] = useState(false);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);

  // Fetch daily writing progress data
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
      lemma?: string;
      definition: string;
    }[]
  >([]);
  const [definitionsLoading, setDefinitionsLoading] = useState(false);
  const [definitionsError, setDefinitionsError] = useState<string | null>(
    null,
  );

  const gradeWriting = trpc.gradeWriting.useMutation({
    onSuccess: (data) => {
      console.log(`=== Writing feedback:`, data);
      setFeedback(data);
      setLoadingReview(false);
      setCurrentStep("feedback");
      // Refetch writing progress data after successful submission
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

  const generatePrompts = trpc.generateWritingPrompts.useMutation({
    onSuccess: (data) => {
      setPrompts(data);
      setPromptsError(null);
      setTranslations(Array(data.length).fill(""));
      setSelectedPrompt(null);
      setEssay("");
      setSelectedWords({});
      setDefinitions([]);
    },
    onError: (err) =>
      setPromptsError(err.message || "Failed to generate prompts."),
    onSettled: () => setLoadingPrompts(false),
  });

  const translate = trpc.translate.useMutation();
  const defineWords = trpc.defineUnknownWords.useMutation();
  const generateSample = trpc.generateWritingSample.useMutation({
    onSuccess: (data) => {
      setSampleResponse(data);
      setLoadingSample(false);
    },
    onError: (err) => {
      notifications.show({
        title: "Error",
        message: err.message || "Failed to generate sample response",
        color: "red",
      });
      setLoadingSample(false);
    },
  });

  const handleGeneratePrompts = () => {
    setLoadingPrompts(true);
    setPrompts([]);
    setPromptsError(null);
    setSelectedWords({});
    setDefinitions([]);
    setDefinitionsError(null);
    setSampleResponse("");
    generatePrompts.mutate({ deckId });
  };

  const handleTranslate = (prompt: string, idx: number) => {
    setTranslatingIdx(idx);
    translate.mutate(
      { text: prompt, targetLangCode: "en" },
      {
        onSuccess: (res) => {
          const first = Array.isArray(res) ? res[0] : res;
          setTranslations((t) =>
            t.map((val, i) => (i === idx ? first : val)),
          );
          setTranslatingIdx(null);
        },
        onError: () => setTranslatingIdx(null),
      },
    );
  };

  const handleSelectPrompt = (prompt: string) => {
    setSelectedPrompt(prompt);
    setCurrentStep("writing");
  };

  const handleReadSample = (prompt: string) => {
    setSelectedPrompt(prompt);
    setLoadingSample(true);
    setSelectedWords({});
    setDefinitions([]);
    setCurrentStep("sample-reading");

    generateSample.mutate({
      deckId,
      prompt,
    });
  };

  const handleProceedToWriting = () => {
    setCurrentStep("writing");
  };

  const handleReview = () => {
    if (!selectedPrompt || !essay.trim()) {
      return;
    }
    setLoadingReview(true);
    setFeedback(null);
    setSelectedWords({});
    setDefinitions([]);
    gradeWriting.mutate({ prompt: selectedPrompt, text: essay, deckId });
  };

  const handleWriteMore = () => {
    // Reset everything and go back to step 1
    setCurrentStep("prompt-selection");
    setSelectedPrompt(null);
    setEssay("");
    setFeedback(null);
    setSampleResponse("");
    setSelectedWords({});
    setDefinitions([]);
    setDefinitionsError(null);
    // Clear prompts to force going back to initial step with progress bar
    setPrompts([]);
    setTranslations([]);
  };

  const toggleWord = useCallback((raw: string) => {
    // Remove trailing punctuation and convert to lowercase for consistent key
    const key = raw.replace(/[.,!?;:]$/, "").toLowerCase();
    if (!key) {
      return;
    }

    // Toggle the word's selection status
    setSelectedWords((prev) => {
      const copy = { ...prev };
      copy[key] ? delete copy[key] : (copy[key] = true);
      return copy;
    });

    // Clear previous definitions when selecting new words
    setDefinitions([]);
    setDefinitionsError(null);
  }, []);

  // Consistent style for clickable words
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

  // Render text with clickable words consistently across all sections
  const renderClickableText = (text: string) => {
    if (!text) {
      return null;
    }

    return (
      <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
        {text.split(/(\s+)/).map((token, i) => {
          // For whitespace, just return a span
          if (/\s+/.test(token)) {
            return <span key={i}>{token}</span>;
          }

          // For words, make them clickable with consistent styling
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
    setDefinitionsLoading(true);
    try {
      // Include all the prompts and the essay for better context
      let contextText = "";

      // Include all prompts first
      if (prompts.length > 0) {
        contextText += "Prompts:\n" + prompts.join("\n\n") + "\n\n";
      }

      // Add the essay if it exists
      if (essay.trim()) {
        contextText += "Essay:\n" + essay;
      }

      // Add the sample response if viewing it
      if (currentStep === "sample-reading" && sampleResponse) {
        contextText += "Sample Response:\n" + sampleResponse;
      }

      // Add corrected text if available
      if (corrected) {
        contextText += "\n\nCorrected Text:\n" + corrected;
      }

      const res = await defineWords.mutateAsync({
        langCode,
        contextText: contextText,
        wordsToDefine: words,
      });
      setDefinitions(res.definitions);

      // Show success notification
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
    const shouldDisplayLemma = (def: { word: string; lemma?: string }) =>
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
    const url = `/create-wordlist?lang=${langCode}&words=${wordsParam}`;

    window.open(url, "_blank");
  };

  const hasPrompts = prompts.length > 0;
  const selectedCount = Object.keys(selectedWords).length;
  const canExplain = !definitionsLoading;
  const canCreate = definitions.length > 0 && !definitionsLoading;
  const showDefs = definitions.length > 0 && !definitionsLoading;

  // Get corrected text from feedback
  const corrected = useMemo(
    () => feedback?.fullCorrection || "",
    [feedback],
  );

  // Extract writing progress data
  const writingProgressData = dailyWritingProgressQuery.data;
  const isLoadingProgress = dailyWritingProgressQuery.isLoading;

  // Render initial writing exercise step with progress bar and generate button
  const renderInitialStep = () => (
    <Paper withBorder shadow="sm" p="md" mb="lg">
      <Stack gap="md">
        <Title order={4}>Begin Writing Exercise</Title>

        <Stack gap="sm">
          <Text fw={600}>Daily Progress</Text>
          {isLoadingProgress ? (
            <Loader size="sm" />
          ) : (
            <>
              <Progress
                value={writingProgressData?.percentage || 0}
                size="lg"
                color={
                  (writingProgressData?.percentage || 0) >= 100
                    ? "teal"
                    : "blue"
                }
                striped={(writingProgressData?.percentage || 0) >= 100}
                animated={(writingProgressData?.percentage || 0) >= 100}
              />
              <Text size="sm">
                {writingProgressData?.progress || 0} /{" "}
                {writingProgressData?.goal || 300} characters
                {(writingProgressData?.percentage || 0) >= 100 &&
                  " (Goal reached!)"}
              </Text>
            </>
          )}
        </Stack>

        <Group grow>
          <Button
            onClick={handleGeneratePrompts}
            loading={loadingPrompts}
            size="md"
          >
            Write with a prompt
          </Button>
          <Button
            onClick={() => {
              setSelectedPrompt("Not set.");
              setCurrentStep("writing");
            }}
            size="md"
            variant="light"
          >
            Write without a prompt
          </Button>
        </Group>

        {promptsError && (
          <Alert title="Error" color="red">
            {promptsError}
          </Alert>
        )}
      </Stack>
    </Paper>
  );

  // Render prompt selection step (shown after prompts are loaded)
  const renderPromptSelectionStep = () => (
    <Paper withBorder shadow="sm" p="md" mb="lg">
      <Title order={4} mb="md">
        Select a Prompt
      </Title>

      {prompts.map((p, i) => (
        <Paper key={i} withBorder shadow="sm" p="sm" mb="md">
          <Stack gap="xs">
            <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
              {p}
            </Text>
            <Group>
              <Button size="sm" onClick={() => handleSelectPrompt(p)}>
                Select Prompt
              </Button>
              <Button
                size="sm"
                variant="light"
                disabled={!!translations[i]}
                loading={translatingIdx === i}
                onClick={(e) => {
                  e.stopPropagation();
                  handleTranslate(p, i);
                }}
              >
                {translations[i] ? "Translated" : "Translate"}
              </Button>
              <Button
                size="sm"
                variant="subtle"
                loading={loadingSample && selectedPrompt === p}
                onClick={() => handleReadSample(p)}
              >
                Read sample response
              </Button>
            </Group>
          </Stack>
          {translations[i] && (
            <Text
              size="xs"
              color="dimmed"
              style={{ whiteSpace: "pre-wrap", marginTop: 8 }}
            >
              {translations[i]}
            </Text>
          )}
        </Paper>
      ))}
    </Paper>
  );
  // Render sample reading step
  const renderSampleReadingStep = () => (
    <Paper withBorder shadow="sm" p="md" mb="lg">
      <Stack gap="md">
        <Title order={4}>Sample Response</Title>
        <Text fw={600}>Selected Prompt</Text>
        {selectedPrompt && renderClickableText(selectedPrompt)}
        <Text fw={600}>Sample Response (Click unknown words)</Text>
        {loadingSample ? (
          <Group>
            <Loader size="sm" />
            <Text c="dimmed">Generating sample response...</Text>
          </Group>
        ) : (
          renderClickableText(sampleResponse)
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
          <Button onClick={handleProceedToWriting} variant="filled">
            Continue to Writing
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

  // Render writing step
  const renderWritingStep = () => (
    <Paper withBorder shadow="sm" p="md">
      <Title order={4} mb="xs">
        Writing Prompt
      </Title>
      <Textarea
        value={selectedPrompt || ""}
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

  // Render feedback step
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

      {currentStep === "prompt-selection" && (
        <>
          {!hasPrompts && renderInitialStep()}
          {hasPrompts && renderPromptSelectionStep()}
        </>
      )}
      {currentStep === "sample-reading" && renderSampleReadingStep()}
      {currentStep === "writing" && renderWritingStep()}
      {currentStep === "feedback" && renderFeedbackStep()}
    </Container>
  );
}
