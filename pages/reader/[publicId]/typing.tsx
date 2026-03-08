import { prismaClient } from "@/koala/prisma-client";
import {
  ReaderPageFrame,
  ReaderPageHeader,
  ReaderPanel,
} from "@/koala/reader/ui/layout";
import {
  formatReaderDateTime,
  readerAccentColor,
  readerAccentStrongColor,
  readerBodyFont,
  readerDisplayFont,
  readerErrorColor,
  readerHeadingColor,
  readerMutedColor,
  readerPanelBorderColor,
  readerSuccessColor,
  readerSurfaceBackgroundColor,
  readerSurfaceShadow,
  readerWarningColor,
} from "@/koala/reader/ui/theme";
import {
  Anchor,
  Button,
  Group,
  Progress,
  Stack,
  Switch,
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
  wordsPerMinute: number;
  progress: number;
};

const PROMPT_MAX_CHARACTERS = 2200;
const PROMPT_WINDOW_BEFORE = 56;
const PROMPT_WINDOW_AFTER = 300;

const typingPromptContainerStyle: React.CSSProperties = {
  borderRadius: 16,
  border: `1px solid ${readerPanelBorderColor}`,
  backgroundColor: readerSurfaceBackgroundColor,
  boxShadow: readerSurfaceShadow,
  padding: "clamp(12px, 1.6vw, 18px)",
};

const typingPromptTextStyle: React.CSSProperties = {
  fontFamily: readerDisplayFont,
  color: readerHeadingColor,
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
    return "This article is in line to be prepared.";
  }

  return "This article is being prepared now.";
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

function splitLineIntoSentences(line: string): string[] {
  const matches = line.match(/[^.!?。！？]+[.!?。！？]?/g);
  if (!matches) {
    return [];
  }

  return matches
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function splitPromptChunks(value: string): string[] {
  const lines = value.split("\n");
  const chunks: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    const sentences = splitLineIntoSentences(trimmedLine);
    if (sentences.length > 0) {
      chunks.push(...sentences);
      continue;
    }

    chunks.push(trimmedLine);
  }

  return chunks;
}

function shuffleTextChunks(chunks: string[]): string[] {
  const shuffled = [...chunks];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = current;
  }

  return shuffled;
}

function buildTypingPrompt(
  contentText: string,
  inputKind: ReaderInputKind,
  shuffleSentences: boolean,
): string {
  const normalized = normalizeLineBreaks(contentText);
  if (!normalized) {
    return "";
  }

  const unformattedText =
    inputKind === "url" ? stripMarkdownSyntax(normalized) : normalized;
  const chunks = splitPromptChunks(unformattedText);
  if (chunks.length === 0) {
    return "";
  }

  const promptChunks = shuffleSentences
    ? shuffleTextChunks(chunks)
    : chunks;
  const promptText = collapseWhitespace(promptChunks.join(" "));

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
  typedChars: number,
  promptChars: number,
): TypingStatus {
  if (typedChars === 0 || promptChars === 0) {
    return "idle";
  }

  if (typedChars >= promptChars) {
    return "finished";
  }

  return "in_progress";
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
  const minutes = elapsedMs / 60000;
  const wordsPerMinute = minutes > 0 ? correctChars / 5 / minutes : 0;
  const progress = toPercent(typedText.length, promptText.length);

  return {
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
      color: readerSuccessColor,
      backgroundColor: "rgba(144, 230, 187, 0.2)",
      borderRadius: 4,
    };
  }

  if (state === "incorrect") {
    return {
      color: readerErrorColor,
      backgroundColor: "rgba(251, 177, 200, 0.32)",
      borderRadius: 4,
    };
  }

  if (state === "current") {
    return {
      color: readerHeadingColor,
      backgroundColor: "rgba(255, 214, 233, 0.55)",
      borderRadius: 4,
      boxShadow: `inset 0 -2px 0 ${readerAccentColor}`,
    };
  }

  return {
    color: readerMutedColor,
  };
}

