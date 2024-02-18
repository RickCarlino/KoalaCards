import { z } from "zod";
import { procedure } from "../trpc";
import { prismaClient } from "../prisma-client";
import { getQuizEvaluator } from "../quiz-evaluators";
import { transcribeB64 } from "@/utils/transcribe";
import { QuizEvaluatorOutput } from "../quiz-evaluators/types";
import { draw } from "radash";
import { Grade } from "femto-fsrs";
import { setGrade } from "./import-cards";

type PerformExamOutput = z.infer<typeof performExamOutput>;
type ResultContext = {
  result: QuizEvaluatorOutput;
  daysSinceReview: number;
  quiz: {
    id: number;
    firstReview: number;
    lastReview: number;
    difficulty: number;
    stability: number;
    lapses: number;
    repetitions: number;
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
});

const PASS = z.object({
  grade: z.number(),
  userTranscription: z.string(),
  result: z.literal("pass"),
});

const performExamOutput = z.union([PASS, FAIL, ERROR]);

function processFailure(ctx: ResultContext): z.infer<typeof ERROR> {
  return {
    rejectionText: ctx.result.userMessage,
    result: "error",
  };
}

function processError(ctx: ResultContext): z.infer<typeof ERROR> {
  return {
    rejectionText: ctx.result.userMessage,
    result: "error",
  };
}

async function processPass(ctx: ResultContext): Promise<z.infer<typeof PASS>> {
  const grade = Grade.GOOD;
  console.log(`=== TODO: Need to actually select GOOD vs. EASY vs. Hard ===`);
  await setGrade(ctx.quiz, grade);
  return {
    grade: 0,
    userTranscription: "OK",
    result: "pass",
  };
}

export const gradeQuiz = procedure
  .input(
    z.object({
      audio: z.string().max(1000000),
      id: z.number(),
    }),
  )
  .output(performExamOutput)
  .mutation(async (x): Promise<PerformExamOutput> => {
    // const userSettings = await getUserSettings("" + x.ctx.user?.id);
    const user = x.ctx.user;
    if (!user) {
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
    const audio = await transcribeB64(
      quiz.quizType === "listening" ? "en-US" : (card.langCode as "ko"),
      x.input.audio,
      user.id,
    );
    if (audio.kind === "error") {
      return {
        result: "error",
        rejectionText: "Transcription error",
      };
    }
    const result = await evaluator({
      quiz,
      card,
      userInput: audio.text,
    });
    const now = new Date().getTime();
    const lastReview = quiz.lastReview;
    const resultContext: ResultContext = {
      result,
      daysSinceReview: Math.floor((now - lastReview) / (1000 * 60 * 60 * 24)),
      quiz: {
        id: quiz.id,
        firstReview: quiz.firstReview,
        lastReview: quiz.lastReview,
        difficulty: quiz.difficulty,
        stability: quiz.stability,
        lapses: quiz.lapses,
        repetitions: quiz.repetitions,
      },
    };
    switch (result.result) {
      case "pass":
        return processPass(resultContext);
      case "fail":
        return processFailure(resultContext);
      default:
        return processError(resultContext);
    }
  });
