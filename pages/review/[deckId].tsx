import {
  ActionIcon,
  Affix,
  Anchor,
  Badge,
  Box,
  Button,
  Container,
  Drawer,
  Flex,
  Group,
  Image,
  Loader,
  Menu,
  Paper,
  Progress,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
  useMantineTheme,
  type DrawerProps,
} from "@mantine/core";
import { useHotkeys, useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconArchive,
  IconDoorExit,
  IconDots,
  IconEdit,
  IconLetterF,
  IconMessage,
  IconMicrophone,
  IconPlayerPlayFilled,
  IconPlayerSkipForwardFilled,
  IconPlayerStopFilled,
  IconPlus,
  IconSend,
  IconThumbDown,
  IconThumbUp,
  IconX,
} from "@tabler/icons-react";
import { Grade } from "femto-fsrs";
import { GetServerSideProps } from "next";
import Link from "next/link";
import { uid } from "radash";
import React from "react";
import ReactMarkdown, {
  type Components,
  type ExtraProps,
} from "react-markdown";
import { z } from "zod";
import { canStartNewLessons, getLessonsDue } from "@/koala/fetch-lesson";
import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { compare } from "@/koala/quiz-evaluators/evaluator-utils";
import { VisualDiff } from "@/koala/review/lesson-steps/visual-diff";
import { useUserSettings } from "@/koala/settings-provider";
import { LangCode } from "@/koala/shared-types";
import { trpc } from "@/koala/trpc-config";
import { getGradeButtonText } from "@/koala/trpc-routes/calculate-scheduling-data";
import { DeckSummary } from "@/koala/types/deck-summary";
import { QuizList as ZodQuizList } from "@/koala/types/zod";

type ReviewDeckPageProps = { deckId: number; decks: DeckSummary[] };

type QuizList = z.infer<typeof ZodQuizList>["quizzes"];

type QueueType =
  | "newWordIntro"
  | "newWordOutro"
  | "remedialIntro"
  | "remedialOutro"
  | "speaking";

type ItemType = QueueType;

type QueueItem = {
  cardUUID: string;
  itemType: ItemType;
  stepUuid: string;
};

type Queue = Record<QueueType, QueueItem[]>;

type UUID = { uuid: string };

type Quiz = QuizList[number] & UUID;

type QuizMap = Record<string, Quiz>;

type GradingResult = {
  transcription: string;
  isCorrect: boolean;
  feedback: string;
  quizResultId: number | null;
};

type State = {
  currentItem: QueueItem | undefined;
  queue: Queue;
  cards: QuizMap;
  gradingResults: Record<string, GradingResult>;
  initialCardCount: number;
  initialStepCount: number;
  completedCards: Set<string>;
};

type ReplaceCardAction = { type: "REPLACE_CARDS"; payload: Quiz[] };

type SkipCardAction = { type: "SKIP_CARD"; payload: UUID };

type CompleteItemAction = {
  type: "COMPLETE_ITEM";
  payload: { uuid: string };
};

type GiveUpAction = {
  type: "GIVE_UP";
  payload: { cardUUID: string };
};

type GradingResultCapturedAction = {
  type: "STORE_GRADE_RESULT";
  payload: { cardUUID: string; result: GradingResult };
};

type UpdateCardAction = {
  type: "UPDATE_CARD";
  payload: {
    cardUUID: string;
    term?: string;
    definition?: string;
  };
};

type Action =
  | ReplaceCardAction
  | SkipCardAction
  | CompleteItemAction
  | GiveUpAction
  | GradingResultCapturedAction
  | UpdateCardAction;

type CardReviewProps = {
  onProceed: () => void;
  onSkip: (uuid: string) => void;
  onGiveUp: (cardUUID: string) => void;
  itemType: ItemType;
  card: Quiz;
  currentStepUuid: string;
  onGradingResultCaptured: (
    cardUUID: string,
    result: GradingResult,
  ) => void;
  onProvideAudioHandler?: (handler: (blob: Blob) => Promise<void>) => void;
};

type CardUI = React.FC<CardReviewProps>;

type CardReviewWithRecordingProps = Omit<
  CardReviewProps,
  "onProvideAudioHandler"
> & {
  completeItem: (uuid: string) => void;
  onPlayAudio: () => void;
  progress?: number;
  cardsRemaining?: number;
  onOpenAssistant?: () => void;
  disableRecord?: boolean;
  onFail?: () => void;
  assistantOffsetRight?: number;
};

type PlaybackQueue = {
  id: number;
  tail: Promise<void>;
  controller: AbortController;
};

type SpeechRequestBody = {
  tl: string;
  format: "mp3";
};

type BeepOptions = {
  durationMs?: number;
  frequencyHz?: number;
  volume?: number;
};

type RecorderControls = {
  start: (startOptions?: { playBeep?: boolean }) => Promise<void>;
  stop: () => Promise<Blob>;
  isRecording: boolean;
  mimeType: string | null;
};

interface UseVoiceTranscriptionOptions {
  targetText: string;
  langCode: LangCode;
}

interface TranscriptionResult {
  transcription: string;
  isMatch?: boolean;
}

interface UseVoiceGradingOptions {
  targetText: string;
  langCode: LangCode;
  cardId: number;
  cardUUID: string;
  onGradingResultCaptured?: (
    cardUUID: string,
    result: GradingResult,
  ) => void;
}

interface UseQuizGradingOptions {
  cardId: number;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

interface UseGradeHandlerProps {
  gradeWithAgain: () => Promise<void>;
  gradeWithHard: () => Promise<void>;
  gradeWithGood: () => Promise<void>;
  gradeWithEasy: () => Promise<void>;
}

type ReviewStateCardProps = {
  title: string;
  children: React.ReactNode;
};

type MessageStateProps = {
  title: string;
  children: React.ReactNode;
};

type NoMoreQuizzesStateProps = {
  deckId: number;
  onReload: () => void;
};

type ReviewLayoutProps = {
  contentHeight: string;
  showAssistant: boolean;
  assistant: React.ReactNode;
  children: React.ReactNode;
};

type ReviewLayoutState = {
  assistantOpen: boolean;
  openAssistant: () => void;
  closeAssistant: () => void;
  showDesktopAssistant: boolean;
  assistantOffset: number;
  isDesktop: boolean;
  contentHeight: string;
};

type ReviewHandlersParams = {
  state: State;
  addContextEvent: (type: string, summary: string) => void;
  skipCard: (cardUUID: string) => void;
  giveUp: (cardUUID: string) => void;
  captureGradingResult: (cardUUID: string, result: GradingResult) => void;
  updateCardFields: (
    cardId: number,
    updates: { term: string; definition: string },
  ) => void;
};

type FeedbackVoteProps = {
  resultId: number;
  onClick?: () => void;
};

interface FailureViewProps {
  imageURL?: string;
  term: string;
  definition: string;
  userTranscription: string;
  feedback?: string;
  quizResultId?: number | null;
  onContinue: () => void;
  failureText?: string;
}

interface GradingSuccessProps {
  quizData: {
    difficulty: number;
    stability: number;
    lastReview: number;
    lapses: number;
    repetitions: number;
  };
  onGradeSelect: (grade: Grade) => void;
  isLoading?: boolean;
  feedback?: string;
  quizResultId?: number | null;
}

type IntroCardProps = CardReviewProps & {
  isRemedial?: boolean;
};

type IntroPhase = "ready" | "processing" | "retry" | "success";

type QuizPhase = "ready" | "processing" | "success" | "failure";

type QuizType = "speaking" | "newWordOutro" | "remedialOutro";

type QuizConfig = {
  headerText?: string;
  headerColor?: "blue" | "orange";
  promptText: (definition: string) => string;
  instructionText: string;
  failureText: string;
};

type QuizCardProps = CardReviewProps & {
  quizType: QuizType;
};

type RemedialOutroPhase = "ready" | "processing" | "success" | "failure";

type ControlBarProps = {
  card: Quiz;
  itemType: ItemType;
  onSkip: (uuid: string) => void;
  onGiveUp: (cardUUID: string) => void;
  isRecording: boolean;
  onRecordClick: () => void;
  onArchiveClick: () => void;
  onPlayAudio: () => void;
  progress?: number;
  cardsRemaining?: number;
  onOpenAssistant?: () => void;
  disableRecord?: boolean;
  onFail?: () => void;
};

type ControlBarMenuProps = {
  onEdit: () => void;
  onArchive: () => void;
  onSkip: () => void;
  onFail: () => void;
};

type AssistantRole = "user" | "assistant";

type Suggestion = {
  phrase: string;
  translation: string;
  gender: "M" | "F" | "N";
};

type AssistantEditProposal = {
  id: string;
  cardId: number;
  term: string;
  definition: string;
  note?: string;
  originalTerm?: string;
  originalDefinition?: string;
};

type AssistantCardContext = {
  cardId: number;
  term: string;
  definition: string;
  uuid?: string;
};

type ChatMessage = {
  role: AssistantRole;
  content: string;
  suggestions?: Suggestion[];
  edits?: AssistantEditProposal[];
};

type ContextEvent = {
  id: string;
  timestamp: number;
  type: string;
  summary: string;
};

type StudyAssistantContextValue = {
  contextLog: string[];
  addContextEvent: (type: string, summary: string) => void;
};

type AssistantComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onClear: () => void;
  isStreaming: boolean;
  canClear: boolean;
};

type AssistantPanelProps = {
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onClear: () => void;
  canClear: boolean;
  isStreaming: boolean;
  viewportRef: React.RefObject<HTMLDivElement>;
  onAddSuggestion: (
    suggestion: Suggestion,
    deckId: number,
  ) => void | Promise<void>;
  isAdding: boolean;
  decks: DeckSummary[];
  currentDeckId: number;
  onClose: () => void;
  onApplyEdit: (
    proposal: AssistantEditProposal,
    updates: { term: string; definition: string },
  ) => void | Promise<void>;
  onDismissEdit: (proposalId: string) => void;
  savingEditId: string | null;
};

type AssistantMessageListProps = {
  messages: ChatMessage[];
  viewportRef: React.RefObject<HTMLDivElement>;
  onAddSuggestion: (
    suggestion: Suggestion,
    deckId: number,
  ) => void | Promise<void>;
  isAdding: boolean;
  decks: DeckSummary[];
  currentDeckId: number;
  onApplyEdit: (
    proposal: AssistantEditProposal,
    updates: { term: string; definition: string },
  ) => void | Promise<void>;
  onDismissEdit: (proposalId: string) => void;
  savingEditId: string | null;
};

type MessageTone = "user" | "assistant";

type ExampleBlock = {
  phrase: string;
  translation: string;
};

type CardEditBlock = {
  cardId?: number;
  term?: string;
  definition?: string;
  note?: string;
};

type AssistantParserResult = {
  textDelta: string;
  examples: ExampleBlock[];
  edits: CardEditBlock[];
};

type BlockType = "example" | "edit";

type AssistantMessageContentProps = {
  message: ChatMessage;
  messageIndex: number;
  onAddSuggestion: (
    suggestion: Suggestion,
    deckId: number,
  ) => void | Promise<void>;
  isAdding: boolean;
  decks: DeckSummary[];
  currentDeckId: number;
  onApplyEdit: (
    proposal: AssistantEditProposal,
    updates: { term: string; definition: string },
  ) => void | Promise<void>;
  onDismissEdit: (proposalId: string) => void;
  savingEditId: string | null;
};

type PlaceholderType = "example" | "edit";

type ContentChunk =
  | { kind: "text"; value: string }
  | { kind: "placeholder"; placeholder: PlaceholderType };

type MarkdownCodeProps = JSX.IntrinsicElements["code"] &
  ExtraProps & { inline?: boolean };

type AssistantMarkdownProps = {
  content: string;
  style: React.CSSProperties;
};

type AssistantSuggestionRowProps = {
  suggestion: Suggestion;
  onAdd: (deckId: number) => void;
  isLoading: boolean;
  decks: DeckSummary[];
  defaultDeckId: number;
};

type AssistantEditCardProps = {
  proposal: AssistantEditProposal;
  onSave: (updates: { term: string; definition: string }) => void;
  onDismiss: () => void;
  isSaving: boolean;
};

type StreamHandlers = {
  onChunk: (payload: string) => void;
  onDone: () => void;
};

const ASSISTANT_PANEL_WIDTH = 380;

const REVIEW_BACKGROUND =
  "linear-gradient(180deg, rgba(255,240,246,0.35) 0%, rgba(255,255,255,1) 30%)";

const HOTKEYS = {
  GRADE_AGAIN: "a",
  GRADE_HARD: "s",
  GRADE_GOOD: "d",
  GRADE_EASY: "f",
  FAIL: "g",
  EDIT: "n",
  PLAY: "j",
  SKIP: "k",
  ARCHIVE: "l",
  RECORD: "space",
  CONTINUE: "h",
};

const EVERY_QUEUE_TYPE: QueueType[] = [
  "newWordIntro",
  "remedialIntro",
  "speaking",
  "newWordOutro",
  "remedialOutro",
];

const SPEECH_FORMAT: SpeechRequestBody["format"] = "mp3";

const gradeColors: Record<Grade, string> = {
  [Grade.AGAIN]: "red",
  [Grade.HARD]: "orange",
  [Grade.GOOD]: "green",
  [Grade.EASY]: "blue",
};

const gradeLabels: Record<Grade, string> = {
  [Grade.AGAIN]: "AGAIN",
  [Grade.HARD]: "HARD",
  [Grade.GOOD]: "GOOD",
  [Grade.EASY]: "EASY",
};