function typingFocusLabel(
  typingStatus: TypingStatus,
  isInputFocused: boolean,
): string {
  if (typingStatus === "finished") {
    return "Completed";
  }

  if (typingStatus === "in_progress" && isInputFocused) {
    return "Typing";
  }

  if (typingStatus === "in_progress") {
    return "Paused";
  }

  return "Ready";
}

function typingFocusColor(
  typingStatus: TypingStatus,
  isInputFocused: boolean,
): string {
  if (typingStatus === "finished") {
    return readerAccentStrongColor;
  }

  if (typingStatus === "in_progress" && isInputFocused) {
    return readerSuccessColor;
  }

  if (typingStatus === "in_progress") {
    return readerWarningColor;
  }

  return readerMutedColor;
}

type TypingStagePanelProps = {
  article: PublicReaderArticle;
  value: string;
  disabled: boolean;
  shuffleSentences: boolean;
  elapsedMs: number;
  metrics: TypingMetrics;
  typedChars: number;
  promptChars: number;
  typingStatus: TypingStatus;
  isInputFocused: boolean;
  promptWindow: PromptWindow;
  onChange: (nextValue: string) => void;
  onShuffleSentencesChange: (nextValue: boolean) => void;
  onRestart: () => void;
  onFocus: () => void;
  onBlur: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
};

function TypingStagePanel({
  article,
  value,
  disabled,
  shuffleSentences,
  elapsedMs,
  metrics,
  typedChars,
  promptChars,
  typingStatus,
  isInputFocused,
  promptWindow,
  onChange,
  onShuffleSentencesChange,
  onRestart,
  onFocus,
  onBlur,
  inputRef,
}: TypingStagePanelProps) {
  const progress = Math.min(Math.max(metrics.progress, 0), 100);
  const hasStarted = typedChars > 0;
  const focusLabel = typingFocusLabel(typingStatus, isInputFocused);
  const focusColor = typingFocusColor(typingStatus, isInputFocused);

  return (
    <ReaderPanel>
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Anchor
          component={Link}
          href={`/reader/${article.publicId}`}
          size="sm"
        >
          ← Back to article
        </Anchor>
        <Group gap="xs" wrap="wrap">
          <Text
            size="xs"
            style={{ fontFamily: readerBodyFont, color: readerMutedColor }}
          >
            Added {formatReaderDateTime(new Date(article.createdAt))}
          </Text>
          {article.normalizedUrl && (
            <Anchor
              href={article.normalizedUrl}
              target="_blank"
              rel="noreferrer"
              size="xs"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Source
              <IconExternalLink size={13} stroke={1.8} />
            </Anchor>
          )}
        </Group>
      </Group>
      <Stack gap={10}>
        <Text
          style={{
            fontFamily: readerDisplayFont,
            color: readerHeadingColor,
            fontWeight: 700,
            lineHeight: 1.25,
            fontSize: "clamp(1.25rem, 2.5vw, 1.7rem)",
          }}
        >
          {article.title}
        </Text>
        <Group justify="space-between" align="center" wrap="wrap" gap="xs">
          <Text
            size="sm"
            style={{
              fontFamily: readerBodyFont,
              fontWeight: 700,
              color: focusColor,
            }}
          >
            {focusLabel}
          </Text>
          {hasStarted && (
            <Text
              size="sm"
              style={{
                fontFamily: readerBodyFont,
                color: readerMutedColor,
              }}
            >
              {formatTimer(elapsedMs)} · {typedChars}/{promptChars} chars ·{" "}
              {metrics.wordsPerMinute.toFixed(1)} WPM
            </Text>
          )}
        </Group>
        <Progress
          value={progress}
          color="grape"
          radius="xl"
          size="sm"
          aria-label="Typing progress"
        />
      </Stack>
      <Text
        size="sm"
        style={{ fontFamily: readerBodyFont, color: readerMutedColor }}
      >
        Read each phrase for meaning, then type it exactly.
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
      <Textarea
        ref={inputRef}
        label="Type the passage"
        autosize
        minRows={6}
        maxRows={12}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={disabled}
        onFocus={onFocus}
        onBlur={onBlur}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="Start typing here..."
        styles={{
          input: {
            fontFamily: readerBodyFont,
            lineHeight: 1.8,
            fontSize: "1rem",
          },
          label: {
            fontFamily: readerBodyFont,
            color: readerHeadingColor,
          },
        }}
      />
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Switch
          checked={shuffleSentences}
          onChange={(event) =>
            onShuffleSentencesChange(event.currentTarget.checked)
          }
          label="Shuffle sentences"
          size="md"
          color="grape"
          styles={{
            label: {
              fontFamily: readerBodyFont,
              color: readerMutedColor,
            },
          }}
        />
        <Button variant="light" color="pink" onClick={onRestart}>
          Restart
        </Button>
      </Group>
    </ReaderPanel>
  );
}

