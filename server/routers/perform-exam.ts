import { z } from "zod";
import { procedure } from "../trpc";

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
    console.log("== DO THIS NEXT");
    if (2 == 2 + 2) {
      throw new Error("TODO: Implement this mutation!");
    }
    return {
      grade: 0,
      userTranscription: "FIXME",
      result: "success",
    };
  });
