import { Grades, Rating } from "ts-fsrs";
import { z } from "zod";
import { maybeAddImageToCard } from "../image";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { setGrade } from "./import-cards";
import { getUserSettings } from "../auth-helpers";

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

    const grade = Grades.find(
      (candidate) => candidate === x.input.perceivedDifficulty,
    );
    if (!grade) {
      return {
        rejectionText: "Invalid grade",
        result: "error",
      };
    }
    const card = await prismaClient.card.findFirst({
      where: { id: x.input.cardID, userId: user.id },
    });

    if (!card) {
      return {
        result: "error",
        rejectionText: "No card found",
      };
    }

    if ([Rating.Again, Rating.Hard].includes(grade)) {
      maybeAddImageToCard(card);
    }
    const settings = await getUserSettings(user.id);
    await setGrade(card, grade, Date.now(), settings.requestedRetention);
    return {};
  });
