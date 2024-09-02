import { transcribeB64 } from "@/koala/transcribe";
import { Card } from "@prisma/client";
import { Grade } from "femto-fsrs";
import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { getQuizEvaluator } from "../quiz-evaluators";
import { QuizEvaluatorOutput } from "../quiz-evaluators/types";
import { procedure } from "../trpc-procedure";
import { calculateSchedulingData, setGrade } from "./import-cards";
import { LessonType } from "../shared-types";
import { generateLessonAudio } from "../speech";
import { isApprovedUser } from "../is-approved-user";
import { maybeAddImages } from "../image";
import { errorReport } from "../error-report";

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
    quizType: LessonType;
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
  playbackAudio: z.string(),
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
  const playbackAudio = await generateLessonAudio({
    card: ctx.card,
    lessonType: "dictation",
    speed: 90,
  });
  return {
    result: "fail",
    grade: 0,
    userTranscription: ctx.userInput,
    rejectionText: ctx.result.userMessage,
    rollbackData: calculateSchedulingData(ctx.quiz, ctx.perceivedDifficulty),
    playbackAudio,
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
    // I don't like how implicit this is. Would be better to pass the quizType in.
    const isNew = quiz.repetitions === 0 && quiz.lapses === 0;
    const quizType = (isNew ? "dictation" : quiz.quizType) as LessonType;
    let evaluator = getQuizEvaluator(quizType);
    let prompt = ``;
    switch (quizType) {
      case "dictation":
      case "speaking":
        prompt = card.term;
        break;
      case "listening":
        prompt = card.definition;
        break;
      default:
        return errorReport(`Unknown quiz type: ${quizType}`);
    }
    const transcript = await transcribeB64(
      quiz.quizType === "listening" ? "en-US" : (card.langCode as "ko"),
      x.input.audio,
      user.id,
      prompt,
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
        quizType: quiz.quizType as LessonType,
      },
    };

    // Temporary experiment: Add 3 DALL-E images per review.
    if (isApprovedUser(user.id)) {
      maybeAddImages(user.id, 1);
    }
    switch (result.result) {
      case "pass":
        return processPass(resultContext);
      case "fail":
        return processFailure(resultContext);
      case "error":
        return processError(resultContext);
      default:
        return errorReport(`Unknown result: ${result.result}`);
    }
  });
