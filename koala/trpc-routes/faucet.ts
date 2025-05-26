import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";

export const faucet = procedure
  .input(z.object({}))
  .output(z.array(z.object({ id: z.number() })))
  .mutation(async ({ ctx }) => {
    const us = await getUserSettings(ctx.user?.id);
    const userdId = us?.userId;
    if (!userdId) {
      return [];
    }
    const cards = await prismaClient.quiz.findMany({
      where: { Card: { userId: userdId } },
      include: { Card: true },
      take: 10,
    });
    if (cards.length < 10) {
      throw new Error("Need more cards");
    }
    const now = Date.now();
    const remedial = cards.pop();
    if (remedial?.Card) {
      console.log("=== Remedial card: " + remedial.Card.term);
      await prismaClient.card.update({
        where: { id: remedial.Card.id },
        data: { lastFailure: now },
      });
    }

    const newQuiz = cards.pop();
    if (newQuiz) {
      console.log("=== New quiz: " + newQuiz.Card.term);
      await prismaClient.quiz.update({
        where: { id: newQuiz.id },
        data: {
          stability: 0,
          difficulty: 0,
          firstReview: 0,
          lastReview: 0,
          nextReview: 0,
          lapses: 0,
          repetitions: 0,
        },
      });
    }

    const listeningQuiz = cards.find((q) => q.quizType === "listening");
    const speakingQuiz = cards.find((q) => q.quizType === "speaking");

    if (!listeningQuiz || !speakingQuiz) {
      throw new Error("Need both listening and speaking quizzes");
    }

    for (const q of [listeningQuiz, speakingQuiz]) {
      await prismaClient.quiz.update({
        where: { id: q.id },
        data: {
          nextReview: now - 24 * 60 * 60 * 1000,
          repetitions: 1,
        },
      });
    }

    return [{ id: 0 }];
  });
