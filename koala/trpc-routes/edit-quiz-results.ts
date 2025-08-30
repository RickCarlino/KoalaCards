import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { prismaClient } from "../prisma-client";

// Generic QuizResult edit RPC: caller submits a Partial of allowed fields
const EditableFieldsSchema = z
  .object({
    reviewedAt: z.date().nullable().optional(),
    isAcceptable: z.boolean().optional(),
    acceptableTerm: z.string().optional(),
    reason: z.string().optional(),
    userInput: z.string().optional(),
    definition: z.string().optional(),
    eventType: z.string().optional(),
    langCode: z.string().optional(),
    helpfulness: z.number().int().min(-1).max(1).optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field is required",
  });

export const editQuizResult = procedure
  .input(z.object({ resultId: z.number(), data: EditableFieldsSchema }))
  .output(z.object({ success: z.literal(true) }))
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) throw new Error("Unauthorized");

    const { resultId, data } = input;

    const result = await prismaClient.quizResult.updateMany({
      where: { id: resultId, userId },
      data,
    });

    if (result.count !== 1) {
      throw new Error("Quiz result not found");
    }

    return { success: true } as const;
  });
