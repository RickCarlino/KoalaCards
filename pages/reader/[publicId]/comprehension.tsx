import { generateStructuredOutput } from "@/koala/ai";
import {
  buildReaderSourceText,
  collapseReaderWhitespace,
  ReaderInputKind,
} from "@/koala/reader/public-article";
import { getPublicReaderArticlePage } from "@/koala/reader/page-public-article";
import { ReaderArticlePanelHeader } from "@/koala/reader/ui/article-panel-header";
import { ReaderExercisePage } from "@/koala/reader/ui/exercise-page";
import { ReaderPanel } from "@/koala/reader/ui/layout";
import { ReaderProcessingPanel } from "@/koala/reader/ui/processing-panel";
import { readerBodyFont } from "@/koala/reader/ui/theme";
import { Stack, Text } from "@mantine/core";
import type {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from "next";
import Head from "next/head";
import React from "react";
import { z } from "zod";
import {
  buildFallbackKoreanQuestions,
  mergeQuestionLists,
} from "@/koala/reader/comprehension-questions";

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

function buildReadingMaterial(
  contentText: string,
  inputKind: ReaderInputKind,
): string {
  const sourceText = buildReaderSourceText(contentText, inputKind);
  if (!sourceText) {
    return "";
  }

  return collapseReaderWhitespace(sourceText);
}

function targetComprehensionQuestionCount(characterCount: number): number {
  const safeCharacterCount = Math.max(0, characterCount);
  return (
    1 + Math.floor(safeCharacterCount / COMPREHENSION_QUESTION_CHAR_STEP)
  );
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
      <ReaderExercisePage
        article={article}
        title="Comprehension Questions"
        isReady={isReady}
        hasContent={hasQuestionData}
        processingPanel={
          <ReaderProcessingPanel
            status={article.ingestStatus}
            ingestError={article.ingestError}
            publicId={article.publicId}
            normalizedUrl={article.normalizedUrl}
            errorTitle="We could not generate comprehension questions for this article."
            pendingMessages={{
              pending: "This article is queued for processing.",
              inProgress: "This article is currently being processed.",
            }}
            articleLinkLabel="Go to article"
            backLinkLabel="Back to Reader"
            sourceLinkLabel="Open source page"
          />
        }
        emptyMessage="This article does not have enough text to generate comprehension questions."
        emptyLinkLabel="Go to article"
      >
        <ReaderPanel>
          <ReaderArticlePanelHeader
            article={article}
            returnLabel="← Go to article"
            titleFontSize="clamp(1.2rem, 2.3vw, 1.6rem)"
          />
          <Stack gap={8}>
            {questionData?.questions.map((question, index) => (
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
      </ReaderExercisePage>
    </>
  );
}

export async function getServerSideProps(
  context: GetServerSidePropsContext,
) {
  const article = await getPublicReaderArticlePage(context);
  if (!article) {
    return { notFound: true };
  }

  let questionData: ComprehensionQuestionData | null = null;
  if (article.ingestStatus === "ready") {
    const readingMaterial = buildReadingMaterial(
      article.contentText,
      article.inputKind,
    );

    if (readingMaterial.length > 0) {
      const characterCount = readingMaterial.length;
      const questionCount =
        targetComprehensionQuestionCount(characterCount);
      const fallbackQuestions = buildFallbackKoreanQuestions(
        questionCount,
        KOREAN_FALLBACK_QUESTIONS,
      );

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
            publicId: article.publicId,
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
      article,
      questionData,
    },
  };
}
