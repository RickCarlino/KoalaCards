import { prismaClient } from "@/koala/prisma-client";

const EASY_CUTOFF = 8;
const REP_CUTOFF = 3;

// Take all listening cards with a difficulty of 8 or lower
// and a repetition count of 3 or more and convert them to
// speaking-only cards.
export async function autoPromoteCards(userID: string) {
  const eligibleCards = await prismaClient.quiz.findMany({
    where: {
      Card: { userId: userID },
      quizType: "listening",
      repetitions: { gte: REP_CUTOFF },
      difficulty: { lte: EASY_CUTOFF },
    },
    include: { Card: true },
  });
  // Delete listening quiz and create new speaking quiz
  eligibleCards.map(async (quiz) => {
    const alreadyExists = await prismaClient.quiz.count({
      where: {
        Card: { id: quiz.Card.id },
        quizType: "speaking",
      },
    });
    if (!alreadyExists) {
      await prismaClient.quiz.create({
        data: {
          cardId: quiz.cardId,
          quizType: "speaking",
          nextReview: quiz.nextReview,
        },
      });
    }
    await prismaClient.quiz.deleteMany({ where: { id: quiz.id } });
  });
}
