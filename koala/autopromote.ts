import { prismaClient } from "@/koala/prisma-client";

export async function autoPromoteCards(userID: string) {
  const eligibleQuizzes = await prismaClient.quiz.findMany({
    where: {
      quizType: "listening",
      Card: {
        userId: userID,
        Quiz: {
          none: { quizType: "speaking" },
        },
      },
    },
  });

  await Promise.all(
    eligibleQuizzes.map((quiz) =>
      prismaClient.quiz.upsert({
        where: {
          cardId_quizType: {
            cardId: quiz.cardId,
            quizType: "speaking",
          },
        },
        update: {},
        create: {
          cardId: quiz.cardId,
          quizType: "speaking",
        },
      }),
    ),
  );
}
