import { transcribeB64 } from "@/koala/transcribe";
import { Card } from "@prisma/client";
import { Grade } from "femto-fsrs";
import { z } from "zod";
import { generateLessonAudio } from "../fetch-lesson";
import { prismaClient } from "../prisma-client";
import { getQuizEvaluator } from "../quiz-evaluators";
import { QuizEvaluatorOutput } from "../quiz-evaluators/types";
import { procedure } from "../trpc-procedure";
import { calculateSchedulingData, setGrade } from "./import-cards";

type PerformExamOutput = z.infer<typeof performExamOutput>;
type ResultContext = {
  result: QuizEvaluatorOutput;
  daysSinceReview: number;
  perceivedDifficulty: Grade;
  userInput: string;
  card: Card;
  quiz: {
    id: number;
    firstReview: number;
    lastReview: number;
    difficulty: number;
    stability: number;
    lapses: number;
    repetitions: number;
    quizType: "listening" | "speaking";
  };
};

const ERROR = z.object({
  rejectionText: z.string(),
  result: z.literal("error"),
});

const FAIL = z.object({
  grade: z.number(),
  rejectionText: z.string(),
  userTranscription: z.string(),
  result: z.literal("fail"),
  audio: z.string(),
  rollbackData: z.object({
    difficulty: z.number(),
    stability: z.number(),
    nextReview: z.number(),
  }),
});

const PASS = z.object({
  userTranscription: z.string(),
  result: z.literal("pass"),
});

const performExamOutput = z.union([PASS, FAIL, ERROR]);
type FailResult = z.infer<typeof FAIL>;
async function processFailure(ctx: ResultContext): Promise<FailResult> {
  await setGrade(ctx.quiz, Grade.AGAIN);
  const audio = await generateLessonAudio({
    card: ctx.card,
    lessonType: "listening",
    speed: 90,
  });
  return {
    result: "fail",
    grade: 0,
    userTranscription: ctx.userInput,
    rejectionText: ctx.result.userMessage,
    rollbackData: calculateSchedulingData(ctx.quiz, ctx.perceivedDifficulty),
    audio,
  };
}

function processError(ctx: ResultContext): z.infer<typeof ERROR> {
  return {
    rejectionText: ctx.result.userMessage,
    result: "error",
  };
}

async function processPass(ctx: ResultContext): Promise<z.infer<typeof PASS>> {
  const grade = ctx.perceivedDifficulty;
  await setGrade(ctx.quiz, grade);
  return {
    userTranscription: "OK",
    result: "pass",
  };
}

export const gradeQuiz = procedure
  .input(
    z.object({
      perceivedDifficulty: z.number().min(1).max(4).int(),
      audio: z.string().max(1000000),
      id: z.number(),
    }),
  )
  .output(performExamOutput)
  .mutation(async (x): Promise<PerformExamOutput> => {
    const user = x.ctx.user;
    if (!user) {
      console.log(`=== User not logged in?`);
      return {
        rejectionText: "You are not logged in",
        result: "error",
      };
    }

    const quiz = await prismaClient.quiz.findUnique({
      where: {
        id: x.input.id,
        Card: {
          userId: user.id,
        },
      },
      include: {
        Card: true,
      },
    });

    if (!quiz) {
      return {
        result: "error",
        rejectionText: "No quiz found",
      };
    }
    const card = quiz?.Card;
    const evaluator = getQuizEvaluator(quiz.quizType);
    const transcript = await transcribeB64(
      quiz.quizType === "listening" ? "en-US" : (card.langCode as "ko"),
      x.input.audio,
      user.id,
    );
    if (transcript.kind === "error") {
      return {
        result: "error",
        rejectionText: "Transcription error",
      };
    }
    const result = await evaluator({
      quiz,
      card,
      userInput: transcript.text,
      userID: user.id,
    });
    const now = new Date().getTime();
    const lastReview = quiz.lastReview;
    const resultContext: ResultContext = {
      result,
      daysSinceReview: Math.floor((now - lastReview) / (1000 * 60 * 60 * 24)),
      perceivedDifficulty: x.input.perceivedDifficulty as Grade,
      userInput: transcript.text,
      card,
      quiz: {
        id: quiz.id,
        firstReview: quiz.firstReview,
        lastReview: quiz.lastReview,
        difficulty: quiz.difficulty,
        stability: quiz.stability,
        lapses: quiz.lapses,
        repetitions: quiz.repetitions,
        quizType: quiz.quizType as "listening" | "speaking",
      },
    };
    switch (result.result) {
      case "pass":
        return processPass(resultContext);
      case "fail":
        return processFailure(resultContext);
      case "error":
        return processError(resultContext);
      default:
        throw new Error(`Unknown result: ${result.result}`);
    }
  });
