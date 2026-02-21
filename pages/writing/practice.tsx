import { getServersideUser } from "@/koala/get-serverside-user";
import { VisualDiff } from "@/koala/review/lesson-steps/visual-diff";
import { LangCode } from "@/koala/shared-types";
import { trpc } from "@/koala/trpc-config";
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  Progress,
  RingProgress,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  Tooltip,
  Title,
  useMantineTheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconMicrophone,
  IconPlayerStopFilled,
} from "@tabler/icons-react";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { alphabetical } from "radash";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
type PracticeMode = "writing" | "speaking";

type WritingStepProps = {
  prompt: string;
  onPromptChange: (value: string) => void;
  essay: string;
  onEssayChange: (value: string) => void;
  practiceMode: PracticeMode;
  onPracticeModeChange: (value: PracticeMode) => void;
  onTranscript: (text: string) => void;
  langCode: LangCode;
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

const MAX_SPEECH_RECORDING_SECONDS = 60;

const isPracticeMode = (value: string): value is PracticeMode =>
  value === "writing" || value === "speaking";

const getEssayPlaceholder = (practiceMode: PracticeMode) => {
  if (practiceMode === "speaking") {
    return "Your transcript appears here. You can edit it before grading.";
  }
  return "Write your essay here...";
};

const getReviewLoadingLabel = (practiceMode: PracticeMode) => {
  if (practiceMode === "speaking") {
    return "Analyzing your speaking transcript...";
  }
  return "Analyzing your writing...";
};

const getModeTipText = (practiceMode: PracticeMode) => {
  if (practiceMode === "speaking") {
    return "TIP: Speak naturally in Korean, then edit the transcript before grading if needed.";
  }
  return "TIP: Don't know a word? Surround the word you want to use in question marks and it will be replaced with an appropriate word when graded. Example: ?apple?를 먹어요.";
};

const getRecordTooltip = (
  isRecording: boolean,
  isTranscribing: boolean,
  disabled: boolean,
  isSupported: boolean,
) => {
  if (!isSupported) {
    return "This browser does not support microphone recording";
  }
  if (isTranscribing) {
    return "Transcribing your response...";
  }
  if (disabled) {
    return "Recording unavailable while feedback is loading";
  }
  if (isRecording) {
    return "Stop recording";
  }
  return "Start recording (60s max)";
};

const getSpeakingStatusText = (
  isRecording: boolean,
  isTranscribing: boolean,
) => {
  if (isTranscribing) {
    return "Transcribing... this can take a few seconds.";
  }
  if (isRecording) {
    return "Recording now. Auto-stop at 60 seconds.";
  }
  return "Tap the microphone, then speak in Korean.";
};

const formatCountdown = (seconds: number) => {
  const clamped = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(clamped / 60);
  const remainder = clamped % 60;
  if (minutes > 0) {
    return `${minutes}:${remainder.toString().padStart(2, "0")}`;
  }
  return `${clamped}s`;
};

const getRecordingProgressPercent = (remainingSeconds: number) => {
  const clamped = Math.max(
    0,
    Math.min(MAX_SPEECH_RECORDING_SECONDS, remainingSeconds),
  );
  return (clamped / MAX_SPEECH_RECORDING_SECONDS) * 100;
};

const getSpeakingHint = (prompt: string) => {
  if (!prompt.trim() || prompt === DEFAULT_PROMPT) {
    return "";
  }
  return prompt;
};

const getPreferredRecorderMimeType = (): string | null => {
  if (
    typeof window === "undefined" ||
    typeof MediaRecorder === "undefined"
  ) {
    return null;
  }

  const webmType = "audio/webm;codecs=opus";
  const mp4Type = "audio/mp4";

  if (MediaRecorder.isTypeSupported(webmType)) {
    return webmType;
  }

  if (MediaRecorder.isTypeSupported(mp4Type)) {
    return mp4Type;
  }

  return "";
};

async function transcribeBlob(
  blob: Blob,
  language: LangCode,
  hint: string,
): Promise<string> {
  const hintParam = hint ? `&hint=${encodeURIComponent(hint)}` : "";
  const response = await fetch(
    `/api/transcribe?language=${encodeURIComponent(language)}${hintParam}`,
    {
      method: "POST",
      headers: { "Content-Type": blob.type || "application/octet-stream" },
      body: blob,
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }

  const payload: { text?: string } = await response.json();
  return payload.text ?? "";
}

type UseSpeechRecorderOptions = {
  disabled: boolean;
  langCode: LangCode;
  hint: string;
  onTranscript: (text: string) => void;
};

function useSpeechRecorder({
  disabled,
  langCode,
  hint,
  onTranscript,
}: UseSpeechRecorderOptions) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopInFlightRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(
    MAX_SPEECH_RECORDING_SECONDS,
  );

  const isSupported = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    if (typeof MediaRecorder === "undefined") {
      return false;
    }
    return Boolean(navigator.mediaDevices?.getUserMedia);
  }, []);

  const stopRecording = useCallback(async () => {
    if (stopInFlightRef.current) {
      return;
    }
    const recorder = recorderRef.current;
    if (!recorder) {
      return;
    }

    stopInFlightRef.current = true;
    setIsRecording(false);
    setIsTranscribing(true);

    try {
      const blob = await new Promise<Blob>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) {
            return;
          }
          done = true;
          const nextBlob = new Blob(chunksRef.current, {
            type: recorder.mimeType,
          });
          chunksRef.current = [];
          recorder.stream.getTracks().forEach((track) => track.stop());
          recorderRef.current = null;
          resolve(nextBlob);
        };

        recorder.onstop = finish;
        if (typeof recorder.requestData === "function") {
          recorder.requestData();
        }
        if (recorder.state === "inactive") {
          finish();
          return;
        }
        recorder.stop();
      });

      if (blob.size === 0) {
        notifications.show({
          title: "No audio captured",
          message: "Try recording again.",
          color: "yellow",
        });
        return;
      }

      const transcript = (
        await transcribeBlob(blob, langCode, hint)
      ).trim();
      if (!transcript) {
        notifications.show({
          title: "No speech detected",
          message: "Try speaking a little louder and record again.",
          color: "yellow",
        });
        return;
      }

      onTranscript(transcript);
      notifications.show({
        title: "Transcript added",
        message: "Review and edit it before grading if needed.",
        color: "green",
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Transcription failed.";
      notifications.show({
        title: "Microphone error",
        message,
        color: "red",
      });
    } finally {
      stopInFlightRef.current = false;
      setIsTranscribing(false);
      setRemainingSeconds(MAX_SPEECH_RECORDING_SECONDS);
    }
  }, [hint, langCode, onTranscript]);

  const startRecording = useCallback(async () => {
    if (!isSupported || disabled || isTranscribing) {
      return;
    }
    if (recorderRef.current || stopInFlightRef.current) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const recorderOptions: MediaRecorderOptions = {};
      const preferredMimeType = getPreferredRecorderMimeType();
      if (preferredMimeType) {
        recorderOptions.mimeType = preferredMimeType;
      }
      recorderOptions.audioBitsPerSecond = 16_000;

      const recorder = new MediaRecorder(stream, recorderOptions);
      chunksRef.current = [];
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.start(250);
      recorderRef.current = recorder;
      setRemainingSeconds(MAX_SPEECH_RECORDING_SECONDS);
      setIsRecording(true);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to access microphone.";
      notifications.show({
        title: "Microphone error",
        message,
        color: "red",
      });
    }
  }, [disabled, isSupported, isTranscribing]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      void stopRecording();
      return;
    }
    void startRecording();
  }, [isRecording, startRecording, stopRecording]);

  useEffect(() => {
    if (!isRecording) {
      setRemainingSeconds(MAX_SPEECH_RECORDING_SECONDS);
      return;
    }

    const endTime = Date.now() + MAX_SPEECH_RECORDING_SECONDS * 1000;
    const intervalId = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((endTime - Date.now()) / 1000),
      );
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        void stopRecording();
      }
    }, 200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRecording, stopRecording]);

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (!recorder) {
        return;
      }
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
      recorder.stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
    };
  }, []);

  return {
    isSupported,
    isRecording,
    isTranscribing,
    remainingSeconds,
    toggleRecording,
  };
}

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
  practiceMode,
  onPracticeModeChange,
  onTranscript,
  langCode,
  loadingReview,
  onReview,
  progress,
  goal,
}: WritingStepProps) {
  const speakingHint = getSpeakingHint(prompt);
  const {
    isSupported,
    isRecording,
    isTranscribing,
    remainingSeconds,
    toggleRecording,
  } = useSpeechRecorder({
    disabled: loadingReview,
    langCode,
    hint: speakingHint,
    onTranscript,
  });

  const canChangeMode = !loadingReview && !isRecording && !isTranscribing;
  const textInputDisabled = loadingReview || isRecording || isTranscribing;
  const canReview =
    essay.trim().length > 0 &&
    !loadingReview &&
    !isRecording &&
    !isTranscribing;

  const recordTooltip = getRecordTooltip(
    isRecording,
    isTranscribing,
    loadingReview,
    isSupported,
  );
  const speakingStatus = getSpeakingStatusText(
    isRecording,
    isTranscribing,
  );
  const recordingProgress = getRecordingProgressPercent(remainingSeconds);
  const canToggleRecording =
    isRecording || (!loadingReview && !isTranscribing && isSupported);
  const recordIcon = isRecording ? (
    <IconPlayerStopFilled size={24} />
  ) : (
    <IconMicrophone size={24} />
  );
  const recordingTextColor = isRecording ? "red.7" : "pink.7";
  const reviewLoadingLabel = getReviewLoadingLabel(practiceMode);

  const handleModeChange = (value: string) => {
    if (!isPracticeMode(value)) {
      return;
    }
    onPracticeModeChange(value);
  };

  const reviewControl = loadingReview ? (
    <Group>
      <Loader size="sm" />
      <Text c="dimmed">{reviewLoadingLabel}</Text>
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
      <SegmentedControl
        value={practiceMode}
        onChange={handleModeChange}
        data={[
          { label: "Typing", value: "writing" },
          { label: "Speaking", value: "speaking" },
        ]}
        fullWidth
        mb="md"
        disabled={!canChangeMode}
        aria-label="Practice mode"
      />
      <Textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.currentTarget.value)}
        autosize
        minRows={2}
        maxRows={4}
        mb="md"
        disabled={textInputDisabled}
      />
      <Text size="sm" c="dimmed" mb="xs">
        {getModeTipText(practiceMode)}
      </Text>

      {practiceMode === "speaking" && (
        <Paper withBorder radius="md" p="sm" mb="md" bg="pink.0">
          <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <Tooltip label={recordTooltip}>
                <ActionIcon
                  variant={isRecording ? "filled" : "outline"}
                  size={50}
                  radius="xl"
                  color="pink.7"
                  onClick={
                    canToggleRecording ? toggleRecording : undefined
                  }
                  disabled={!canToggleRecording}
                  aria-label={
                    isRecording ? "Stop recording" : "Start recording"
                  }
                >
                  {recordIcon}
                </ActionIcon>
              </Tooltip>
              <Stack gap={2}>
                <Text size="sm" fw={600}>
                  Speaking input
                </Text>
                <Text size="xs" c="dimmed">
                  {speakingStatus}
                </Text>
              </Stack>
            </Group>
            <Group gap="xs" wrap="nowrap">
              <RingProgress
                size={34}
                thickness={4}
                roundCaps
                sections={[{ value: recordingProgress, color: "red.5" }]}
                rootColor="pink.1"
              />
              <Text
                size="sm"
                fw={700}
                c={recordingTextColor}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatCountdown(remainingSeconds)}
              </Text>
            </Group>
          </Group>
        </Paper>
      )}

      <Textarea
        placeholder={getEssayPlaceholder(practiceMode)}
        autosize
        minRows={6}
        maxRows={12}
        value={essay}
        onChange={(e) => onEssayChange(e.currentTarget.value)}
        mb="xs"
        disabled={textInputDisabled}
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
  const [practiceMode, setPracticeMode] =
    useState<PracticeMode>("writing");
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

  const handleTranscript = useCallback((transcript: string) => {
    setEssay((previousEssay) => {
      if (!previousEssay.trim()) {
        return transcript;
      }
      return `${previousEssay.trimEnd()} ${transcript}`;
    });
    setPracticeMode("speaking");
  }, []);

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
      practiceMode,
    });
  }, [essay, gradeWriting, practiceMode, prompt, resetSelection]);

  const handleWriteMore = useCallback(() => {
    setCurrentStep("writing");
    setPrompt(DEFAULT_PROMPT);
    setEssay("");
    setPracticeMode("writing");
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
        practiceMode={practiceMode}
        onPracticeModeChange={setPracticeMode}
        onTranscript={handleTranscript}
        langCode={langCode}
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