const gradeHotkeys: Record<Grade, string> = {
  [Grade.AGAIN]: HOTKEYS.GRADE_AGAIN,
  [Grade.HARD]: HOTKEYS.GRADE_HARD,
  [Grade.GOOD]: HOTKEYS.GRADE_GOOD,
  [Grade.EASY]: HOTKEYS.GRADE_EASY,
};

const quizConfigs: Record<QuizType, QuizConfig> = {
  speaking: {
    headerText: "Speaking Quiz",
    headerColor: "blue",
    promptText: (definition: string) =>
      `Say "${definition}" in the target language`,
    instructionText:
      "Press the record button above and say the phrase in the target language.",
    failureText: "Not quite right",
  },
  newWordOutro: {
    promptText: (definition: string) =>
      `How would you say "${definition}"?`,
    instructionText:
      "Press the record button above and say the phrase in the target language.",
    failureText: "You got it wrong",
  },
  remedialOutro: {
    headerText: "Remedial Review",
    headerColor: "orange",
    promptText: (definition: string) =>
      `How would you say "${definition}"?`,
    instructionText:
      "Press the record button above and say the phrase in the target language.",
    failureText: "Not quite right",
  },
};

const remedialPhaseContent: Record<RemedialOutroPhase, React.ReactNode> = {
  ready: (
    <Text ta="center" c="dimmed">
      Press the record button above and say the phrase in the target
      language.
    </Text>
  ),
  processing: (
    <Text ta="center" c="dimmed">
      Processing your response...
    </Text>
  ),
  success: null,
  failure: null,
};

const cardUIs: Record<ItemType, CardUI> = {
  newWordIntro: NewWordIntro,
  newWordOutro: NewWordOutro,
  speaking: Speaking,
  remedialIntro: RemedialIntro,
  remedialOutro: RemedialOutro,
};

const StudyAssistantContext = React.createContext<
  StudyAssistantContextValue | undefined
>(undefined);

const MAX_EVENTS = 30;

const MAX_SUMMARY_LENGTH = 180;

const messageToneStyles: Record<
  MessageTone,
  { background: string; labelColor: string }
> = {
  user: { background: "pink.1", labelColor: "pink.8" },
  assistant: { background: "pink.0", labelColor: "pink.7" },
};

const messageScrollContainerStyle: React.CSSProperties = {
  overflowY: "auto",
  overflowX: "hidden",
};

const EXAMPLE_START = "[[EXAMPLE]]";

const EXAMPLE_END = "[[/EXAMPLE]]";

const EXAMPLE_PLACEHOLDER = "[[__EXAMPLE_SLOT__]]";

const EDIT_START = "[[EDIT_CARD]]";

const EDIT_END = "[[/EDIT_CARD]]";

const EDIT_PLACEHOLDER = "[[__EDIT_SLOT__]]";

const messageTextStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const placeholderTokens: Record<PlaceholderType, string> = {
  example: EXAMPLE_PLACEHOLDER,
  edit: EDIT_PLACEHOLDER,
};

const placeholderOrder: PlaceholderType[] = ["example", "edit"];

const blockSpacing = "0 0 8px 18px";

const mobileDrawerStyles = {
  body: {
    padding: 0,
    height: "100%",
    display: "flex",
    flexDirection: "column",
  },
} satisfies DrawerProps["styles"];

const INITIAL_ASSISTANT_MESSAGE =
  "Hey! Ask me about the cards you just reviewed, or request new practice questions. I'll also suggest new flashcards or edits when helpful.";

const redirect = (destination: string) => ({
  redirect: { destination, permanent: false },
});

const buildReviewPath = (deckId: number) => `/review/${deckId}`;

const buildWritingPracticeUrl = (returnTo: string) =>
  `/writing/practice?returnTo=${encodeURIComponent(returnTo)}`;

let lastAudio: string | undefined;

let currentAudio: HTMLAudioElement | null = null;

let playbackQueue: PlaybackQueue = {
  id: 0,
  tail: Promise.resolve(),
  controller: new AbortController(),
};

const stopCurrentAudio = () => {
  if (!currentAudio) {
    return;
  }
  currentAudio.pause();
  currentAudio.src = "";
  currentAudio.load();
  currentAudio = null;
};

const resetPlaybackQueue = (): number => {
  playbackQueue.controller.abort();
  stopCurrentAudio();
  playbackQueue = {
    id: playbackQueue.id + 1,
    tail: Promise.resolve(),
    controller: new AbortController(),
  };
  return playbackQueue.id;
};

const isValidPlaybackRate = (value?: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const playSingleAudio = (
  urlOrDataURI: string,
  playbackRate: number | undefined,
  queueId: number,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (queueId !== playbackQueue.id) {
      resolve();
      return;
    }

    let done = false;
    const { controller } = playbackQueue;
    const audio = new Audio(urlOrDataURI);
    currentAudio = audio;
    const hasValidRate = isValidPlaybackRate(playbackRate);

    if (hasValidRate) {
      audio.playbackRate = playbackRate;
    }
    if (!hasValidRate && lastAudio === urlOrDataURI) {
      audio.playbackRate = 0.6;
    }

    const cleanup = () => {
      if (currentAudio === audio) {
        stopCurrentAudio();
      }
      controller.signal.removeEventListener("abort", handleAbort);
    };

    const fail = (error: unknown) => {
      if (done) {
        return;
      }
      done = true;
      cleanup();
      reject(error);
    };

    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      cleanup();
      resolve();
    };

    const handleAbort = () => {
      if (done) {
        return;
      }
      done = true;
      cleanup();
      resolve();
    };

    controller.signal.addEventListener("abort", handleAbort, {
      once: true,
    });

    audio.onended = finish;
    audio.onerror = fail;
    lastAudio = urlOrDataURI;

    audio.play().catch(fail);
  });
};

const playAudio = (
  urlOrDataURI: string,
  playbackRate?: number,
  queueId?: number,
): Promise<void> => {
  if (!urlOrDataURI) {
    return Promise.reject(new Error("No audio source provided."));
  }

  const targetQueueId =
    typeof queueId === "number" ? queueId : resetPlaybackQueue();

  if (targetQueueId !== playbackQueue.id) {
    return Promise.resolve();
  }

  playbackQueue.tail = playbackQueue.tail
    .catch(() => undefined)
    .then(() =>
      playSingleAudio(urlOrDataURI, playbackRate, targetQueueId),
    );

  return playbackQueue.tail;
};

const playTermThenDefinition = async (
  card: Pick<Quiz, "termAudio" | "definitionAudio">,
  playbackSpeed?: number,
  queueId?: number,
) => {
  const activeQueueId =
    typeof queueId === "number" ? queueId : resetPlaybackQueue();
  const sources = [card.termAudio, card.definitionAudio];
  for (const source of sources) {
    if (!source) {
      continue;
    }
    await playAudio(source, playbackSpeed, activeQueueId);
  }
};

const requestSpeechBlob = async (text: string): Promise<Blob> => {
  const response = await fetch("/api/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tl: text,
      format: SPEECH_FORMAT,
    } satisfies SpeechRequestBody),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      message || `Speech request failed (${response.status})`,
    );
  }

  return await response.blob();
};

const playSpeechText = async (
  text: string,
  playbackSpeed?: number,
  queueId?: number,
): Promise<void> => {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }

  const blob = await requestSpeechBlob(trimmed);
  const url = URL.createObjectURL(blob);
  const activeQueueId =
    typeof queueId === "number" ? queueId : resetPlaybackQueue();

  try {
    await playAudio(url, playbackSpeed, activeQueueId);
  } finally {
    URL.revokeObjectURL(url);
  }
};

const playTermThenDefinitionWithFeedback = async (
  card: Pick<Quiz, "termAudio" | "definitionAudio">,
  feedbackText: string,
  playbackSpeed?: number,
): Promise<void> => {
  const queueId = resetPlaybackQueue();
  await playTermThenDefinition(card, playbackSpeed, queueId);
  await playSpeechText(feedbackText, playbackSpeed, queueId);
};

const playBlob = (blob: Blob, playbackRate?: number): Promise<void> => {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  if (isValidPlaybackRate(playbackRate)) {
    audio.playbackRate = playbackRate;
  }

  const cleanup = () => {
    audio.pause();
    URL.revokeObjectURL(url);
  };

  return new Promise((resolve) => {
    audio.onended = () => {
      cleanup();
      resolve();
    };
    audio.onerror = () => {
      cleanup();
      resolve();
    };
    void audio.play();
  });
};

async function playBeep(options: BeepOptions = {}): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  const { durationMs = 120, frequencyHz = 880, volume = 0.15 } = options;

  const win = window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioCtx = win.AudioContext || win.webkitAudioContext;
  if (!AudioCtx) {
    return;
  }

  const ctx = new AudioCtx();
  try {
    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => undefined);
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const now = ctx.currentTime;
    const attack = 0.01;
    const decay = Math.max(0.01, durationMs / 1000 - attack);

    osc.type = "sine";
    osc.frequency.value = frequencyHz;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + attack + decay + 0.02);

    await new Promise<void>((resolve) => {
      osc.onended = () => resolve();
    });
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

function useMediaRecorder(): RecorderControls {
  const [recorder, setRecorder] = React.useState<MediaRecorder | null>(
    null,
  );
  const chunksRef = React.useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = React.useState<boolean>(false);
  const [mimeType, setMimeType] = React.useState<string | null>(null);
  const beepArmedRef = React.useRef<boolean>(false);

  const preferredMime = React.useMemo(() => {
    const webm = "audio/webm;codecs=opus";
    const mp4 = "audio/mp4";
    if (
      typeof window === "undefined" ||
      typeof MediaRecorder === "undefined"
    ) {
      return null;
    }
    if (MediaRecorder.isTypeSupported(webm)) {
      return webm;
    }
    if (MediaRecorder.isTypeSupported(mp4)) {
      return mp4;
    }
    return "";
  }, []);

  React.useEffect(() => {
    return () => {
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
    };
  }, [recorder]);

  async function start(startOptions?: {
    playBeep?: boolean;
  }): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    const options: MediaRecorderOptions = {};
    if (preferredMime) {
      options.mimeType = preferredMime;
    }
    options.audioBitsPerSecond = 16_000;

    const rec = new MediaRecorder(stream, options);
    setMimeType(rec.mimeType);
    chunksRef.current = [];
    const shouldBeep = startOptions?.playBeep !== false;
    beepArmedRef.current = shouldBeep;

    rec.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
        if (beepArmedRef.current) {
          beepArmedRef.current = false;
          void playBeep();
        }
      }
    };

    rec.start(250);
    setRecorder(rec);
    setIsRecording(true);
  }

  function stop(): Promise<Blob> {
    return new Promise((resolve) => {
      const current = recorder;
      if (!current) {
        return resolve(new Blob());
      }
      beepArmedRef.current = false;
      current.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: current.mimeType,
        });
        chunksRef.current = [];
        current.stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        resolve(blob);
      };
      if (typeof current.requestData === "function") {
        current.requestData();
      }
      current.stop();
    });
  }

  return { start, stop, isRecording, mimeType };
}

async function transcribeBlob(
  blob: Blob,
  language: LangCode,
  hint: string,
): Promise<string> {
  const hintParam = hint ? `&hint=${encodeURIComponent(hint)}` : "";
  const res = await fetch(
    `/api/transcribe?language=${encodeURIComponent(language)}${hintParam}`,
    {
      method: "POST",
      headers: { "Content-Type": blob.type || "application/octet-stream" },
      body: blob,
    },
  );

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `HTTP ${res.status}`);
  }

  const json: { text?: string } = await res.json();
  return json.text ?? "";
}

function useVoiceTranscription(options: UseVoiceTranscriptionOptions) {
  const { targetText, langCode } = options;
  const transcribe = async (blob: Blob): Promise<TranscriptionResult> => {
    const transcription = await transcribeBlob(blob, langCode, targetText);

    const result: TranscriptionResult = { transcription };

    if (targetText) {
      result.isMatch = compare(targetText, transcription);
    }

    return result;
  };

  return {
    transcribe,
    isLoading: false,
    error: null,
  };
}

function useVoiceGrading(options: UseVoiceGradingOptions) {
  const {
    cardId,
    cardUUID,
    onGradingResultCaptured,
    langCode,
    targetText,
  } = options;
  const gradeSpeakingQuiz = trpc.gradeSpeakingQuiz.useMutation();

  const gradeAudio = async (blob: Blob): Promise<GradingResult> => {
    const transcription = await transcribeBlob(blob, langCode, targetText);

    const { isCorrect, feedback, quizResultId } =
      await gradeSpeakingQuiz.mutateAsync({
        userInput: transcription,
        cardID: cardId,
      });

    const result = {
      transcription,
      isCorrect,
      feedback,
      quizResultId: quizResultId ?? null,
    };

    if (onGradingResultCaptured) {
      onGradingResultCaptured(cardUUID, result);
    }

    return result;
  };

  return {
    gradeAudio,
    isLoading: gradeSpeakingQuiz.isLoading,
    error: gradeSpeakingQuiz.error,
  };
}