function ProcessingPanel({
  status,
  ingestError,
  publicId,
  normalizedUrl,
}: {
  status: PublicReaderArticle["ingestStatus"];
  ingestError: string;
  publicId: string;
  normalizedUrl: string | null;
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
        <Group gap="sm" wrap="wrap">
          <Anchor component={Link} href={`/reader/${publicId}`} size="sm">
            Open reading view
          </Anchor>
          <Anchor component={Link} href="/reader" size="sm">
            Back to Reader
          </Anchor>
          {normalizedUrl && (
            <Anchor
              href={normalizedUrl}
              target="_blank"
              rel="noreferrer"
              size="sm"
            >
              Open source
            </Anchor>
          )}
        </Group>
      </ReaderPanel>
    );
  }

  if (status === "pending" || status === "in_progress") {
    return (
      <ReaderPanel>
        <Text c="dimmed">{pendingMessage(status)}</Text>
        <Group gap="sm" wrap="wrap">
          <Anchor component={Link} href={`/reader/${publicId}`} size="sm">
            Open reading view
          </Anchor>
          <Anchor component={Link} href="/reader" size="sm">
            Back to Reader
          </Anchor>
        </Group>
      </ReaderPanel>
    );
  }

  return null;
}

type CompletionPanelProps = {
  publicId: string;
  reflectionText: string;
  onReflectionChange: (nextValue: string) => void;
  onRestart: () => void;
};

function CompletionPanel({
  publicId,
  reflectionText,
  onReflectionChange,
  onRestart,
}: CompletionPanelProps) {
  const reflectionWordCount = reflectionText.trim().length
    ? reflectionText.trim().split(/\s+/).length
    : 0;

  return (
    <ReaderPanel>
      <Text
        style={{
          fontFamily: readerDisplayFont,
          color: readerHeadingColor,
          fontWeight: 700,
          fontSize: "1.1rem",
        }}
      >
        Comprehension Check
      </Text>
      <Text
        size="sm"
        style={{ fontFamily: readerBodyFont, color: readerMutedColor }}
      >
        Without looking back, write a one-sentence summary of what you
        typed.
      </Text>
      <Textarea
        label="Your takeaway"
        value={reflectionText}
        onChange={(event) => onReflectionChange(event.currentTarget.value)}
        minRows={3}
        autosize
        placeholder="This passage is mainly about..."
        styles={{
          input: {
            fontFamily: readerBodyFont,
            lineHeight: 1.7,
            fontSize: "0.98rem",
          },
          label: {
            fontFamily: readerBodyFont,
            color: readerHeadingColor,
          },
        }}
      />
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Text
          size="xs"
          style={{ fontFamily: readerBodyFont, color: readerMutedColor }}
        >
          {reflectionWordCount} words
        </Text>
        <Group gap="sm" wrap="wrap">
          <Anchor component={Link} href={`/reader/${publicId}`} size="sm">
            Back to article
          </Anchor>
          <Button onClick={onRestart} color="grape" variant="filled">
            Type again
          </Button>
        </Group>
      </Group>
    </ReaderPanel>
  );
}

