import { prismaClient } from "@/koala/prisma-client";
import {
  ReaderPageFrame,
  ReaderPageHeader,
  ReaderPanel,
} from "@/koala/reader/ui/layout";
import {
  formatReaderDateTime,
  readerBodyFont,
  readerDisplayFont,
  readerHeadingColor,
  readerIngestLabel,
  readerIngestTone,
} from "@/koala/reader/ui/theme";
import {
  Anchor,
  Badge,
  Button,
  Group,
  Progress,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import type {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from "next";
import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";

type ReaderInputKind = "url" | "raw";

type PublicReaderArticle = {
  publicId: string;
  title: string;
  normalizedUrl: string | null;
  inputKind: ReaderInputKind;
  contentText: string;
  ingestStatus: "pending" | "in_progress" | "ready" | "error";
  ingestError: string;
  createdAt: string;
};

type TypingStatus = "idle" | "in_progress" | "finished";

type PromptTokenState = "pending" | "correct" | "incorrect" | "current";

type PromptToken = {
  id: number;
  value: string;
  state: PromptTokenState;
};

type PromptWindow = {
  tokens: PromptToken[];
  hasPrefix: boolean;
  hasSuffix: boolean;
};

type TypingMetrics = {
  correctChars: number;
  mistakes: number;
  accuracy: number;
  wordsPerMinute: number;
  progress: number;
};

const PROMPT_MAX_CHARACTERS = 2200;
const PROMPT_WINDOW_BEFORE = 56;
const PROMPT_WINDOW_AFTER = 300;

const typingPromptContainerStyle: React.CSSProperties = {
  borderRadius: 16,
  border: "1px solid #efdae6",
  background:
    "linear-gradient(150deg, rgba(255, 253, 255, 0.97) 0%, rgba(255, 244, 250, 0.88) 100%)",
  padding: "clamp(12px, 1.6vw, 18px)",
};

const typingPromptTextStyle: React.CSSProperties = {
  fontFamily: readerDisplayFont,
  color: "#4f3342",
  lineHeight: 1.95,
  letterSpacing: "0.01em",
  fontSize: "clamp(1rem, 1.2vw, 1.08rem)",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

function mapIngestStatus(
  status: "PENDING" | "IN_PROGRESS" | "READY" | "ERROR",
): PublicReaderArticle["ingestStatus"] {
  if (status === "PENDING") {
    return "pending";
  }

  if (status === "IN_PROGRESS") {
    return "in_progress";
  }

  if (status === "READY") {
    return "ready";
  }

  return "error";
}

function mapInputKind(value: "URL" | "RAW"): ReaderInputKind {
  if (value === "RAW") {
    return "raw";
  }

  return "url";
}

function pendingMessage(status: "pending" | "in_progress"): string {
  if (status === "pending") {
    return "This article is queued for processing.";
  }

  return "This article is currently being processed.";
}

function normalizeLineBreaks(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function stripMarkdownSyntax(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_~]/g, " ");
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildTypingPrompt(
  contentText: string,
  inputKind: ReaderInputKind,
): string {
  const normalized = normalizeLineBreaks(contentText);
  if (!normalized) {
    return "";
  }

  const unformattedText =
    inputKind === "url" ? stripMarkdownSyntax(normalized) : normalized;
  const promptText = collapseWhitespace(unformattedText);

  return promptText.slice(0, PROMPT_MAX_CHARACTERS);
}

function sanitizeTypedText(value: string, maxLength: number): string {
  return value.replace(/\r?\n/g, " ").slice(0, maxLength);
}

function countCorrectChars(prompt: string, typed: string): number {
  const compareLength = Math.min(prompt.length, typed.length);
  let correct = 0;

  for (let index = 0; index < compareLength; index += 1) {
    if (prompt[index] === typed[index]) {
      correct += 1;
    }
  }

  return correct;
}

function resolveTypingStatus(
  startedAt: number | null,
  finishedAt: number | null,
  typedChars: number,
  promptChars: number,
): TypingStatus {
  if (finishedAt) {
    return "finished";
  }

  if (!startedAt || typedChars === 0 || promptChars === 0) {
    return "idle";
  }

  return "in_progress";
}

function computeElapsedMs(
  status: TypingStatus,
  startedAt: number | null,
  finishedAt: number | null,
  nowMs: number,
): number {
  if (!startedAt || status === "idle") {
    return 0;
  }

  if (status === "finished" && finishedAt) {
    return Math.max(finishedAt - startedAt, 1);
  }

  return Math.max(nowMs - startedAt, 1);
}

function formatTimer(elapsedMs: number): string {
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function toPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return (numerator / denominator) * 100;
}

function calculateTypingMetrics(
  promptText: string,
  typedText: string,
  elapsedMs: number,
): TypingMetrics {
  const correctChars = countCorrectChars(promptText, typedText);
  const mistakes = Math.max(typedText.length - correctChars, 0);
  const accuracyBase = typedText.length > 0 ? typedText.length : 1;
  const accuracy = toPercent(correctChars, accuracyBase);
  const minutes = elapsedMs / 60000;
  const wordsPerMinute = minutes > 0 ? correctChars / 5 / minutes : 0;
  const progress = toPercent(typedText.length, promptText.length);

  return {
    correctChars,
    mistakes,
    accuracy,
    wordsPerMinute,
    progress,
  };
}

function buildPromptWindow(
  promptText: string,
  typedText: string,
): PromptWindow {
  if (!promptText) {
    return {
      tokens: [],
      hasPrefix: false,
      hasSuffix: false,
    };
  }

  const cursorIndex = Math.min(typedText.length, promptText.length);
  const start = Math.max(cursorIndex - PROMPT_WINDOW_BEFORE, 0);
  const end = Math.min(
    cursorIndex + PROMPT_WINDOW_AFTER,
    promptText.length,
  );
  const tokens: PromptToken[] = [];

  for (let index = start; index < end; index += 1) {
    let state: PromptTokenState = "pending";

    if (index < typedText.length) {
      state =
        promptText[index] === typedText[index] ? "correct" : "incorrect";
    }

    if (
      index >= typedText.length &&
      index === cursorIndex &&
      cursorIndex < promptText.length
    ) {
      state = "current";
    }

    const char = promptText[index];
    tokens.push({
      id: index,
      value: char === " " ? "\u00A0" : char,
      state,
    });
  }

  return {
    tokens,
    hasPrefix: start > 0,
    hasSuffix: end < promptText.length,
  };
}

function tokenStyle(state: PromptTokenState): React.CSSProperties {
  if (state === "correct") {
    return {
      color: "#2e8f63",
      backgroundColor: "rgba(144, 230, 187, 0.2)",
      borderRadius: 4,
    };
  }

  if (state === "incorrect") {
    return {
      color: "#c54268",
      backgroundColor: "rgba(251, 177, 200, 0.32)",
      borderRadius: 4,
    };
  }

  if (state === "current") {
    return {
      color: "#4f3241",
      backgroundColor: "rgba(255, 214, 233, 0.55)",
      borderRadius: 4,
      boxShadow: "inset 0 -2px 0 #c54268",
    };
  }

  return {
    color: "#8e6f7d",
  };
}

function statusTitle(status: TypingStatus): string {
  if (status === "finished") {
    return "Run complete";
  }

  if (status === "in_progress") {
    return "Typing now";
  }

  return "Ready to begin";
}

type TypingHeaderCardProps = {
  article: PublicReaderArticle;
  status: TypingStatus;
};

function TypingHeaderCard({ article, status }: TypingHeaderCardProps) {
  const ingestLabel = readerIngestLabel(article.ingestStatus);
  const ingestTone = readerIngestTone(article.ingestStatus);

  return (
    <ReaderPanel>
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Group gap="sm" wrap="wrap">
          <Anchor
            component={Link}
            href={`/reader/${article.publicId}`}
            size="sm"
          >
            ← Reading view
          </Anchor>
          <Anchor component={Link} href="/reader" size="sm">
            Reader Home
          </Anchor>
        </Group>
        {article.normalizedUrl && (
          <Anchor
            href={article.normalizedUrl}
            target="_blank"
            rel="noreferrer"
            size="sm"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Source
            <IconExternalLink size={14} stroke={1.8} />
          </Anchor>
        )}
      </Group>
      <Stack gap={8}>
        <Text
          style={{
            fontFamily: readerDisplayFont,
            color: readerHeadingColor,
            fontWeight: 700,
            lineHeight: 1.25,
            fontSize: "clamp(1.35rem, 3vw, 1.9rem)",
          }}
        >
          {article.title}
        </Text>
        <Group gap={6} wrap="wrap">
          <Badge variant="light" color={ingestTone}>
            {ingestLabel}
          </Badge>
          <Badge variant="light" color="pink">
            {statusTitle(status)}
          </Badge>
          <Text
            size="xs"
            c="dimmed"
            style={{ fontFamily: readerBodyFont }}
          >
            Added {formatReaderDateTime(new Date(article.createdAt))}
          </Text>
        </Group>
      </Stack>
    </ReaderPanel>
  );
}

type TypingStatsPanelProps = {
  elapsedMs: number;
  metrics: TypingMetrics;
  typedChars: number;
  promptChars: number;
};

function TypingStatsPanel({
  elapsedMs,
  metrics,
  typedChars,
  promptChars,
}: TypingStatsPanelProps) {
  const progress = Math.min(Math.max(metrics.progress, 0), 100);

  return (
    <ReaderPanel>
      <Group
        justify="space-between"
        align="flex-start"
        wrap="wrap"
        gap="md"
      >
        <Group gap="xs" wrap="wrap">
          <Badge size="lg" variant="light" color="teal">
            {metrics.wordsPerMinute.toFixed(1)} WPM
          </Badge>
          <Badge size="lg" variant="light" color="grape">
            {metrics.accuracy.toFixed(1)}% accuracy
          </Badge>
          <Badge size="lg" variant="light" color="pink">
            {formatTimer(elapsedMs)}
          </Badge>
        </Group>
        <Text
          size="sm"
          style={{
            fontFamily: readerBodyFont,
            color: "#684b58",
          }}
        >
          {typedChars} / {promptChars} chars · {metrics.correctChars}{" "}
          correct · {metrics.mistakes} mistakes
        </Text>
      </Group>
      <Progress
        value={progress}
        color="grape"
        radius="xl"
        size="md"
        aria-label="Typing progress"
      />
    </ReaderPanel>
  );
}

type TypingPromptPanelProps = {
  promptWindow: PromptWindow;
};

function TypingPromptPanel({ promptWindow }: TypingPromptPanelProps) {
  if (promptWindow.tokens.length === 0) {
    return (
      <ReaderPanel>
        <Text size="sm" c="dimmed">
          There is no prepared text available for typing.
        </Text>
      </ReaderPanel>
    );
  }

  return (
    <ReaderPanel>
      <Stack gap={8}>
        <Text
          size="sm"
          style={{
            fontFamily: readerBodyFont,
            color: "#73505f",
          }}
        >
          Match the highlighted passage exactly, including punctuation.
        </Text>
        <div style={typingPromptContainerStyle} aria-live="polite">
          <Text component="div" style={typingPromptTextStyle}>
            {promptWindow.hasPrefix && (
              <Text component="span" c="dimmed">
                …{" "}
              </Text>
            )}
            {promptWindow.tokens.map((token) => (
              <Text
                key={token.id}
                component="span"
                style={tokenStyle(token.state)}
              >
                {token.value}
              </Text>
            ))}
            {promptWindow.hasSuffix && (
              <Text component="span" c="dimmed">
                {" "}
                …
              </Text>
            )}
          </Text>
        </div>
      </Stack>
    </ReaderPanel>
  );
}

type TypingInputPanelProps = {
  value: string;
  disabled: boolean;
  onChange: (nextValue: string) => void;
  onRestart: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
};

function TypingInputPanel({
  value,
  disabled,
  onChange,
  onRestart,
  inputRef,
}: TypingInputPanelProps) {
  return (
    <ReaderPanel>
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <Stack gap={2}>
          <Text
            size="sm"
            style={{ fontFamily: readerBodyFont, color: "#6b4f5d" }}
          >
            Type in this box to start. Backspace and edits are allowed.
          </Text>
        </Stack>
        <Button variant="light" color="pink" onClick={onRestart}>
          Restart run
        </Button>
      </Group>
      <Textarea
        ref={inputRef}
        label="Typing input"
        autosize
        minRows={5}
        maxRows={10}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={disabled}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="Start typing the passage here..."
        styles={{
          input: {
            fontFamily: readerBodyFont,
            lineHeight: 1.75,
            fontSize: "1rem",
          },
          label: {
            fontFamily: readerBodyFont,
            color: readerHeadingColor,
          },
        }}
      />
    </ReaderPanel>
  );
}

function ProcessingPanel({
  status,
  ingestError,
}: {
  status: PublicReaderArticle["ingestStatus"];
  ingestError: string;
}) {
  if (status === "error") {
    return (
      <ReaderPanel>
        <Text c="red" fw={700}>
          This article could not be prepared.
        </Text>
        {ingestError.trim().length > 0 && (
          <Text size="sm" c="red">
            {ingestError}
          </Text>
        )}
        <Text size="sm" c="dimmed">
          Open the source article and try adding it again.
        </Text>
      </ReaderPanel>
    );
  }

  if (status === "pending" || status === "in_progress") {
    return (
      <ReaderPanel>
        <Text c="dimmed">{pendingMessage(status)}</Text>
        <Text size="sm" c="dimmed">
          Refresh in a few seconds and start typing once this is marked
          ready.
        </Text>
      </ReaderPanel>
    );
  }

  return null;
}

type CompletionPanelProps = {
  onRestart: () => void;
};

function CompletionPanel({ onRestart }: CompletionPanelProps) {
  return (
    <ReaderPanel>
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Stack gap={2}>
          <Text
            style={{
              fontFamily: readerDisplayFont,
              color: readerHeadingColor,
              fontWeight: 700,
              fontSize: "1.1rem",
            }}
          >
            Complete
          </Text>
          <Text
            size="sm"
            style={{ fontFamily: readerBodyFont, color: "#735160" }}
          >
            Nice run. Restart to practice the same passage again.
          </Text>
        </Stack>
        <Button onClick={onRestart} color="grape" variant="filled">
          Type again
        </Button>
      </Group>
    </ReaderPanel>
  );
}

export default function ReaderTypingPage({
  article,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const promptText = useMemo(
    () => buildTypingPrompt(article.contentText, article.inputKind),
    [article.contentText, article.inputKind],
  );
  const [typedText, setTypedText] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const typingStatus = resolveTypingStatus(
    startedAt,
    finishedAt,
    typedText.length,
    promptText.length,
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (typingStatus !== "in_progress") {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [typingStatus]);

  const elapsedMs = computeElapsedMs(
    typingStatus,
    startedAt,
    finishedAt,
    nowMs,
  );
  const metrics = useMemo(
    () => calculateTypingMetrics(promptText, typedText, elapsedMs),
    [promptText, typedText, elapsedMs],
  );
  const promptWindow = useMemo(
    () => buildPromptWindow(promptText, typedText),
    [promptText, typedText],
  );

  const isReady = article.ingestStatus === "ready";
  const hasPrompt = promptText.length > 0;
  const canType = isReady && hasPrompt;
  const inputDisabled = !canType || typingStatus === "finished";

  const handleInputChange = (nextValue: string) => {
    if (!canType) {
      return;
    }

    const nextTyped = sanitizeTypedText(nextValue, promptText.length);
    const hasInput = nextTyped.length > 0;
    if (!hasInput) {
      setTypedText("");
      setStartedAt(null);
      setFinishedAt(null);
      return;
    }

    if (!startedAt) {
      setStartedAt(Date.now());
    }

    setTypedText(nextTyped);
    const reachedEnd = nextTyped.length >= promptText.length;
    if (reachedEnd && !finishedAt) {
      setFinishedAt(Date.now());
      return;
    }

    if (!reachedEnd && finishedAt) {
      setFinishedAt(null);
    }
  };

  const handleRestart = () => {
    setTypedText("");
    setStartedAt(null);
    setFinishedAt(null);
    setNowMs(Date.now());
    inputRef.current?.focus();
  };

  return (
    <ReaderPageFrame>
      <ReaderPageHeader
        title="Typing Practice"
        subtitle="Prototype mode: race through this article passage and watch your speed, accuracy, and progress."
      />
      <TypingHeaderCard article={article} status={typingStatus} />
      {!isReady && (
        <ProcessingPanel
          status={article.ingestStatus}
          ingestError={article.ingestError}
        />
      )}
      {isReady && !hasPrompt && (
        <ReaderPanel>
          <Text size="sm" c="dimmed">
            No text is available for typing in this article.
          </Text>
        </ReaderPanel>
      )}
      {canType && (
        <>
          <TypingStatsPanel
            elapsedMs={elapsedMs}
            metrics={metrics}
            typedChars={typedText.length}
            promptChars={promptText.length}
          />
          <TypingPromptPanel promptWindow={promptWindow} />
          <TypingInputPanel
            value={typedText}
            disabled={inputDisabled}
            onChange={handleInputChange}
            onRestart={handleRestart}
            inputRef={inputRef}
          />
          {typingStatus === "finished" && (
            <CompletionPanel onRestart={handleRestart} />
          )}
        </>
      )}
    </ReaderPageFrame>
  );
}

export async function getServerSideProps(
  context: GetServerSidePropsContext,
) {
  const publicId = context.params?.publicId;
  if (typeof publicId !== "string" || publicId.trim().length === 0) {
    return { notFound: true };
  }

  const article = await prismaClient.readerArticle.findUnique({
    where: { publicId },
    select: {
      publicId: true,
      title: true,
      normalizedUrl: true,
      inputKind: true,
      contentText: true,
      ingestStatus: true,
      ingestError: true,
      createdAt: true,
    },
  });

  if (!article) {
    return { notFound: true };
  }

  const payload: PublicReaderArticle = {
    publicId: article.publicId,
    title: article.title,
    normalizedUrl: article.normalizedUrl,
    inputKind: mapInputKind(article.inputKind),
    contentText: article.contentText,
    ingestStatus: mapIngestStatus(article.ingestStatus),
    ingestError: article.ingestError,
    createdAt: article.createdAt.toISOString(),
  };

  return {
    props: {
      article: payload,
    },
  };
}