function useQuizGrading({
  cardId,
  onSuccess,
  onError,
}: UseQuizGradingOptions) {
  const gradeQuiz = trpc.gradeQuiz.useMutation({
    onSuccess,
    onError,
  });

  const createGrader = (perceivedDifficulty: Grade) => {
    return async (): Promise<void> => {
      await gradeQuiz
        .mutateAsync({
          perceivedDifficulty,
          cardID: cardId,
        })
        .then(onSuccess, onError);
    };
  };

  const gradeWithAgain = createGrader(Grade.AGAIN);
  const gradeWithHard = createGrader(Grade.HARD);
  const gradeWithGood = createGrader(Grade.GOOD);
  const gradeWithEasy = createGrader(Grade.EASY);

  return {
    gradeWithAgain,
    gradeWithHard,
    gradeWithGood,
    gradeWithEasy,
    isLoading: gradeQuiz.isLoading,
    error: gradeQuiz.error,
  };
}

function usePhaseManager<T extends string>(
  initialPhase: T,
  currentStepUuid: string,
  additionalResetStates?: () => void,
) {
  const [phase, setPhase] = React.useState<T>(initialPhase);

  React.useEffect(() => {
    setPhase(initialPhase);
    additionalResetStates?.();
  }, [currentStepUuid]);

  return { phase, setPhase };
}

function useGradeHandler({
  gradeWithAgain,
  gradeWithHard,
  gradeWithGood,
  gradeWithEasy,
}: UseGradeHandlerProps) {
  const handleGradeSelect = async (grade: Grade) => {
    switch (grade) {
      case Grade.AGAIN:
        await gradeWithAgain();
        break;
      case Grade.HARD:
        await gradeWithHard();
        break;
      case Grade.GOOD:
        await gradeWithGood();
        break;
      case Grade.EASY:
        await gradeWithEasy();
        break;
    }
  };

  return { handleGradeSelect };
}

const createEmptyQueue = (): Queue => ({
  newWordIntro: [],
  remedialIntro: [],
  speaking: [],
  newWordOutro: [],
  remedialOutro: [],
});

const createQueueItem = (
  cardUUID: string,
  itemType: ItemType,
): QueueItem => ({
  cardUUID,
  itemType,
  stepUuid: uid(8),
});

function removeCardFromQueues(
  cardUUID: string,
  queue: Queue,
): { updatedQueue: Queue } {
  const updatedQueue = { ...queue };

  for (const type of EVERY_QUEUE_TYPE) {
    updatedQueue[type] = updatedQueue[type].filter(
      (item) => item.cardUUID !== cardUUID,
    );
  }

  return { updatedQueue };
}

function skipCard(action: SkipCardAction, state: State): State {
  const cardUUID = action.payload.uuid;
  const { updatedQueue } = removeCardFromQueues(cardUUID, state.queue);

  return {
    ...state,
    queue: updatedQueue,
    currentItem: nextQueueItem(updatedQueue),
  };
}

function getItemsDue(queue: Queue): number {
  return EVERY_QUEUE_TYPE.reduce(
    (acc, type) => acc + queue[type].length,
    0,
  );
}

function nextQueueItem(queue: Queue): QueueItem | undefined {
  for (const type of EVERY_QUEUE_TYPE) {
    const item = queue[type][0];
    if (item) {
      return item;
    }
  }
  return;
}

function initialState(): State {
  return {
    queue: createEmptyQueue(),
    cards: {},
    currentItem: undefined,
    gradingResults: {},
    initialCardCount: 0,
    initialStepCount: 0,
    completedCards: new Set(),
  };
}

function replaceCards(action: ReplaceCardAction, state: State): State {
  const cards: QuizMap = {};
  const nextQueue = createEmptyQueue();

  for (const item of action.payload) {
    cards[item.uuid] = item;
    switch (item.lessonType) {
      case "new":
        nextQueue.newWordIntro.push(
          createQueueItem(item.uuid, "newWordIntro"),
        );
        nextQueue.newWordOutro.push(
          createQueueItem(item.uuid, "newWordOutro"),
        );
        break;
      case "speaking":
        nextQueue.speaking.push(createQueueItem(item.uuid, "speaking"));
        break;
      case "remedial":
        nextQueue.remedialIntro.push(
          createQueueItem(item.uuid, "remedialIntro"),
        );
        nextQueue.remedialOutro.push(
          createQueueItem(item.uuid, "remedialOutro"),
        );
        break;
      default:
        throw new Error(`Unknown lesson type: ${item.lessonType}`);
    }
  }

  return {
    ...state,
    queue: nextQueue,
    cards,
    currentItem: nextQueueItem(nextQueue),
    gradingResults: {},
  };
}

function useReview(deckId: number) {
  const mutation = trpc.getNextQuizzes.useMutation();
  const repairCardMutation = trpc.editCard.useMutation();
  const [state, dispatch] = React.useReducer(reducer, initialState());
  const [isFetching, setIsFetching] = React.useState(true);
  const userSettings = useUserSettings();

  const urlParams = new URLSearchParams(window.location.search);
  const takeParam = urlParams.get("take");
  const take = takeParam
    ? Math.min(Math.max(parseInt(takeParam, 10), 1), 25)
    : 5;
  const fetchQuizzes = (currentDeckId: number) => {
    setIsFetching(true);
    mutation
      .mutateAsync(
        { take, deckId: currentDeckId },
        {
          onSuccess: (fetchedData) => {
            const withUUID = fetchedData.quizzes.map((q) => ({
              ...q,
              uuid: uid(8),
            }));
            dispatch({ type: "REPLACE_CARDS", payload: withUUID });
          },
        },
      )
      .finally(() => setIsFetching(false));
  };

  React.useEffect(() => {
    if (deckId) {
      fetchQuizzes(deckId);
    }
  }, [deckId]);

  const remainingSteps = getItemsDue(state.queue);
  const progress =
    state.initialStepCount > 0
      ? ((state.initialStepCount - remainingSteps) /
          state.initialStepCount) *
        100
      : 0;

  const findCardUUIDById = (cardId: number) =>
    Object.values(state.cards).find((card) => card.cardId === cardId)
      ?.uuid;

  const error = mutation.isError
    ? (mutation.error ?? new Error("Unknown error"))
    : null;

  return {
    error,
    isFetching,
    state,
    currentItem: state.currentItem,
    totalDue: getItemsDue(state.queue),
    gradingResults: state.gradingResults,
    progress,
    cardsRemaining: state.initialCardCount - state.completedCards.size,
    skipCard: (cardUUID: string) => {
      dispatch({ type: "SKIP_CARD", payload: { uuid: cardUUID } });
    },
    giveUp: async (cardUUID: string) => {
      const card = state.cards[cardUUID];
      if (card) {
        await playTermThenDefinition(card, userSettings.playbackSpeed);
      }
      dispatch({ type: "GIVE_UP", payload: { cardUUID } });
    },
    completeItem: (uuid: string) => {
      dispatch({ type: "COMPLETE_ITEM", payload: { uuid } });
    },
    onGradingResultCaptured: async (
      cardUUID: string,
      result: GradingResult,
    ) => {
      const card = state.cards[cardUUID];
      if (result.isCorrect && card.lessonType === "remedial") {
        await repairCardMutation.mutateAsync({
          id: card.cardId,
          lastFailure: 0,
        });
      }
      dispatch({
        type: "STORE_GRADE_RESULT",
        payload: { cardUUID, result },
      });
    },
    refetchQuizzes: () => {
      fetchQuizzes(deckId);
    },
    updateCardFields: (
      cardId: number,
      updates: { term: string; definition: string },
    ) => {
      const cardUUID = findCardUUIDById(cardId);
      if (!cardUUID) {
        return;
      }
      dispatch({
        type: "UPDATE_CARD",
        payload: {
          cardUUID,
          term: updates.term,
          definition: updates.definition,
        },
      });
    },
  };
}

function reducer(state: State, action: Action): State {
  console.log(action.type);
  console.log({ ...state, gradingResults: state.gradingResults });
  switch (action.type) {
    case "REPLACE_CARDS":
      const newState = replaceCards(action, state);
      return {
        ...newState,
        initialCardCount: Object.keys(newState.cards).length,
        initialStepCount: getItemsDue(newState.queue),
        completedCards: new Set(),
      };
    case "SKIP_CARD":
      return {
        ...skipCard(action, state),
        completedCards: new Set([
          ...state.completedCards,
          action.payload.uuid,
        ]),
      };
    case "COMPLETE_ITEM":
      const { uuid } = action.payload;
      const updatedQueue = { ...state.queue };

      let cardUUID: string | undefined;
      for (const queueType of EVERY_QUEUE_TYPE) {
        const item = state.queue[queueType].find(
          (item) => item.stepUuid === uuid,
        );
        if (item) {
          cardUUID = item.cardUUID;
          break;
        }
      }

      for (const queueType of EVERY_QUEUE_TYPE) {
        updatedQueue[queueType] = updatedQueue[queueType].filter(
          (item) => item.stepUuid !== uuid,
        );
      }

      const hasMoreItems = Object.values(updatedQueue).some((queue) =>
        queue.some((item) => item.cardUUID === cardUUID),
      );

      return {
        ...state,
        queue: updatedQueue,
        currentItem: nextQueueItem(updatedQueue),
        completedCards:
          !hasMoreItems && cardUUID
            ? new Set([...state.completedCards, cardUUID])
            : state.completedCards,
      };
    case "GIVE_UP":
      const { cardUUID: giveUpCardUUID } = action.payload;
      const { updatedQueue: giveUpQueue } = removeCardFromQueues(
        giveUpCardUUID,
        state.queue,
      );

      return {
        ...state,
        queue: giveUpQueue,
        currentItem: nextQueueItem(giveUpQueue),
        completedCards: new Set([...state.completedCards, giveUpCardUUID]),
      };
    case "STORE_GRADE_RESULT":
      return {
        ...state,
        gradingResults: {
          ...state.gradingResults,
          [action.payload.cardUUID]: action.payload.result,
        },
      };
    case "UPDATE_CARD":
      const target = state.cards[action.payload.cardUUID];
      if (!target) {
        return state;
      }
      return {
        ...state,
        cards: {
          ...state.cards,
          [action.payload.cardUUID]: {
            ...target,
            term: action.payload.term ?? target.term,
            definition: action.payload.definition ?? target.definition,
          },
        },
      };
    default:
      return state;
  }
}

function ReviewStateCard({ title, children }: ReviewStateCardProps) {
  return (
    <Container size="sm" py="xl">
      <Paper withBorder p="xl" radius="lg">
        <Stack gap="md">
          <Title order={3}>{title}</Title>
          {children}
        </Stack>
      </Paper>
    </Container>
  );
}

function MessageState({ title, children }: MessageStateProps) {
  return (
    <ReviewStateCard title={title}>
      <Text c="gray.7">{children}</Text>
    </ReviewStateCard>
  );
}

function NoMoreQuizzesState({
  deckId,
  onReload,
}: NoMoreQuizzesStateProps) {
  useHotkeys([[HOTKEYS.CONTINUE, onReload]]);
  const writingPracticeUrl = buildWritingPracticeUrl(
    buildReviewPath(deckId),
  );

  return (
    <ReviewStateCard title="Lesson Complete">
      <Stack gap="sm">
        <Button onClick={onReload} variant="filled" fullWidth>
          Fetch More Quizzes ({HOTKEYS.CONTINUE})
        </Button>
        <Text c="gray.7">
          You've reviewed all available quizzes for this session. You can:
        </Text>
        <Stack gap={4}>
          <Anchor component={Link} href={`/cards?deckId=${deckId}`}>
            Add more cards to this deck
          </Anchor>
          <Anchor component={Link} href={writingPracticeUrl}>
            Practice Writing
          </Anchor>
          <Anchor component={Link} href="/review">
            Go back to deck selection
          </Anchor>
        </Stack>
      </Stack>
    </ReviewStateCard>
  );
}

function ReviewLayout({
  contentHeight,
  showAssistant,
  assistant,
  children,
}: ReviewLayoutProps) {
  return (
    <Box
      w="100%"
      h={contentHeight}
      mih={contentHeight}
      style={{ background: REVIEW_BACKGROUND }}
    >
      <Flex h="100%" mih={0} align="stretch" gap="md">
        <Box flex={1} h="100%" mih={0} py="md">
          {children}
        </Box>
        {showAssistant && (
          <Box w={ASSISTANT_PANEL_WIDTH} h="100%" mih={0}>
            {assistant}
          </Box>
        )}
      </Flex>
    </Box>
  );
}

function useReviewLayout(): ReviewLayoutState {
  const [assistantOpen, setAssistantOpen] = React.useState(false);
  const theme = useMantineTheme();
  const isDesktop =
    useMediaQuery(`(min-width: ${theme.breakpoints.md})`) ?? false;

  React.useEffect(() => {
    if (isDesktop) {
      setAssistantOpen(true);
    }
  }, [isDesktop]);

  const contentHeight = "100vh";
  const showDesktopAssistant = isDesktop && assistantOpen;
  const assistantOffset = showDesktopAssistant ? ASSISTANT_PANEL_WIDTH : 0;

  const openAssistant = React.useCallback(
    () => setAssistantOpen(true),
    [],
  );
  const closeAssistant = React.useCallback(
    () => setAssistantOpen(false),
    [],
  );

  return {
    assistantOpen,
    openAssistant,
    closeAssistant,
    showDesktopAssistant,
    assistantOffset,
    isDesktop,
    contentHeight,
  };
}

