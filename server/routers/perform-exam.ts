import { prismaClient } from "@/server/prisma-client";
import { z } from "zod";
import { superUsers, procedure } from "../trpc";
import OpenAI from "openai";
import { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat";
import { errorReport } from "@/utils/error-report";

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
      console.log(
        `=== Super user: ${email} / ${id} (last seen ${daysAgo} days ago)`,
      );
      approvedUserIDs.push(id);
    } else {
      console.log(
        `=== Normal user: ${email} / ${id} (last seen ${daysAgo} days ago)`,
      );
    }
  });
});

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  errorReport("Missing ENV Var: OPENAI_API_KEY");
}

const configuration = { apiKey };

const lessonType = z.union([z.literal("listening"), z.literal("speaking")]);

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
      lessonType,
      audio: z.string().max(1000000),
      id: z.number(),
    }),
  )
  .output(performExamOutput)
  .mutation(async (_): Promise<PerformExamOutput> => {
    console.log("==== TODO ===");
    return {
      grade: 0,
      userTranscription: "FIXME",
      result: "success",
    };
  });

export const failCard = procedure
  .input(
    z.object({
      id: z.number(),
    }),
  )
  .mutation(async (_) => {
    console.log("==== TODO");
  });
