import { Grade } from "femto-fsrs";
import { z } from "zod";
import { maybeAddImageToCard } from "../image";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { setGrade } from "./import-cards";

export const gradeQuiz = procedure
  .input(
    z.object({
      perceivedDifficulty: z.number().min(1).max(4).int(),
      cardID: z.number(),
    }),
  )
  .output(z.object({}))
  .mutation(async (x): Promise<{}> => {
    const user = x.ctx.user;
    if (!user) {
      return {
        rejectionText: "You are not logged in",
        result: "error",
      };
    }

    const grade = x.input.perceivedDifficulty as Grade;
    const card = await prismaClient.card.findFirst({
      where: { id: x.input.cardID, userId: user.id },
    });

    if (!card) {
      return {
        result: "error",
        rejectionText: "No card found",
      };
    }

    if ([Grade.AGAIN, Grade.HARD].includes(grade)) {
      maybeAddImageToCard(card);
    }
    await setGrade(card, grade);
    return {};
  });
