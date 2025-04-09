import { prismaClient } from "@/koala/prisma-client";

const REP_CUTOFF = 1;

// Take all listening cards with a difficulty of 8 or lower
// and a repetition count of 2 or more and convert them to
// speaking-only cards.
export async function autoPromoteCards(userID: string) {
  // Find listening quizzes for the user that meet the repetition cutoff
  // and whose associated card has no speaking quiz yet.
  const eligibleQuizzes = await prismaClient.quiz.findMany({
    where: {
      quizType: "listening",
      repetitions: { gte: REP_CUTOFF },
      Card: {
        userId: userID,
        Quiz: {
          none: { quizType: "speaking" },
        },
      },
    },
  });

  // Create a speaking quiz for each eligible listening quiz.
  await Promise.all(
    eligibleQuizzes.map((quiz) =>
      prismaClient.quiz.create({
        data: {
          cardId: quiz.cardId,
          quizType: "speaking",
          nextReview: quiz.nextReview,
        },
      }),
    ),
  );
}