function useReviewHandlers({
  state,
  addContextEvent,
  skipCard,
  giveUp,
  captureGradingResult,
  updateCardFields,
}: ReviewHandlersParams) {
  const handleGradingResultCaptured = React.useCallback(
    (cardUUID: string, result: GradingResult) => {
      const cardForResult = state.cards[cardUUID];
      if (cardForResult) {
        const outcome = result.isCorrect ? "correct" : "incorrect";
        const userSaid = result.transcription
          ? `User said: ${result.transcription}.`
          : "";
        const feedback = result.feedback
          ? `Feedback: ${result.feedback}.`
          : "";
        addContextEvent(
          "grading-result",
          `Card: ${cardForResult.term}; Outcome: ${outcome}. ${userSaid} ${feedback}`.trim(),
        );
      }
      captureGradingResult(cardUUID, result);
    },
    [addContextEvent, captureGradingResult, state.cards],
  );

  const handleSkipCard = React.useCallback(
    (cardUUID: string) => {
      const skipped = state.cards[cardUUID];
      if (skipped) {
        addContextEvent(
          "skip-card",
          `Card: ${skipped.term}; Definition: ${skipped.definition}`,
        );
      }
      skipCard(cardUUID);
    },
    [addContextEvent, skipCard, state.cards],
  );

  const handleGiveUp = React.useCallback(
    (cardUUID: string) => {
      const abandoned = state.cards[cardUUID];
      if (abandoned) {
        addContextEvent(
          "gave-up",
          `Card: ${abandoned.term}; Definition: ${abandoned.definition}`,
        );
      }
      giveUp(cardUUID);
    },
    [addContextEvent, giveUp, state.cards],
  );

  const handleAssistantCardEdited = React.useCallback(
    (cardId: number, updates: { term: string; definition: string }) => {
      updateCardFields(cardId, updates);
      const matchingCard = Object.values(state.cards).find(
        (item) => item.cardId === cardId,
      );
      if (!matchingCard) {
        return;
      }
      const termForLog = updates.term ?? matchingCard.term;
      const definitionForLog =
        updates.definition ?? matchingCard.definition;
      if (!termForLog && !definitionForLog) {
        return;
      }
      addContextEvent(
        "card-edited",
        `CardID ${cardId}; Term: ${termForLog || "(unchanged)"}; Definition: ${definitionForLog || "(unchanged)"}`,
      );
    },
    [addContextEvent, state.cards, updateCardFields],
  );

  return {
    handleGradingResultCaptured,
    handleSkipCard,
    handleGiveUp,
    handleAssistantCardEdited,
  };
}

function useReviewAudio({
  card,
  itemType,
  playbackSpeed,
}: {
  card?: Quiz;
  itemType?: ItemType;
  playbackSpeed?: number;
}) {
  return React.useCallback(async () => {
    if (!card) {
      console.warn("No card available for playback.");
      return;
    }
    switch (itemType) {
      case "remedialIntro":
      case "newWordIntro":
        return await playTermThenDefinition(card, playbackSpeed);
      case "speaking":
      case "newWordOutro":
      case "remedialOutro":
        return await playAudio(card.definitionAudio, playbackSpeed);
      default:
        console.warn("No audio available for this card type.");
    }
  }, [card, itemType, playbackSpeed]);
}

function useReviewContextLogger({
  card,
  currentItem,
  addContextEvent,
}: {
  card?: Quiz;
  currentItem?: QueueItem;
  addContextEvent: (type: string, summary: string) => void;
}) {
  React.useEffect(() => {
    if (!card || !currentItem) {
      return;
    }
    addContextEvent(
      "card-shown",
      `CardID: ${card.cardId}; Term: ${card.term}; Definition: ${card.definition}; Step: ${currentItem.itemType}`,
    );
  }, [
    addContextEvent,
    card?.definition,
    card?.cardId,
    card?.term,
    card?.uuid,
    currentItem?.itemType,
    currentItem?.stepUuid,
  ]);
}

function useAutoPlayCard(
  currentItem: QueueItem | undefined,
  playCard: () => Promise<void>,
) {
  React.useEffect(() => {
    if (currentItem) {
      void playCard();
    }
  }, [currentItem, playCard]);
}

function CardImage({
  imageURL,
  definition,
}: {
  imageURL?: string;
  definition: string;
}) {
  if (!imageURL) {
    return null;
  }

  return (
    <Image
      src={imageURL}
      alt={`Image: ${definition}`}
      maw="100%"
      mah={240}
      fit="contain"
    />
  );
}

