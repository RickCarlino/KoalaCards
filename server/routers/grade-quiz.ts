import { z } from "zod";
import { procedure } from "../trpc";
import { prismaClient } from "../prisma-client";
import { getQuizEvaluator } from "../quiz-evaluators";
import { transcribeB64 } from "@/utils/transcribe";

const performExamOutput = z.union([
  z.object({
    grade: z.number(),
    userTranscription: z.string(),
    result: z.literal("pass"),
  }),
  z.object({
    // ADD previousSpacingData HERE
    previousSpacingData: z.object({
      repetitions: z.number(),
      interval: z.number(),
      ease: z.number(),
      lapses: z.number(),
    }),
    grade: z.number(),
    rejectionText: z.string(),
    // TODO: Delete this useless field.
    userTranscription: z.string(),
    result: z.literal("fail"),
  }),
  z.object({
    rejectionText: z.string(),
    result: z.literal("error"),
  }),
]);

type PerformExamOutput = z.infer<typeof performExamOutput>;

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
      card.langCode as "ko",
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
    switch (result.result) {
      case "pass":
        return {
          grade: 0,
          userTranscription: result.userMessage,
          result: "pass",
        };
      case "fail":
        return {
          previousSpacingData: {
            repetitions: 0,
            interval: 0,
            ease: 0,
            lapses: 0,
          },
          grade: 0,
          rejectionText: result.userMessage,
          userTranscription: "FIXME",
          result: "fail",
        };
      default:
        return {
          rejectionText: "FIXME",
          result: "error",
        };
    }
  });