export default function ReaderTypingPage({
  article,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const [shuffleSentences, setShuffleSentences] = useState(false);
  const [shuffleNonce, setShuffleNonce] = useState(0);
  const promptText = useMemo(
    () =>
      buildTypingPrompt(
        article.contentText,
        article.inputKind,
        shuffleSentences,
      ),
    [
      article.contentText,
      article.inputKind,
      shuffleSentences,
      shuffleNonce,
    ],
  );
  const [typedText, setTypedText] = useState("");
  const [reflectionText, setReflectionText] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const typingStatus = resolveTypingStatus(
    typedText.length,
    promptText.length,
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

  useEffect(() => {
    if (typingStatus !== "in_progress" || !isInputFocused) {
      return;
    }

    let lastTickAt = Date.now();
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const deltaMs = now - lastTickAt;
      lastTickAt = now;
      setElapsedMs((previous) => previous + deltaMs);
    }, 200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [typingStatus, isInputFocused]);

  useEffect(() => {
    if (!canType) {
      return;
    }

    inputRef.current?.focus();
  }, [canType]);

  const handleInputChange = (nextValue: string) => {
    if (!canType) {
      return;
    }

    const nextTyped = sanitizeTypedText(nextValue, promptText.length);
    setTypedText(nextTyped);

    if (nextTyped.length === 0) {
      setElapsedMs(0);
      setReflectionText("");
      return;
    }

    if (
      nextTyped.length < promptText.length &&
      reflectionText.length > 0
    ) {
      setReflectionText("");
    }
  };

  const handleRestart = () => {
    setTypedText("");
    setReflectionText("");
    setElapsedMs(0);
    if (shuffleSentences) {
      setShuffleNonce((previous) => previous + 1);
    }
    inputRef.current?.focus();
  };

  const handleShuffleSentencesChange = (nextValue: boolean) => {
    setShuffleSentences(nextValue);
    if (nextValue) {
      setShuffleNonce((previous) => previous + 1);
    }
    setTypedText("");
    setReflectionText("");
    setElapsedMs(0);
    setIsInputFocused(false);
    inputRef.current?.focus();
  };

  const handleInputFocus = () => {
    setIsInputFocused(true);
  };

  const handleInputBlur = () => {
    setIsInputFocused(false);
  };

  return (
    <ReaderPageFrame>
      <ReaderPageHeader
        title="Comprehension Typing"
        subtitle="Understand each phrase, then type it exactly. Speed is secondary."
      />
      {!isReady && (
        <ProcessingPanel
          status={article.ingestStatus}
          ingestError={article.ingestError}
          publicId={article.publicId}
          normalizedUrl={article.normalizedUrl}
        />
      )}
      {isReady && !hasPrompt && (
        <ReaderPanel>
          <Text
            size="sm"
            c="dimmed"
            style={{ fontFamily: readerBodyFont }}
          >
            No text is available for typing in this article.
          </Text>
          <Anchor
            component={Link}
            href={`/reader/${article.publicId}`}
            size="sm"
          >
            Back to article
          </Anchor>
        </ReaderPanel>
      )}
      {canType && (
        <>
          <TypingStagePanel
            article={article}
            value={typedText}
            disabled={inputDisabled}
            shuffleSentences={shuffleSentences}
            elapsedMs={elapsedMs}
            metrics={metrics}
            typedChars={typedText.length}
            promptChars={promptText.length}
            typingStatus={typingStatus}
            isInputFocused={isInputFocused}
            promptWindow={promptWindow}
            onChange={handleInputChange}
            onShuffleSentencesChange={handleShuffleSentencesChange}
            onRestart={handleRestart}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            inputRef={inputRef}
          />
          {typingStatus === "finished" && (
            <CompletionPanel
              publicId={article.publicId}
              reflectionText={reflectionText}
              onReflectionChange={setReflectionText}
              onRestart={handleRestart}
            />
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