function FeedbackVote({ resultId, onClick }: FeedbackVoteProps) {
  const mutation = trpc.editQuizResult.useMutation();
  const [selected, setSelected] = React.useState<1 | -1 | null>(null);
  const isLocked = selected !== null || mutation.isLoading;

  const vote = (value: 1 | -1) => {
    if (selected !== null) {
      return;
    }
    setSelected(value);
    onClick?.();
    void mutation.mutateAsync({
      resultId,
      data: { helpfulness: value },
    });
  };

  return (
    <Group gap="xs" justify="center">
      <Text size="sm" c="dimmed">
        Was this helpful?
      </Text>
      <Tooltip label="Yes" openDelay={200}>
        <ActionIcon
          variant={selected === 1 ? "filled" : "default"}
          color="green"
          onClick={() => vote(1)}
          disabled={isLocked}
          aria-label="Thumbs up"
        >
          <IconThumbUp size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="No" openDelay={200}>
        <ActionIcon
          variant={selected === -1 ? "filled" : "default"}
          color="red"
          onClick={() => vote(-1)}
          disabled={isLocked}
          aria-label="Thumbs down"
        >
          <IconThumbDown size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

function FailureView({
  imageURL,
  term,
  definition,
  userTranscription,
  feedback,
  quizResultId,
  onContinue,
  failureText = "Not quite right",
}: FailureViewProps) {
  return (
    <Stack align="center" gap="md">
      <CardImage imageURL={imageURL} definition={definition} />

      <Text ta="center" c="red" fw={500} size="lg">
        {failureText}
      </Text>

      <Text size="xl" fw={700} ta="center">
        {term}
      </Text>

      <Text ta="center">{definition}</Text>

      <Button onClick={onContinue} variant="light" color="blue">
        Continue ({HOTKEYS.CONTINUE})
      </Button>

      <Text ta="center" size="sm" c="dimmed">
        You said: "{userTranscription}"
      </Text>

      {renderFeedbackSection(feedback, quizResultId, onContinue)}

      <Text ta="center" c="dimmed" mt="md">
        We'll review this again later.
      </Text>
    </Stack>
  );
}

function renderFeedbackSection(
  feedback?: string,
  quizResultId?: number | null,
  onContinue?: () => void,
) {
  if (!feedback) {
    return null;
  }
  return (
    <Stack gap={4} align="center">
      <Text ta="center" c="dimmed">
        {feedback}
      </Text>
      {quizResultId && (
        <FeedbackVote resultId={quizResultId} onClick={onContinue} />
      )}
    </Stack>
  );
}

function GradingSuccess({
  quizData,
  onGradeSelect,
  isLoading,
  feedback,
  quizResultId,
}: GradingSuccessProps) {
  const gradeOptions = getGradeButtonText(quizData);

  const hotkeys: [string, () => void][] = [
    [HOTKEYS.GRADE_AGAIN, () => !isLoading && onGradeSelect(Grade.AGAIN)],
    [HOTKEYS.GRADE_HARD, () => !isLoading && onGradeSelect(Grade.HARD)],
    [HOTKEYS.GRADE_GOOD, () => !isLoading && onGradeSelect(Grade.GOOD)],
    [HOTKEYS.GRADE_EASY, () => !isLoading && onGradeSelect(Grade.EASY)],
  ];

  useHotkeys(hotkeys);

  return (
    <Stack gap="md" align="center">
      {renderSuccessHeader(feedback, quizResultId)}
      <Text ta="center" size="sm" c="dimmed" mt="md">
        How difficult was this for you?
      </Text>
      <Stack gap="sm" w="100%" maw={400}>
        {gradeOptions.map(([grade, timeText]) => {
          const label = gradeLabels[grade];
          const hotkey = gradeHotkeys[grade];

          return (
            <Button
              key={grade}
              onClick={() => onGradeSelect(grade)}
              color={gradeColors[grade]}
              variant="outline"
              size="md"
              fullWidth
              disabled={isLoading}
              justify="space-between"
              h={48}
              px="md"
              rightSection={
                <Text span fz="sm" opacity={0.8}>
                  {timeText}
                </Text>
              }
            >
              <Text span fw={600}>
                {label} ({hotkey})
              </Text>
            </Button>
          );
        })}
      </Stack>
    </Stack>
  );
}

function renderSuccessHeader(
  feedback?: string,
  quizResultId?: number | null,
) {
  const hasFeedback =
    feedback && !feedback.toLowerCase().includes("exact match");
  if (hasFeedback) {
    return (
      <Stack gap={4} align="center">
        <Text ta="center" c="green" fw={500} size="lg">
          {feedback}
        </Text>
        {quizResultId && <FeedbackVote resultId={quizResultId} />}
      </Stack>
    );
  }
  return (
    <Text ta="center" c="green" fw={500} size="lg">
      Correct!
    </Text>
  );
}

const introPhaseContent = (
  term: string,
  userTranscription: string,
): Record<IntroPhase, React.ReactNode> => ({
  ready: (
    <Text ta="center" c="dimmed">
      Press the record button above and repeat the phrase.
    </Text>
  ),
  processing: (
    <Text ta="center" c="dimmed">
      Processing your recording...
    </Text>
  ),
  retry: (
    <>
      <VisualDiff expected={term} actual={userTranscription} />
      <Text ta="center" c="dimmed">
        Try again - press record and repeat the phrase
      </Text>
    </>
  ),
  success: (
    <Text ta="center" c="green" fw={500}>
      Correct!
    </Text>
  ),
});

const IntroCard: React.FC<IntroCardProps> = ({
  card,
  onProceed,
  currentStepUuid,
  isRemedial = false,
  onProvideAudioHandler,
}) => {
  const { term, definition } = card;
  const [userTranscription, setUserTranscription] =
    React.useState<string>("");

  const { transcribe } = useVoiceTranscription({
    targetText: card.term,
    langCode: "ko",
  });

  const { phase, setPhase } = usePhaseManager<IntroPhase>(
    "ready",
    currentStepUuid,
    () => setUserTranscription(""),
  );

  const processRecording = async (blob: Blob) => {
    setPhase("processing");

    try {
      const { transcription, isMatch } = await transcribe(blob);
      setUserTranscription(transcription);

      if (isMatch) {
        setPhase("success");
        onProceed();
      } else {
        setPhase("retry");
      }
    } catch {
      setPhase("retry");
      setUserTranscription("Error occurred during transcription.");
    }
  };

  React.useEffect(() => {
    onProvideAudioHandler?.(processRecording);
  }, [currentStepUuid]);

  const content = introPhaseContent(term, userTranscription)[phase];

  return (
    <Stack align="center" gap="md">
      <CardImage imageURL={card.imageURL} definition={definition} />

      <Text
        ta="center"
        c={isRemedial ? "orange" : "green"}
        fw={500}
        size="sm"
      >
        {isRemedial ? "Re-Learn a Card" : "New Card"}
      </Text>

      <Text size="xl" fw={700} ta="center">
        {term}
      </Text>

      <Text ta="center">{definition}</Text>

      {content}
    </Stack>
  );
};

function NewWordIntro(props: CardReviewProps) {
  return <IntroCard {...props} isRemedial={false} />;
}

function RemedialIntro(props: CardReviewProps) {
  return <IntroCard {...props} isRemedial={true} />;
}

const resolveLastReviewMs = (lastReview: Quiz["lastReview"]): number => {
  if (!lastReview) {
    return 0;
  }
  if (typeof lastReview === "number") {
    return lastReview;
  }
  const parsed = new Date(lastReview).getTime();
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
};

const quizPhaseContent = (
  phase: QuizPhase,
  config: QuizConfig,
  card: Quiz,
  feedback: string,
  quizResultId: number | null,
  handleGradeSelect: (grade: Grade) => Promise<void>,
  isLoading: boolean,
) => {
  const quizData = {
    difficulty: card.difficulty,
    stability: card.stability,
    lastReview: resolveLastReviewMs(card.lastReview),
    lapses: card.lapses,
    repetitions: card.repetitions,
  };

  return {
    ready: (
      <Text ta="center" c="dimmed">
        {config.instructionText}
      </Text>
    ),
    processing: (
      <Text ta="center" c="dimmed">
        Grading your response...
      </Text>
    ),
    success: (
      <GradingSuccess
        quizData={quizData}
        onGradeSelect={handleGradeSelect}
        isLoading={isLoading}
        feedback={feedback}
        quizResultId={quizResultId}
      />
    ),
    failure: null,
  }[phase];
};

const QuizCard: React.FC<QuizCardProps> = ({
  card,
  onProceed,
  currentStepUuid,
  quizType,
  onGradingResultCaptured,
  onProvideAudioHandler,
}) => {
  const { term, definition } = card;
  const [userTranscription, setUserTranscription] =
    React.useState<string>("");
  const [feedback, setFeedback] = React.useState<string>("");
  const [quizResultId, setQuizResultId] = React.useState<number | null>(
    null,
  );
  const userSettings = useUserSettings();

  const config = quizConfigs[quizType];

  const { gradeAudio } = useVoiceGrading({
    targetText: card.term,
    langCode: "ko",
    cardId: card.cardId,
    cardUUID: card.uuid,
    onGradingResultCaptured,
  });

  const {
    gradeWithAgain,
    gradeWithHard,
    gradeWithGood,
    gradeWithEasy,
    isLoading,
  } = useQuizGrading({
    cardId: card.cardId,
    onSuccess: onProceed,
  });

  const { phase, setPhase } = usePhaseManager<QuizPhase>(
    "ready",
    currentStepUuid,
    () => {
      setUserTranscription("");
      setFeedback("");
    },
  );

  const { handleGradeSelect } = useGradeHandler({
    gradeWithAgain,
    gradeWithHard,
    gradeWithGood,
    gradeWithEasy,
  });

  React.useEffect(() => {
    if (phase === "success") {
      void playTermThenDefinition(card, userSettings.playbackSpeed);
      return;
    }
    if (phase === "failure") {
      void playTermThenDefinitionWithFeedback(
        card,
        feedback,
        userSettings.playbackSpeed,
      ).catch((error) => {
        console.error("Failed to play correction audio:", error);
      });
    }
  }, [phase, card, feedback, userSettings.playbackSpeed]);

  const processRecording = async (blob: Blob) => {
    setPhase("processing");

    try {
      const result = await gradeAudio(blob);
      setUserTranscription(result.transcription);
      setFeedback(result.feedback);
      setQuizResultId(result.quizResultId ?? null);

      if (result.isCorrect) {
        setPhase("success");
      } else {
        setPhase("failure");
      }
    } catch (error) {
      console.error("Grading error:", error);
      setPhase("failure");
      setFeedback("Error occurred during grading.");
    }
  };

  React.useEffect(() => {
    onProvideAudioHandler?.(processRecording);
  }, [currentStepUuid]);

  const handleFailureContinue = async () => {
    await gradeWithAgain();
    onProceed();
  };

  const handleIDK = async () => {
    await playTermThenDefinition(card, userSettings.playbackSpeed);
    await playTermThenDefinition(card, userSettings.playbackSpeed);
    await gradeWithAgain();
  };

  if (phase === "failure") {
    return (
      <FailureView
        imageURL={card.imageURL}
        term={term}
        definition={definition}
        userTranscription={userTranscription}
        feedback={feedback}
        quizResultId={quizResultId}
        onContinue={handleFailureContinue}
        failureText={config.failureText}
      />
    );
  }

  const content = quizPhaseContent(
    phase,
    config,
    card,
    feedback,
    quizResultId,
    handleGradeSelect,
    isLoading,
  );

  const promptText = (
    <Text size="xl" fw={700} ta="center">
      {config.promptText(definition)}
    </Text>
  );
  return (
    <Stack align="center" gap="md">
      <CardImage imageURL={card.imageURL} definition={definition} />

      {config.headerText && (
        <Text ta="center" c={config.headerColor} fw={500} size="sm">
          {config.headerText}
        </Text>
      )}

      {!feedback && promptText}

      {phase === "ready" && (
        <Button
          color="red"
          variant="outline"
          onClick={handleIDK}
          fullWidth
          size="md"
          maw={400}
        >
          I don't know ({HOTKEYS.FAIL})
        </Button>
      )}

      {content}
    </Stack>
  );
};

function NewWordOutro(props: CardReviewProps) {
  return <QuizCard {...props} quizType="newWordOutro" />;
}

function Speaking(props: CardReviewProps) {
  return <QuizCard {...props} quizType="speaking" />;
}

function renderSuccessSection(
  successText?: string,
  quizResultId?: number | null,
  onContinue?: () => void,
) {
  if (successText) {
    return (
      <Stack gap={4} align="center">
        <Text ta="center" c="green" fw={500} size="lg">
          {successText}
        </Text>
        {quizResultId && (
          <FeedbackVote resultId={quizResultId} onClick={onContinue} />
        )}
      </Stack>
    );
  }
  return (
    <Text ta="center" c="green" fw={500} size="lg">
      Well done!
    </Text>
  );
}

function SuccessView({
  imageURL,
  term,
  definition,
  onContinue,
  successText,
  quizResultId,
}: {
  imageURL?: string;
  term: string;
  definition: string;
  onContinue: () => void;
  successText?: string;
  quizResultId?: number | null;
}) {
  return (
    <Stack align="center" gap="md">
      <CardImage imageURL={imageURL} definition={definition} />

      {renderSuccessSection(successText, quizResultId, onContinue)}

      <Button onClick={onContinue} variant="light" color="green">
        Continue ({HOTKEYS.CONTINUE})
      </Button>

      <Text size="xl" fw={700} ta="center">
        {term}
      </Text>

      <Text ta="center">{definition}</Text>
    </Stack>
  );
}

function RemedialOutro({
  card,
  onProceed,
  currentStepUuid,
  onGradingResultCaptured,
  onProvideAudioHandler,
}: CardReviewProps) {
  const { term, definition } = card;
  const [gradingResult, setGradingResult] =
    React.useState<GradingResult | null>(null);
  const userSettings = useUserSettings();
  const { gradeWithAgain, isLoading } = useQuizGrading({
    cardId: card.cardId,
    onSuccess: onProceed,
  });

  const { gradeAudio } = useVoiceGrading({
    targetText: card.term,
    langCode: "ko",
    cardId: card.cardId,
    cardUUID: card.uuid,
    onGradingResultCaptured,
  });

  const { phase, setPhase } = usePhaseManager<RemedialOutroPhase>(
    "ready",
    currentStepUuid,
    () => setGradingResult(null),
  );

  const processRecording = async (blob: Blob) => {
    setPhase("processing");

    try {
      const result = await gradeAudio(blob);
      setGradingResult(result);

      if (result.isCorrect) {
        setPhase("success");
      } else {
        setPhase("failure");
      }
    } catch (error) {
      console.error("Grading error:", error);
      setPhase("failure");
      setGradingResult({
        transcription: "Error occurred during processing.",
        isCorrect: false,
        feedback: "An error occurred while processing your response.",
        quizResultId: null,
      });
    }
  };

  React.useEffect(() => {
    onProvideAudioHandler?.(processRecording);
  }, [currentStepUuid]);

  const feedbackText = gradingResult?.feedback?.trim() ?? "";

  React.useEffect(() => {
    if (phase !== "failure" || !feedbackText) {
      return;
    }
    void playSpeechText(feedbackText, userSettings.playbackSpeed).catch(
      (error) => {
        console.error("Failed to play correction audio:", error);
      },
    );
  }, [feedbackText, phase, userSettings.playbackSpeed]);

  const handleIDK = async () => {
    await playTermThenDefinition(card, userSettings.playbackSpeed);
    await playTermThenDefinition(card, userSettings.playbackSpeed);
    await gradeWithAgain();
  };

  if (phase === "failure") {
    return (
      <FailureView
        imageURL={card.imageURL}
        term={term}
        definition={definition}
        userTranscription={gradingResult?.transcription || ""}
        quizResultId={gradingResult?.quizResultId ?? null}
        onContinue={onProceed}
        failureText={gradingResult?.feedback || "Not quite right"}
      />
    );
  }

  if (phase === "success") {
    return (
      <SuccessView
        imageURL={card.imageURL}
        term={term}
        definition={definition}
        onContinue={onProceed}
        successText={gradingResult?.feedback || ""}
        quizResultId={gradingResult?.quizResultId ?? null}
      />
    );
  }

  return (
    <Stack align="center" gap="md">
      <CardImage imageURL={card.imageURL} definition={definition} />

      <Text ta="center" c="orange" fw={500} size="sm">
        Remedial Review
      </Text>

      <Text size="xl" fw={700} ta="center">
        How would you say "{definition}"?
      </Text>

      <Button
        color="red"
        variant="outline"
        onClick={handleIDK}
        disabled={isLoading}
        fullWidth
        size="md"
        maw={400}
      >
        I don't know ({HOTKEYS.FAIL})
      </Button>

      {remedialPhaseContent[phase]}
    </Stack>
  );
}

const UnknownCard: CardUI = ({ card }) => (
  <div>{`UNKNOWN CARD TYPE: ${card.uuid}`}</div>
);

const getRecordLabel = (recordDisabled: boolean, isRecording: boolean) => {
  if (recordDisabled) {
    return "Recording disabled after success";
  }
  if (isRecording) {
    return `Stop recording (${HOTKEYS.RECORD})`;
  }
  return `Record a response (${HOTKEYS.RECORD})`;
};

function ControlBarMenu({
  onEdit,
  onArchive,
  onSkip,
  onFail,
}: ControlBarMenuProps) {
  return (
    <Menu shadow="md" width={240}>
      <Menu.Target>
        <ActionIcon
          variant="outline"
          size={44}
          radius="xl"
          color="pink.7"
          aria-label="More"
        >
          <IconDots size={20} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          component="a"
          href="/"
          leftSection={<IconDoorExit size={16} />}
        >
          Exit lesson
        </Menu.Item>
        <Menu.Item onClick={onEdit} leftSection={<IconEdit size={16} />}>
          Edit card ({HOTKEYS.EDIT.toUpperCase()})
        </Menu.Item>
        <Menu.Item
          onClick={onArchive}
          leftSection={<IconArchive size={16} />}
        >
          Archive card ({HOTKEYS.ARCHIVE.toUpperCase()})
        </Menu.Item>
        <Menu.Item
          onClick={onSkip}
          leftSection={<IconPlayerSkipForwardFilled size={16} />}
        >
          Next card ({HOTKEYS.SKIP.toUpperCase()})
        </Menu.Item>
        <Menu.Item
          onClick={onFail}
          leftSection={<IconLetterF size={16} />}
        >
          Fail card ({HOTKEYS.FAIL.toUpperCase()})
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

const ControlBar: React.FC<ControlBarProps> = (props) => {
  const {
    card,
    onSkip,
    onGiveUp,
    isRecording,
    onRecordClick,
    onArchiveClick,
    onPlayAudio,
    itemType,
  } = props;

  const openCardEditor = () =>
    window.open(`/cards/${card.cardId}`, "_blank");

  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

  const recordDisabled = props.disableRecord === true;
  const recordLabel = getRecordLabel(recordDisabled, isRecording);
  const playDisabled = itemType === "speaking";
  const playLabel = playDisabled
    ? "Audio disabled during speaking quiz"
    : `Play audio (${HOTKEYS.PLAY})`;

  const pct = props.progress ?? undefined;
  const recordSize = isMobile ? 64 : 72;
  const recordVariant = isRecording ? "filled" : "outline";
  const recordAriaLabel = isRecording
    ? "Stop recording"
    : "Start recording";

  const handleFailClick = () => {
    if (props.onFail) {
      props.onFail();
      return;
    }
    onGiveUp(card.uuid);
  };
  const handleSkipClick = () => onSkip(card.uuid);

  return (
    <Stack gap="xs">
      {pct !== undefined && (
        <Group gap="xs" align="center" justify="space-between">
          <Text size="xs" c="pink.7">
            {Math.round(pct)}%
          </Text>
          <Box flex={1}>
            <Progress value={pct} color="pink.6" radius="xl" size="md" />
          </Box>
        </Group>
      )}

      <Flex align="center" gap="md">
        <Group gap="xs" justify="flex-start" wrap="nowrap" flex={1}>
          <ControlBarMenu
            onEdit={openCardEditor}
            onArchive={onArchiveClick}
            onSkip={handleSkipClick}
            onFail={handleFailClick}
          />
        </Group>

        <Tooltip label={recordLabel}>
          <ActionIcon
            variant={recordVariant}
            size={recordSize}
            radius="xl"
            onClick={recordDisabled ? undefined : onRecordClick}
            color="pink.7"
            disabled={recordDisabled}
            aria-label={recordAriaLabel}
          >
            {isRecording ? (
              <IconPlayerStopFilled size={28} />
            ) : (
              <IconMicrophone size={28} />
            )}
          </ActionIcon>
        </Tooltip>

        <Group gap="xs" justify="flex-end" wrap="nowrap" flex={1}>
          {props.onOpenAssistant && (
            <Tooltip label="Open assistant">
              <ActionIcon
                variant="outline"
                size={44}
                radius="xl"
                onClick={props.onOpenAssistant}
                color="pink.7"
                aria-label="Open assistant"
              >
                <IconMessage size={20} />
              </ActionIcon>
            </Tooltip>
          )}

          <Tooltip label={playLabel}>
            <ActionIcon
              variant="outline"
              size={44}
              radius="xl"
              onClick={onPlayAudio}
              color="pink.7"
              disabled={playDisabled}
              aria-label="Play audio"
            >
              <IconPlayerPlayFilled size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Flex>
    </Stack>
  );
};

const isQuizItemType = (itemType: ItemType) =>
  itemType === "speaking" ||
  itemType === "newWordOutro" ||
  itemType === "remedialOutro";

const CardReview: React.FC<CardReviewWithRecordingProps> = (props) => {
  const {
    card,
    completeItem,
    currentStepUuid,
    itemType,
    onPlayAudio,
    onSkip,
    onProceed,
  } = props;

  const CardComponent = cardUIs[itemType] ?? UnknownCard;

  const onAudioHandlerRef = React.useRef<
    null | ((blob: Blob) => Promise<void>)
  >(null);
  const { start, stop, isRecording } = useMediaRecorder();
  const userSettings = useUserSettings();

  const openCardEditor = () =>
    window.open(`/cards/${card.cardId}`, "_blank");

  const archiveCardMutation = trpc.archiveCard.useMutation();
  const gradeQuiz = trpc.gradeQuiz.useMutation({
    onSuccess: () => completeItem(currentStepUuid),
  });

  const handleArchive = async () => {
    try {
      await archiveCardMutation.mutateAsync({ cardID: card.cardId });
    } catch (error) {
      console.error("Failed to archive card:", error);
    } finally {
      onSkip(card.uuid);
    }
  };

  const handleRecordToggle = async () => {
    if (props.disableRecord) {
      return;
    }
    if (!isRecording) {
      await start().catch(() => {
        notifications.show({
          title: "Microphone error",
          message:
            "Microphone access failed. On iOS: enable Microphone for Safari or the PWA in Settings.",
          color: "red",
        });
      });
      return;
    }
    const blob = await stop();
    if (userSettings && Math.random() < userSettings.playbackPercentage) {
      await playBlob(blob, userSettings.playbackSpeed);
    }
    if (onAudioHandlerRef.current) {
      void onAudioHandlerRef.current(blob).catch(() => undefined);
    }
  };

  const handleFail = async () => {
    await playTermThenDefinition(card, userSettings.playbackSpeed);
    await playTermThenDefinition(card, userSettings.playbackSpeed);
    if (isQuizItemType(itemType)) {
      await gradeQuiz.mutateAsync({
        perceivedDifficulty: Grade.AGAIN,
        cardID: card.cardId,
      });
      return;
    }
    onSkip(card.uuid);
  };

  const hotkeys: [string, () => void][] = [
    [HOTKEYS.PLAY, onPlayAudio],
    [HOTKEYS.EDIT, openCardEditor],
    [HOTKEYS.SKIP, () => onSkip(card.uuid)],
    [HOTKEYS.ARCHIVE, handleArchive],
    [HOTKEYS.FAIL, handleFail],
    [HOTKEYS.RECORD, handleRecordToggle],
    [HOTKEYS.CONTINUE, () => completeItem(currentStepUuid)],
  ];

  useHotkeys(hotkeys);

  const cardProps: CardReviewProps = {
    card,
    itemType,
    onProceed,
    onSkip,
    onGiveUp: props.onGiveUp,
    currentStepUuid,
    onGradingResultCaptured: props.onGradingResultCaptured,
    onProvideAudioHandler: (handler) => {
      onAudioHandlerRef.current = handler;
    },
  };

  return (
    <Box h="100%" mih="100%" pos="relative" pb={80}>
      <Box p="md">
        <CardComponent {...cardProps} />
      </Box>
      <Affix
        position={{
          bottom: 0,
          left: 0,
          right: props.assistantOffsetRight ?? 0,
        }}
        zIndex={100}
        withinPortal={false}
      >
        <Paper
          withBorder
          radius={0}
          bg="pink.0"
          px="sm"
          pt="sm"
          pb="calc(var(--mantine-spacing-sm) + env(safe-area-inset-bottom) / 2)"
        >
          <ControlBar
            card={card}
            itemType={itemType}
            onSkip={onSkip}
            onGiveUp={props.onGiveUp}
            isRecording={isRecording}
            onRecordClick={handleRecordToggle}
            onArchiveClick={handleArchive}
            onPlayAudio={onPlayAudio}
            progress={props.progress}
            cardsRemaining={props.cardsRemaining}
            onOpenAssistant={props.onOpenAssistant}
            disableRecord={props.disableRecord}
            onFail={handleFail}
          />
        </Paper>
      </Affix>
    </Box>
  );
};

const formatSummary = (value: string) =>
  value.replace(/\s+/g, " ").trim().slice(0, MAX_SUMMARY_LENGTH);

const formatTimestamp = (timestamp: number) =>
  new Date(timestamp).toISOString().slice(11, 16);

function StudyAssistantContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [events, setEvents] = React.useState<ContextEvent[]>([]);

  const addContextEvent = React.useCallback(
    (type: string, summary: string) => {
      const trimmed = formatSummary(summary);
      if (!trimmed) {
        return;
      }
      setEvents((prev) => {
        const next: ContextEvent[] = [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
            type: formatSummary(type),
            summary: trimmed,
          },
        ];
        return next.slice(-MAX_EVENTS);
      });
    },
    [],
  );

  const contextLog = React.useMemo(
    () =>
      events.map(
        (event) =>
          `[${formatTimestamp(event.timestamp)}] ${event.type}: ${event.summary}`,
      ),
    [events],
  );

  const value = React.useMemo(
    () => ({
      addContextEvent,
      contextLog,
    }),
    [addContextEvent, contextLog],
  );

  return (
    <StudyAssistantContext.Provider value={value}>
      {children}
    </StudyAssistantContext.Provider>
  );
}

function useStudyAssistantContext() {
  const ctx = React.useContext(StudyAssistantContext);
  if (!ctx) {
    throw new Error(
      "useStudyAssistantContext must be used within StudyAssistantContextProvider",
    );
  }
  return ctx;
}

function AssistantComposer({
  value,
  onChange,
  onSend,
  onStop,
  onClear,
  isStreaming,
  canClear,
}: AssistantComposerProps) {
  const handleSubmit = () => {
    onSend();
  };

  return (
    <Stack gap="xs" mt="sm">
      <Textarea
        autosize
        minRows={2}
        maxRows={6}
        placeholder="Ask about recent cards or request practice..."
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSubmit();
          }
        }}
      />
      <Group justify="space-between">
        <Text size="xs" c="dimmed">
          {isStreaming ? "Streaming..." : ""}
        </Text>
        <Group gap="xs">
          {isStreaming ? (
            <Button color="gray" variant="light" onClick={onStop}>
              Stop
            </Button>
          ) : (
            <>
              <Button
                variant="light"
                color="gray"
                onClick={onClear}
                disabled={!canClear}
              >
                Clear
              </Button>
              <Button
                onClick={handleSubmit}
                leftSection={<IconSend size={16} />}
                disabled={value.trim() === ""}
              >
                Send
              </Button>
            </>
          )}
        </Group>
      </Group>
    </Stack>
  );
}

