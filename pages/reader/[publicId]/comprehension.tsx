import { generateStructuredOutput } from "@/koala/ai";
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
  readerMutedColor,
} from "@/koala/reader/ui/theme";
import { Anchor, Group, Stack, Text } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import type {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from "next";
import Head from "next/head";
import Link from "next/link";
import React from "react";
import { z } from "zod";

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

type ComprehensionQuestionData = {
  questions: string[];
  characterCount: number;
  questionCount: number;
};

const COMPREHENSION_QUESTION_CHAR_STEP = 700;
const MAX_LLM_SOURCE_CHARACTERS = 12000;
const KOREAN_FALLBACK_QUESTIONS = [
  "이 글의 핵심 주장은 무엇인가요?",
  "글쓴이가 가장 강조한 내용은 무엇인가요?",
  "이 글에서 가장 중요한 근거는 무엇인가요?",
  "글의 흐름을 따라 핵심 내용을 어떻게 정리할 수 있나요?",
  "글쓴이의 의도를 한 문장으로 설명하면 무엇인가요?",
  "이 글의 결론은 무엇인가요?",
  "글에서 제시한 예시가 핵심 주장과 어떻게 연결되나요?",
  "이 글을 읽고 반드시 이해해야 할 점은 무엇인가요?",
  "글의 핵심 내용을 자신의 말로 다시 설명하면 무엇인가요?",
  "글의 내용을 바탕으로 어떤 점을 추론할 수 있나요?",
];

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
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
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

function buildReadingMaterial(
  contentText: string,
  inputKind: ReaderInputKind,
): string {
  const normalized = normalizeLineBreaks(contentText);
  if (!normalized) {
    return "";
  }

  if (inputKind === "raw") {
    return collapseWhitespace(normalized);
  }

  return collapseWhitespace(stripMarkdownSyntax(normalized));
}

function targetComprehensionQuestionCount(characterCount: number): number {
  const safeCharacterCount = Math.max(0, characterCount);
  return (
    1 + Math.floor(safeCharacterCount / COMPREHENSION_QUESTION_CHAR_STEP)
  );
}

function stripLeadingQuestionNumbering(value: string): string {
  return value.replace(/^\s*\d+[.)\-\s]+/, "").trim();
}

function hasLatinLetters(value: string): boolean {
  return /[A-Za-z]/.test(value);
}

function normalizeKoreanQuestion(value: string): string {
  const stripped = stripLeadingQuestionNumbering(value);
  const collapsed = collapseWhitespace(stripped);

  if (!collapsed) {
    return "";
  }

  if (hasLatinLetters(collapsed)) {
    return "";
  }

  const normalizedPunctuation = collapsed.replace(/？/g, "?");
  if (normalizedPunctuation.endsWith("?")) {
    return normalizedPunctuation;
  }

  return `${normalizedPunctuation}?`;
}

function buildFallbackKoreanQuestions(questionCount: number): string[] {
  const questions: string[] = [];
  for (let index = 0; index < questionCount; index += 1) {
    const fallback =
      KOREAN_FALLBACK_QUESTIONS[index % KOREAN_FALLBACK_QUESTIONS.length];
    const normalizedFallback = normalizeKoreanQuestion(fallback);
    if (normalizedFallback) {
      questions.push(normalizedFallback);
      continue;
    }

    questions.push("이 글의 핵심 내용은 무엇인가요?");
  }

  return questions;
}

function mergeQuestionLists(options: {
  preferredQuestions: string[];
  fallbackQuestions: string[];
  questionCount: number;
}): string[] {
  const merged: string[] = [];

  for (const question of options.preferredQuestions) {
    const normalized = normalizeKoreanQuestion(question);
    if (!normalized) {
      continue;
    }

    if (merged.includes(normalized)) {
      continue;
    }

    merged.push(normalized);
    if (merged.length >= options.questionCount) {
      return merged.slice(0, options.questionCount);
    }
  }

  for (const question of options.fallbackQuestions) {
    const normalized = normalizeKoreanQuestion(question);
    if (!normalized) {
      continue;
    }

    if (merged.includes(normalized)) {
      continue;
    }

    merged.push(normalized);
    if (merged.length >= options.questionCount) {
      return merged.slice(0, options.questionCount);
    }
  }

  let fallbackCursor = 0;
  while (merged.length < options.questionCount) {
    const fallback =
      options.fallbackQuestions[
        fallbackCursor % options.fallbackQuestions.length
      ] ?? "이 글의 핵심 내용은 무엇인가요?";
    merged.push(fallback);
    fallbackCursor += 1;
  }

  return merged.slice(0, options.questionCount);
}

function comprehensionQuestionSchema(questionCount: number) {
  return z.object({
    questions: z.array(z.string().min(1)).length(questionCount),
  });
}

