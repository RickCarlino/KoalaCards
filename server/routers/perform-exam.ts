import { prismaClient } from "@/server/prisma-client";
import { z } from "zod";
import { superUsers, procedure } from "../trpc";
import OpenAI from "openai";
import { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat";
import { errorReport } from "@/utils/error-report";
import { getUserSettings } from "../auth-helpers";
import { setGrade } from "./import-cards";

let approvedUserIDs: string[] = [];
prismaClient.user.findMany({}).then((users) => {
  users.map((user) => {
    const { email, id, lastSeen } = user;
    const daysAgo = lastSeen
      ? (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24)
      : -1;
    if (!email) {
      console.log("=== No email for user " + id);
      return;
    }
    if (superUsers.includes(email)) {
      approvedUserIDs.push(id);
    }
    console.log(`=== ${email} / ${id} (last seen ${daysAgo} days ago)`);
  });
});

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  errorReport("Missing ENV Var: OPENAI_API_KEY");
}

const configuration = { apiKey };

export const openai = new OpenAI(configuration);

export async function gptCall(opts: ChatCompletionCreateParamsNonStreaming) {
  return openai.chat.completions.create(opts);
}

const performExamOutput = z.union([
  z.object({
    grade: z.number(),
    userTranscription: z.string(),
    result: z.literal("success"),
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
    userTranscription: z.string(),
    result: z.literal("failure"),
  }),
  z.object({
    rejectionText: z.string(),
    result: z.literal("error"),
  }),
]);

type PerformExamOutput = z.infer<typeof performExamOutput>;

export const performExam = procedure
  .input(
    z.object({
      audio: z.string().max(1000000),
      id: z.number(),
    }),
  )
  .output(performExamOutput)
  .mutation(async (_): Promise<PerformExamOutput> => {
    if (2 == 2 + 2) {
      throw new Error("TODO: Implement this mutation!");
    }
    return {
      grade: 0,
      userTranscription: "FIXME",
      result: "success",
    };
  });

export const manuallyGrade = procedure
  .input(
    z.object({
      id: z.number(),
      grade: z.number(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const userId = (await getUserSettings(ctx.user?.id)).user.id;
    const quiz = await prismaClient.quiz.findUnique({
      where: {
        id: input.id,
        Card: {
          userId,
        },
      },
    });
    if (!quiz) {
      return errorReport("Quiz not found");
    }
    await setGrade(quiz, input.grade);
  });