const getMessageTone = (role: ChatMessage["role"]): MessageTone => {
  if (role === "user") {
    return "user";
  }
  return "assistant";
};

const getMessageLabel = (role: ChatMessage["role"]) =>
  role === "user" ? "You" : "Assistant";

function getOverlap(source: string, token: string) {
  const max = Math.min(source.length, token.length - 1);
  for (let len = max; len > 0; len -= 1) {
    if (source.endsWith(token.slice(0, len))) {
      return len;
    }
  }
  return 0;
}

function parseExample(content: string): ExampleBlock | null {
  const normalized = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (normalized.length < 2) {
    return null;
  }
  return {
    phrase: normalized[0],
    translation: normalized.slice(1).join(" "),
  };
}

function parseEdit(content: string): CardEditBlock | null {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const edit: CardEditBlock = {};
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    if (!rawKey || rest.length === 0) {
      continue;
    }
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (!value) {
      continue;
    }
    if (key === "cardid" || key === "id") {
      const parsedId = Number.parseInt(value, 10);
      if (Number.isFinite(parsedId)) {
        edit.cardId = parsedId;
      }
      continue;
    }
    if (key === "term") {
      edit.term = value;
      continue;
    }
    if (key === "definition") {
      edit.definition = value;
      continue;
    }
    if (key === "note" || key === "reason") {
      edit.note = value;
    }
  }

  if (
    !edit.cardId &&
    !edit.term &&
    !edit.definition &&
    !edit.note &&
    lines.length >= 2
  ) {
    return {
      term: lines[0],
      definition: lines.slice(1).join(" "),
    };
  }

  return edit;
}

function createAssistantStreamParser() {
  let buffer = "";
  let blockType: BlockType | null = null;
  let blockBuffer = "";

  const applyResult = (
    textDelta: string,
    examples: ExampleBlock[],
    edits: CardEditBlock[],
  ): AssistantParserResult => ({
    textDelta,
    examples,
    edits,
  });

  const createToken = (type: BlockType, index: number) => ({
    type,
    index,
  });

  const resolveStartToken = (content: string) => {
    const exampleIdx = content.indexOf(EXAMPLE_START);
    const editIdx = content.indexOf(EDIT_START);

    if (exampleIdx === -1 && editIdx === -1) {
      return null;
    }

    if (exampleIdx === -1) {
      return createToken("edit", editIdx);
    }

    if (editIdx === -1) {
      return createToken("example", exampleIdx);
    }

    if (exampleIdx < editIdx) {
      return createToken("example", exampleIdx);
    }

    return createToken("edit", editIdx);
  };

  const getPlaceholder = (type: BlockType) =>
    type === "example" ? EXAMPLE_PLACEHOLDER : EDIT_PLACEHOLDER;

  const getStartToken = (type: BlockType) =>
    type === "example" ? EXAMPLE_START : EDIT_START;

  const getEndToken = (type: BlockType) =>
    type === "example" ? EXAMPLE_END : EDIT_END;

  const push = (chunk: string): AssistantParserResult => {
    buffer += chunk;
    let emittedText = "";
    const foundExamples: ExampleBlock[] = [];
    const foundEdits: CardEditBlock[] = [];

    while (buffer.length > 0) {
      if (blockType === null) {
        const match = resolveStartToken(buffer);
        if (!match) {
          const overlap = Math.max(
            getOverlap(buffer, EXAMPLE_START),
            getOverlap(buffer, EDIT_START),
          );
          const flushLen = buffer.length - overlap;
          if (flushLen > 0) {
            emittedText += buffer.slice(0, flushLen);
            buffer = buffer.slice(flushLen);
          }
          break;
        }
        const { type, index } = match;
        if (index > 0) {
          emittedText += buffer.slice(0, index);
        }
        buffer = buffer.slice(index + getStartToken(type).length);
        blockType = type;
        blockBuffer = "";
        continue;
      }

      const endToken = getEndToken(blockType);
      const endIdx = buffer.indexOf(endToken);
      if (endIdx === -1) {
        const overlap = getOverlap(buffer, endToken);
        const takeLen = buffer.length - overlap;
        if (takeLen > 0) {
          blockBuffer += buffer.slice(0, takeLen);
          buffer = buffer.slice(takeLen);
        }
        break;
      }

      blockBuffer += buffer.slice(0, endIdx);
      buffer = buffer.slice(endIdx + endToken.length);
      if (blockType === "example") {
        const parsedExample = parseExample(blockBuffer);
        if (parsedExample) {
          foundExamples.push(parsedExample);
          emittedText += getPlaceholder("example");
        } else {
          emittedText += blockBuffer;
        }
      } else {
        const parsedEdit = parseEdit(blockBuffer);
        if (parsedEdit) {
          foundEdits.push(parsedEdit);
          emittedText += getPlaceholder("edit");
        } else {
          emittedText += blockBuffer;
        }
      }
      blockType = null;
      blockBuffer = "";
    }

    return applyResult(emittedText, foundExamples, foundEdits);
  };

  const flush = (): AssistantParserResult => {
    if (blockType !== null) {
      buffer = "";
      blockBuffer = "";
      blockType = null;
      return applyResult("", [], []);
    }
    const text = buffer;
    buffer = "";
    return applyResult(text, [], []);
  };

  return { push, flush };
}