async function generateComprehensionQuestionsWithLlm(options: {
  readingMaterial: string;
  questionCount: number;
}): Promise<string[]> {
  const sourceText = options.readingMaterial.slice(
    0,
    MAX_LLM_SOURCE_CHARACTERS,
  );

  const response = await generateStructuredOutput({
    model: "good",
    schema: comprehensionQuestionSchema(options.questionCount),
    messages: [
      {
        role: "system",
        content: [
          "너는 한국어 독해 교사다.",
          "주어진 글을 바탕으로 독해 질문만 만든다.",
          "질문은 반드시 순수 한국어로만 작성한다.",
          "영어, 로마자, 알파벳 약어를 쓰지 않는다.",
          "원문에 영어가 있어도 질문 문장은 한국어 표현으로 바꾼다.",
          "질문은 모두 자연스러운 한국어 의문문 한 문장으로 작성한다.",
          "질문 문장은 쉬운 어휘와 짧은 문장을 사용한다.",
          "중학생도 바로 이해할 수 있는 수준의 쉬운 표현으로 쓴다.",
          "독자가 누구인지, 어떤 배경이나 경험을 가졌는지 추정하지 않는다.",
          "질문은 독자의 개인 경험, 감정, 신념을 전제로 하지 않는다.",
          "질문은 반드시 글에 나온 정보와 글에서 가능한 추론만 바탕으로 만든다.",
          "질문 개수는 요청한 개수와 정확히 같아야 한다.",
          "출력은 JSON만 반환한다.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `질문 개수: ${options.questionCount}`,
          "요구 사항: 사실 확인 질문과 추론 질문을 적절히 섞어라.",
          `글:\n${sourceText}`,
        ].join("\n\n"),
      },
    ],
    maxTokens: 4000,
  });

  if (!response) {
    return [];
  }

  return response.questions;
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
          We could not generate comprehension questions for this article.
        </Text>
        {ingestError.trim().length > 0 && (
          <Text size="sm" c="red">
            {ingestError}
          </Text>
        )}
        <Group gap="sm" wrap="wrap">
          <Anchor component={Link} href={`/reader/${publicId}`} size="sm">
            Go to article
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
              Open source page
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
            Go to article
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

export default function ReaderComprehensionQuestionsPage({
  article,
  questionData,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const isReady = article.ingestStatus === "ready";
  const hasQuestionData = questionData !== null;

  return (
    <>
      <Head>
        <title>{`Comprehension Questions · ${article.title} · Koala Cards`}</title>
      </Head>
      <ReaderPageFrame>
        <ReaderPageHeader title="Comprehension Questions" />
        {!isReady && (
          <ProcessingPanel
            status={article.ingestStatus}
            ingestError={article.ingestError}
            publicId={article.publicId}
            normalizedUrl={article.normalizedUrl}
          />
        )}
        {isReady && !hasQuestionData && (
          <ReaderPanel>
            <Text
              size="sm"
              c="dimmed"
              style={{ fontFamily: readerBodyFont }}
            >
              This article does not have enough text to generate
              comprehension questions.
            </Text>
            <Anchor
              component={Link}
              href={`/reader/${article.publicId}`}
              size="sm"
            >
              Go to article
            </Anchor>
          </ReaderPanel>
        )}
        {isReady && hasQuestionData && (
          <ReaderPanel>
            <Group
              justify="space-between"
              align="center"
              wrap="wrap"
              gap="sm"
            >
              <Anchor
                component={Link}
                href={`/reader/${article.publicId}`}
                size="sm"
              >
                ← Go to article
              </Anchor>
              <Group gap="xs" wrap="wrap">
                <Text
                  size="xs"
                  style={{
                    fontFamily: readerBodyFont,
                    color: readerMutedColor,
                  }}
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
            <Stack gap={4}>
              <Text
                style={{
                  fontFamily: readerDisplayFont,
                  color: readerHeadingColor,
                  fontWeight: 700,
                  lineHeight: 1.25,
                  fontSize: "clamp(1.2rem, 2.3vw, 1.6rem)",
                }}
              >
                {article.title}
              </Text>
            </Stack>
            <Stack gap={8}>
              {questionData.questions.map((question, index) => (
                <Text
                  key={`${index}-${question}`}
                  size="sm"
                  style={{ fontFamily: readerBodyFont, lineHeight: 1.6 }}
                >
                  {index + 1}. {question}
                </Text>
              ))}
            </Stack>
          </ReaderPanel>
        )}
      </ReaderPageFrame>
    </>
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

  let questionData: ComprehensionQuestionData | null = null;
  if (payload.ingestStatus === "ready") {
    const readingMaterial = buildReadingMaterial(
      payload.contentText,
      payload.inputKind,
    );

    if (readingMaterial.length > 0) {
      const characterCount = readingMaterial.length;
      const questionCount =
        targetComprehensionQuestionCount(characterCount);
      const fallbackQuestions =
        buildFallbackKoreanQuestions(questionCount);

      let llmQuestions: string[] = [];
      try {
        llmQuestions = await generateComprehensionQuestionsWithLlm({
          readingMaterial,
          questionCount,
        });
      } catch (error) {
        console.error(
          "[reader-comprehension] question generation failed",
          {
            publicId,
            error,
          },
        );
      }

      const questions = mergeQuestionLists({
        preferredQuestions: llmQuestions,
        fallbackQuestions,
        questionCount,
      });

      questionData = {
        questions,
        characterCount,
        questionCount,
      };
    }
  }

  return {
    props: {
      article: payload,
      questionData,
    },
  };
}