function AssistantMessageList({
  messages,
  viewportRef,
  onAddSuggestion,
  isAdding,
  decks,
  currentDeckId,
  onApplyEdit,
  onDismissEdit,
  savingEditId,
}: AssistantMessageListProps) {
  return (
    <Box
      ref={viewportRef}
      h="100%"
      mih={0}
      style={messageScrollContainerStyle}
    >
      <Stack gap="sm" pr="sm" mih="100%" justify="flex-end">
        {messages.map((message, index) => {
          const tone = getMessageTone(message.role);
          const styles = messageToneStyles[tone];

          return (
            <Paper
              key={index}
              p="sm"
              bg={styles.background}
              radius="md"
              shadow="xs"
            >
              <Text size="xs" fw={600} c={styles.labelColor} mb={4}>
                {getMessageLabel(message.role)}
              </Text>
              <AssistantMessageContent
                message={message}
                messageIndex={index}
                onAddSuggestion={onAddSuggestion}
                isAdding={isAdding}
                decks={decks}
                currentDeckId={currentDeckId}
                onApplyEdit={onApplyEdit}
                onDismissEdit={onDismissEdit}
                savingEditId={savingEditId}
              />
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
}

const chunkContent = (content: string): ContentChunk[] => {
  const chunks: ContentChunk[] = [];
  let remaining = content;

  const findNextPlaceholder = (
    value: string,
  ): { placeholder: PlaceholderType; index: number } | null => {
    let next: { placeholder: PlaceholderType; index: number } | null =
      null;
    placeholderOrder.forEach((type) => {
      const index = value.indexOf(placeholderTokens[type]);
      if (index === -1) {
        return;
      }
      if (!next || index < next.index) {
        next = { placeholder: type, index };
      }
    });
    return next;
  };

  while (remaining.length > 0) {
    const nextHit = findNextPlaceholder(remaining);
    if (!nextHit) {
      chunks.push({ kind: "text", value: remaining });
      break;
    }

    if (nextHit.index > 0) {
      chunks.push({
        kind: "text",
        value: remaining.slice(0, nextHit.index),
      });
    }

    chunks.push({ kind: "placeholder", placeholder: nextHit.placeholder });
    remaining = remaining.slice(
      nextHit.index + placeholderTokens[nextHit.placeholder].length,
    );
  }

  return chunks;
};

const resolveDefaultDeckId = (
  decks: DeckSummary[],
  currentDeckId: number,
) => {
  const matchesCurrent = decks.some((deck) => deck.id === currentDeckId);
  if (matchesCurrent) {
    return currentDeckId;
  }
  if (decks.length > 0) {
    return decks[0].id;
  }
  return currentDeckId;
};

function renderText(
  message: ChatMessage,
  text: string,
  key: string,
): React.ReactNode | null {
  if (!text) {
    return null;
  }
  if (message.role === "assistant") {
    return (
      <AssistantMarkdown
        key={key}
        content={text}
        style={messageTextStyle}
      />
    );
  }
  return (
    <Text key={key} style={messageTextStyle}>
      {text}
    </Text>
  );
}

function AssistantMessageContent({
  message,
  messageIndex,
  onAddSuggestion,
  isAdding,
  decks,
  currentDeckId,
  onApplyEdit,
  onDismissEdit,
  savingEditId,
}: AssistantMessageContentProps) {
  const nodes: React.ReactNode[] = [];
  const suggestions = message.suggestions ?? [];
  const edits = message.edits ?? [];
  let suggestionIdx = 0;
  let editIdx = 0;
  const defaultDeckId = resolveDefaultDeckId(decks, currentDeckId);

  chunkContent(message.content).forEach((chunk, idx) => {
    if (chunk.kind === "text") {
      const textNode = renderText(
        message,
        chunk.value,
        `msg-${messageIndex}-text-${idx}`,
      );
      if (textNode) {
        nodes.push(textNode);
      }
      return;
    }

    if (chunk.placeholder === "example") {
      const suggestion = suggestions[suggestionIdx];
      if (suggestion) {
        nodes.push(
          <AssistantSuggestionRow
            key={`msg-${messageIndex}-example-${suggestionIdx}`}
            suggestion={suggestion}
            onAdd={(deckId) => onAddSuggestion(suggestion, deckId)}
            isLoading={isAdding}
            decks={decks}
            defaultDeckId={defaultDeckId}
          />,
        );
      }
      suggestionIdx += 1;
      return;
    }

    const proposal = edits[editIdx];
    if (proposal) {
      nodes.push(
        <AssistantEditCard
          key={`msg-${messageIndex}-edit-${proposal.id}`}
          proposal={proposal}
          onSave={(updates) => onApplyEdit(proposal, updates)}
          onDismiss={() => onDismissEdit(proposal.id)}
          isSaving={savingEditId === proposal.id}
        />,
      );
    }
    editIdx += 1;
  });

  suggestions.slice(suggestionIdx).forEach((suggestion, idx) => {
    nodes.push(
      <AssistantSuggestionRow
        key={`msg-${messageIndex}-fallback-${idx}`}
        suggestion={suggestion}
        onAdd={(deckId) => onAddSuggestion(suggestion, deckId)}
        isLoading={isAdding}
        decks={decks}
        defaultDeckId={defaultDeckId}
      />,
    );
  });

  edits.slice(editIdx).forEach((proposal) => {
    nodes.push(
      <AssistantEditCard
        key={`msg-${messageIndex}-edit-${proposal.id}`}
        proposal={proposal}
        onSave={(updates) => onApplyEdit(proposal, updates)}
        onDismiss={() => onDismissEdit(proposal.id)}
        isSaving={savingEditId === proposal.id}
      />,
    );
  });

  return <Stack gap={6}>{nodes}</Stack>;
}

function MarkdownCode(
  props: MarkdownCodeProps & { style: React.CSSProperties },
) {
  const { inline, children, style } = props;
  const display = inline ? "inline" : "block";
  const padding = inline ? "0 4px" : "4px";

  return (
    <Text
      component="code"
      style={{
        ...style,
        display,
        padding,
        backgroundColor: "rgba(0, 0, 0, 0.05)",
        borderRadius: 4,
        fontFamily: "var(--mantine-font-family-monospace)",
      }}
    >
      {children}
    </Text>
  );
}

function AssistantMarkdown({ content, style }: AssistantMarkdownProps) {
  const markdownComponents = React.useMemo<Components>(
    () => ({
      p: ({ children }) => (
        <Text component="p" style={{ ...style, margin: 0 }}>
          {children}
        </Text>
      ),
      ul: ({ children }) => (
        <Box
          component="ul"
          style={{ ...style, margin: blockSpacing, paddingLeft: 0 }}
        >
          {children}
        </Box>
      ),
      ol: ({ children }) => (
        <Box
          component="ol"
          style={{ ...style, margin: blockSpacing, paddingLeft: 0 }}
        >
          {children}
        </Box>
      ),
      li: ({ children }) => (
        <Box component="li" style={{ ...style, marginBottom: 4 }}>
          {children}
        </Box>
      ),
      a: ({ children, href }) => (
        <Text
          component="a"
          href={href}
          c="indigo.7"
          style={style}
          target="_blank"
          rel="noreferrer"
        >
          {children}
        </Text>
      ),
      code: (props: MarkdownCodeProps) => (
        <MarkdownCode {...props} style={style} />
      ),
      blockquote: ({ children }) => (
        <Box
          component="blockquote"
          style={{
            ...style,
            margin: "4px 0",
            padding: "4px 12px",
            borderLeft: "3px solid var(--mantine-color-gray-4)",
            backgroundColor: "var(--mantine-color-gray-0)",
          }}
        >
          {children}
        </Box>
      ),
    }),
    [style],
  );

  return (
    <Box style={style}>
      <ReactMarkdown components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </Box>
  );
}

const toDeckOptions = (decks: DeckSummary[]) =>
  decks.map((deck) => ({
    value: String(deck.id),
    label: deck.name,
  }));

const parseDeckId = (value: string | null, fallback: number) => {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
};

function AssistantSuggestionRow({
  suggestion,
  onAdd,
  isLoading,
  decks,
  defaultDeckId,
}: AssistantSuggestionRowProps) {
  const [selectedDeckId, setSelectedDeckId] =
    React.useState(defaultDeckId);
  const deckOptions = React.useMemo(() => toDeckOptions(decks), [decks]);
  const isSelectionLocked = isLoading || deckOptions.length <= 1;

  const handleDeckChange = React.useCallback(
    (value: string | null) => {
      setSelectedDeckId(parseDeckId(value, defaultDeckId));
    },
    [defaultDeckId],
  );

  return (
    <Group align="flex-start" gap="xs" wrap="nowrap">
      <ActionIcon
        variant="light"
        color="indigo"
        radius="xl"
        size="md"
        onClick={() => onAdd(selectedDeckId)}
        disabled={isLoading}
        aria-label={`Add card for ${suggestion.phrase}`}
      >
        {isLoading ? <Loader size="xs" /> : <IconPlus size={14} />}
      </ActionIcon>
      <Stack gap={4} style={{ flex: 1 }}>
        <Text fw={600}>{suggestion.phrase}</Text>
        <Text size="sm" c="dimmed">
          {suggestion.translation}
        </Text>
        <Select
          data={deckOptions}
          value={String(selectedDeckId)}
          onChange={handleDeckChange}
          size="xs"
          placeholder="Deck"
          allowDeselect={false}
          disabled={isSelectionLocked}
          aria-label="Choose a deck"
        />
      </Stack>
    </Group>
  );
}

function AssistantEditCard({
  proposal,
  onSave,
  onDismiss,
  isSaving,
}: AssistantEditCardProps) {
  const [term, setTerm] = React.useState(proposal.term);
  const [definition, setDefinition] = React.useState(proposal.definition);

  React.useEffect(() => {
    setTerm(proposal.term);
    setDefinition(proposal.definition);
  }, [proposal.definition, proposal.term]);

  const hasOriginalTerm =
    proposal.originalTerm && proposal.originalTerm !== proposal.term;
  const hasOriginalDefinition =
    proposal.originalDefinition &&
    proposal.originalDefinition !== proposal.definition;
  const canSave = term.trim() !== "" && definition.trim() !== "";

  return (
    <Paper withBorder radius="md" p="sm" shadow="xs">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2} align="flex-start">
            <Text fz="sm" fw={700}>
              Edit card
            </Text>
            <Text size="xs" c="dimmed">
              Card #{proposal.cardId}
            </Text>
          </Stack>
          {proposal.note && (
            <Badge color="indigo" variant="light">
              {proposal.note}
            </Badge>
          )}
        </Group>

        {hasOriginalTerm && (
          <Text size="xs" c="dimmed">
            Current term: {proposal.originalTerm}
          </Text>
        )}
        <TextInput
          label="Term"
          value={term}
          onChange={(event) => setTerm(event.currentTarget.value)}
        />

        {hasOriginalDefinition && (
          <Text size="xs" c="dimmed">
            Current definition: {proposal.originalDefinition}
          </Text>
        )}
        <Textarea
          label="Definition"
          minRows={2}
          autosize
          value={definition}
          onChange={(event) => setDefinition(event.currentTarget.value)}
        />

        <Group justify="flex-end">
          <Button
            variant="subtle"
            color="gray"
            onClick={onDismiss}
            disabled={isSaving}
          >
            Dismiss
          </Button>
          <Button
            onClick={() => onSave({ term, definition })}
            disabled={!canSave || isSaving}
            loading={isSaving}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

function AssistantHeader({ onClose }: { onClose: () => void }) {
  return (
    <Group justify="space-between" mb="xs">
      <Group gap="xs">
        <IconMessage size={18} />
        <Title order={4}>Study Assistant</Title>
      </Group>
      <ActionIcon
        variant="subtle"
        onClick={onClose}
        aria-label="Close assistant"
      >
        <IconX size={18} />
      </ActionIcon>
    </Group>
  );
}

function AssistantPanel({
  messages,
  input,
  onInputChange,
  onSend,
  onStop,
  onClear,
  canClear,
  isStreaming,
  viewportRef,
  onAddSuggestion,
  isAdding,
  decks,
  currentDeckId,
  onClose,
  onApplyEdit,
  onDismissEdit,
  savingEditId,
}: AssistantPanelProps) {
  return (
    <Stack gap="sm" h="100%" mih={0}>
      <AssistantHeader onClose={onClose} />
      <Box flex={1} mih={0}>
        <AssistantMessageList
          messages={messages}
          viewportRef={viewportRef}
          onAddSuggestion={onAddSuggestion}
          isAdding={isAdding}
          decks={decks}
          currentDeckId={currentDeckId}
          onApplyEdit={onApplyEdit}
          onDismissEdit={onDismissEdit}
          savingEditId={savingEditId}
        />
      </Box>
      <AssistantComposer
        value={input}
        onChange={onInputChange}
        onSend={onSend}
        onStop={onStop}
        onClear={onClear}
        canClear={canClear}
        isStreaming={isStreaming}
      />
    </Stack>
  );
}

function DesktopAssistantShell({
  opened,
  onOpen,
  children,
}: {
  opened: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <Paper withBorder radius={0} h="100%" mih={0} p={opened ? 0 : "md"}>
      {opened ? (
        <Box h="100%" mih={0} p="md">
          {children}
        </Box>
      ) : (
        <Stack justify="center" gap="sm" h="100%" mih={0}>
          <Group gap="xs">
            <IconMessage size={18} />
            <Title order={5}>Study Assistant</Title>
          </Group>
          <Text c="dimmed">
            Keep the assistant open alongside your review.
          </Text>
          <Button
            onClick={onOpen}
            leftSection={<IconMessage size={16} />}
            variant="light"
          >
            Open Assistant
          </Button>
        </Stack>
      )}
    </Paper>
  );
}

function MobileAssistantShell({
  opened,
  onClose,
  children,
}: {
  opened: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="100%"
      overlayProps={{ opacity: 0.35, blur: 1 }}
      withCloseButton={false}
      styles={mobileDrawerStyles}
    >
      <Box flex={1} p="md" mih={0}>
        {children}
      </Box>
    </Drawer>
  );
}

function useAssistantChat({
  deckId,
  contextLog,
  currentCard,
  onCardEdited,
}: {
  deckId: number;
  contextLog: string[];
  currentCard?: AssistantCardContext;
  onCardEdited?: (
    cardId: number,
    updates: { term: string; definition: string },
  ) => void;
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>(
    createInitialMessages,
  );
  const [input, setInput] = React.useState("");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [savingEditId, setSavingEditId] = React.useState<string | null>(
    null,
  );
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const parserRef = React.useRef<ReturnType<
    typeof createAssistantStreamParser
  > | null>(null);
  const messagesRef = React.useRef<ChatMessage[]>(messages);
  const contextLogRef = React.useRef<string[]>(contextLog);
  const currentCardRef = React.useRef<AssistantCardContext | undefined>(
    currentCard,
  );
  const stopRequestedRef = React.useRef(false);
  const bulkCreate = trpc.bulkCreateCards.useMutation();
  const editCardMutation = trpc.editCard.useMutation();

  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  React.useEffect(() => {
    contextLogRef.current = contextLog;
  }, [contextLog]);

  React.useEffect(() => {
    currentCardRef.current = currentCard;
  }, [currentCard]);

  const scrollToBottom = React.useCallback(() => {
    const el = viewportRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const toSuggestion = (example: {
    phrase: string;
    translation: string;
  }): Suggestion => ({
    phrase: example.phrase,
    translation: example.translation,
    gender: "N",
  });

  const createEditProposal = React.useCallback(
    (draft: CardEditBlock): AssistantEditProposal | null => {
      const latestCard = currentCardRef.current;
      const resolvedCardId = draft.cardId ?? latestCard?.cardId;
      if (!resolvedCardId) {
        return null;
      }
      const targetCard =
        latestCard && resolvedCardId === latestCard.cardId
          ? latestCard
          : undefined;
      const resolvedTerm = draft.term?.trim() || targetCard?.term || "";
      const resolvedDefinition =
        draft.definition?.trim() || targetCard?.definition || "";
      if (!resolvedTerm && !resolvedDefinition) {
        return null;
      }
      return {
        id: createProposalId(resolvedCardId),
        cardId: resolvedCardId,
        term: resolvedTerm,
        definition: resolvedDefinition,
        note: draft.note,
        originalTerm: targetCard?.term,
        originalDefinition: targetCard?.definition,
      };
    },
    [],
  );

  const applyParsed = React.useCallback(
    (parsed: AssistantParserResult) => {
      if (
        !parsed.textDelta &&
        parsed.examples.length === 0 &&
        parsed.edits.length === 0
      ) {
        return;
      }
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant") {
          return prev;
        }
        const nextContent = parsed.textDelta
          ? collapseNewlines(`${last.content}${parsed.textDelta}`)
          : last.content;
        const nextSuggestions = parsed.examples.length
          ? [
              ...(last.suggestions ?? []),
              ...parsed.examples.map(toSuggestion),
            ]
          : last.suggestions;
        const newEdits = parsed.edits
          .map(createEditProposal)
          .filter((proposal): proposal is AssistantEditProposal =>
            Boolean(proposal),
          );
        const nextEdits = newEdits.length
          ? [...(last.edits ?? []), ...newEdits]
          : last.edits;

        const updated: ChatMessage = {
          ...last,
          content: nextContent,
          suggestions: nextSuggestions,
          edits: nextEdits,
        };
        return [...prev.slice(0, -1), updated];
      });
    },
    [createEditProposal],
  );

  const finalizeParser = React.useCallback(() => {
    const parser = parserRef.current;
    if (!parser) {
      return;
    }
    const parsed = parser.flush();
    parserRef.current = null;
    applyParsed(parsed);
  }, [applyParsed]);

  const resetStreamingState = React.useCallback(() => {
    abortRef.current = null;
    parserRef.current = null;
    stopRequestedRef.current = false;
  }, []);

  const stopStreaming = React.useCallback(() => {
    if (!isStreaming) {
      return;
    }
    stopRequestedRef.current = true;
    abortRef.current?.abort();
    setIsStreaming(false);
  }, [isStreaming]);

  const addSuggestion = React.useCallback(
    async (suggestion: Suggestion, targetDeckId: number) => {
      await bulkCreate.mutateAsync({
        deckId: targetDeckId,
        input: [
          {
            term: suggestion.phrase,
            definition: suggestion.translation,
            gender: suggestion.gender,
          },
        ],
      });
      notifications.show({
        title: "Added",
        message: "Card added to deck",
      });
    },
    [bulkCreate],
  );

  const removeEditProposal = React.useCallback((editId: string) => {
    setMessages((prev) =>
      prev.map((message) => {
        if (!message.edits || message.edits.length === 0) {
          return message;
        }
        const remaining = message.edits.filter(
          (proposal) => proposal.id !== editId,
        );
        if (remaining.length === message.edits.length) {
          return message;
        }
        const trimmedContent = stripEditPlaceholders(
          message.content,
          remaining.length,
        );
        return {
          ...message,
          content: trimmedContent,
          edits: remaining.length ? remaining : undefined,
        };
      }),
    );
  }, []);

  const applyEditProposal = React.useCallback(
    async (
      proposal: AssistantEditProposal,
      updates: { term: string; definition: string },
    ) => {
      const term = updates.term.trim();
      const definition = updates.definition.trim();
      setSavingEditId(proposal.id);
      try {
        await editCardMutation.mutateAsync({
          id: proposal.cardId,
          term,
          definition,
        });
        removeEditProposal(proposal.id);
        onCardEdited?.(proposal.cardId, { term, definition });
        notifications.show({
          title: "Card updated",
          message: "Changes saved to the card.",
        });
      } catch {
        notifications.show({
          title: "Assistant error",
          message: "Unable to update the card.",
          color: "red",
        });
      } finally {
        setSavingEditId(null);
      }
    },
    [editCardMutation, onCardEdited, removeEditProposal],
  );

  const sendMessage = React.useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) {
      return;
    }
    stopRequestedRef.current = false;
    setInput("");
    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [
      ...prev,
      userMsg,
      { role: "assistant", content: "" },
    ]);
    parserRef.current = createAssistantStreamParser();

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const payload = JSON.stringify({
      deckId,
      messages: [...messagesRef.current, userMsg],
      contextLog: contextLogRef.current,
      currentCard: currentCardRef.current,
    });

    const applyChunk = (chunk: string) => {
      const parser = parserRef.current ?? createAssistantStreamParser();
      parserRef.current = parser;
      const parsed = parser.push(chunk);
      applyParsed(parsed);
    };

    try {
      setIsStreaming(true);
      const res = await fetch("/api/study-assistant/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error("Failed to connect");
      }
      const reader = res.body.getReader();
      await readStream(reader, {
        onChunk: (chunk) => {
          applyChunk(chunk);
        },
        onDone: () => {
          finalizeParser();
          setIsStreaming(false);
        },
      });
    } catch {
      const abortedByUser =
        controller.signal.aborted && stopRequestedRef.current;
      finalizeParser();
      setIsStreaming(false);
      if (!abortedByUser) {
        notifications.show({
          title: "Assistant error",
          message: "Connection failed.",
          color: "red",
        });
      }
    } finally {
      resetStreamingState();
    }
  }, [
    applyParsed,
    deckId,
    finalizeParser,
    input,
    isStreaming,
    resetStreamingState,
  ]);

  const clearMessages = React.useCallback(() => {
    if (isStreaming) {
      return;
    }
    const initialMessages = createInitialMessages();
    messagesRef.current = initialMessages;
    setInput("");
    setMessages(initialMessages);
    setSavingEditId(null);
  }, [isStreaming]);

  return {
    messages,
    input,
    setInput,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearMessages,
    viewportRef,
    addSuggestion,
    isAddingSuggestion: bulkCreate.isLoading,
    onApplyEdit: applyEditProposal,
    onDismissEdit: removeEditProposal,
    savingEditId,
  };
}

function ReviewAssistantPane({
  deckId,
  decks,
  opened,
  onOpen,
  onClose,
  contextLog,
  currentCard,
  onCardEdited,
}: {
  deckId: number;
  decks: DeckSummary[];
  opened: boolean;
  onOpen: () => void;
  onClose: () => void;
  contextLog: string[];
  currentCard?: AssistantCardContext;
  onCardEdited?: (
    cardId: number,
    updates: { term: string; definition: string },
  ) => void;
}) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.md})`);
  const {
    messages,
    input,
    setInput,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearMessages,
    viewportRef,
    addSuggestion,
    isAddingSuggestion,
    onApplyEdit,
    onDismissEdit,
    savingEditId,
  } = useAssistantChat({
    deckId,
    contextLog,
    currentCard,
    onCardEdited,
  });

  const handleClose = React.useCallback(() => {
    stopStreaming();
    onClose();
  }, [onClose, stopStreaming]);

  const canClear = messages.length > 1 || input.trim() !== "";

  const panel = (
    <AssistantPanel
      messages={messages}
      input={input}
      onInputChange={setInput}
      onSend={sendMessage}
      onStop={stopStreaming}
      onClear={clearMessages}
      canClear={canClear}
      isStreaming={isStreaming}
      viewportRef={viewportRef}
      onAddSuggestion={addSuggestion}
      isAdding={isAddingSuggestion}
      decks={decks}
      currentDeckId={deckId}
      onClose={handleClose}
      onApplyEdit={onApplyEdit}
      onDismissEdit={onDismissEdit}
      savingEditId={savingEditId}
    />
  );

  if (isMobile) {
    return (
      <MobileAssistantShell opened={opened} onClose={handleClose}>
        {panel}
      </MobileAssistantShell>
    );
  }

  return (
    <DesktopAssistantShell opened={opened} onOpen={onOpen}>
      {panel}
    </DesktopAssistantShell>
  );
}

const collapseNewlines = (value: string) =>
  value.replace(/\n{3,}/g, "\n\n");

const stripEditPlaceholders = (content: string, keep: number) => {
  let updated = content;
  const placeholderCount = updated.split(EDIT_PLACEHOLDER).length - 1;
  let excess = placeholderCount - keep;
  while (excess > 0) {
    updated = updated.replace(EDIT_PLACEHOLDER, "");
    excess -= 1;
  }
  return collapseNewlines(updated);
};

async function readStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: StreamHandlers,
) {
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  while (!finished) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const chunk of parts) {
      let event: string | null = null;
      const dataLines: string[] = [];
      chunk.split("\n").forEach((line) => {
        if (line.startsWith("event:")) {
          event = line.slice(6).trim();
          return;
        }
        if (line.startsWith("data:")) {
          const valueLine = line.slice(5).replace(/^ /, "");
          dataLines.push(valueLine);
        }
      });
      const payload = dataLines.join("\n");
      if (event === "done") {
        handlers.onDone();
        finished = true;
        break;
      }
      handlers.onChunk(payload);
    }
  }

  if (!finished) {
    handlers.onDone();
  }
}

const createProposalId = (cardId: number) =>
  `edit-${cardId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createInitialMessages = (): ChatMessage[] => [
  {
    role: "assistant",
    content: INITIAL_ASSISTANT_MESSAGE,
  },
];

function buildAssistantCardContext(
  card?: Quiz,
): AssistantCardContext | undefined {
  if (!card) {
    return undefined;
  }
  return {
    cardId: card.cardId,
    term: card.term,
    definition: card.definition,
    uuid: card.uuid,
  };
}

function InnerReviewPage({ deckId, decks }: ReviewDeckPageProps) {
  const layout = useReviewLayout();
  const { addContextEvent, contextLog } = useStudyAssistantContext();
  const {
    state,
    isFetching,
    error,
    currentItem,
    skipCard,
    giveUp,
    completeItem,
    refetchQuizzes,
    onGradingResultCaptured: captureGradingResult,
    progress,
    cardsRemaining,
    updateCardFields,
  } = useReview(deckId);
  const userSettings = useUserSettings();
  const card = currentItem ? state.cards[currentItem.cardUUID] : undefined;
  const assistantCardContext = React.useMemo(
    () => buildAssistantCardContext(card),
    [card?.cardId, card?.definition, card?.term, card?.uuid],
  );

  const {
    handleGradingResultCaptured,
    handleSkipCard,
    handleGiveUp,
    handleAssistantCardEdited,
  } = useReviewHandlers({
    state,
    addContextEvent,
    skipCard,
    giveUp,
    captureGradingResult,
    updateCardFields,
  });

  const playCard = useReviewAudio({
    card,
    itemType: currentItem?.itemType,
    playbackSpeed: userSettings.playbackSpeed,
  });

  useReviewContextLogger({ card, currentItem, addContextEvent });
  useAutoPlayCard(currentItem, playCard);

  if (error) {
    return <MessageState title="Error">{error.message}</MessageState>;
  }
  if (isFetching) {
    return (
      <MessageState title="Loading">Fetching quizzes...</MessageState>
    );
  }
  if (!currentItem) {
    return (
      <NoMoreQuizzesState deckId={deckId} onReload={refetchQuizzes} />
    );
  }

  if (!card) {
    return <MessageState title="Oops">No card data.</MessageState>;
  }

  const assistantProps = {
    deckId,
    decks,
    opened: layout.assistantOpen,
    onOpen: layout.openAssistant,
    onClose: layout.closeAssistant,
    contextLog,
    currentCard: assistantCardContext,
    onCardEdited: handleAssistantCardEdited,
  };

  return (
    <Container fluid px={0} py={0}>
      <ReviewLayout
        contentHeight={layout.contentHeight}
        showAssistant={layout.showDesktopAssistant}
        assistant={<ReviewAssistantPane {...assistantProps} />}
      >
        <Box h="100%" mih={0}>
          <CardReview
            card={card}
            itemType={currentItem.itemType}
            onSkip={handleSkipCard}
            onGiveUp={handleGiveUp}
            onProceed={() => completeItem(currentItem.stepUuid)}
            onPlayAudio={playCard}
            currentStepUuid={currentItem.stepUuid}
            completeItem={completeItem}
            onGradingResultCaptured={handleGradingResultCaptured}
            progress={progress}
            cardsRemaining={cardsRemaining}
            onOpenAssistant={layout.openAssistant}
            assistantOffsetRight={layout.assistantOffset}
            disableRecord={Boolean(
              state.gradingResults[currentItem.cardUUID]?.isCorrect,
            )}
          />
        </Box>
      </ReviewLayout>
      {!layout.isDesktop && <ReviewAssistantPane {...assistantProps} />}
    </Container>
  );
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

  const hasDue = (await getLessonsDue(deck.id)) >= 1;
  const canStartNew = await canStartNewLessons(
    user.id,
    deck.id,
    Date.now(),
  );
  if (!hasDue && !canStartNew) {
    return redirect("/review");
  }

  if (userSettings.writingFirst) {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
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
          destination: buildWritingPracticeUrl(buildReviewPath(deckId)),
          permanent: false,
        },
      };
    }
  }

  const decks = await prismaClient.deck.findMany({
    where: { userId: user.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return {
    props: {
      deckId,
      decks,
    },
  };
};

export default function ReviewDeckPageWrapper(props: ReviewDeckPageProps) {
  return (
    <StudyAssistantContextProvider>
      <InnerReviewPage {...props} />
    </StudyAssistantContextProvider>
  );
}
