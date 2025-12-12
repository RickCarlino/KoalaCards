import { canStartNewLessons, getLessonsDue } from "@/koala/fetch-lesson";
import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { GetServerSideProps } from "next";
import ReviewDeckPage from "@/koala/review/pages/review-deck/ReviewDeckPage";

type ReviewDeckPageProps = { deckId: number };

const redirect = (destination: string) => ({
  redirect: { destination, permanent: false } as const,
});

export const getServerSideProps: GetServerSideProps<
  ReviewDeckPageProps
> = async (ctx) => {
  const user = await getServersideUser(ctx);
  if (!user) {
    return redirect("/api/auth/signin");
  }

  const deckId = Number(ctx.params?.deckId);
  if (!deckId) {
    return redirect("/review");
  }

  const deck = await prismaClient.deck.findUnique({
    where: { userId: user.id, id: deckId },
    select: { id: true },
  });

  if (!deck) {
    return redirect("/review");
  }

  const userSettings = await prismaClient.userSettings.findUnique({
    where: { userId: user.id },
  });

  if (!userSettings) {
    return redirect("/settings");
  }

  const hasDue = (await getLessonsDue(deck.id)) >= 1;
  const canStartNew = await canStartNewLessons(
    user.id,
    deck.id,
    Date.now(),
  );
  if (!hasDue && !canStartNew) {
    return redirect("/review");
  }

  if (userSettings.writingFirst) {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const writingProgress = await prismaClient.writingSubmission.aggregate(
      {
        _sum: { correctionCharacterCount: true },
        where: {
          userId: user.id,
          createdAt: { gte: last24Hours },
        },
      },
    );

    const progress = writingProgress._sum.correctionCharacterCount ?? 0;
    const goal = userSettings.dailyWritingGoal ?? 100;
    if (progress < goal) {
      return {
        redirect: {
          destination: `/writing/${deckId}`,
          permanent: false,
        },
      };
    }
  }

  return {
    props: {
      deckId,
    },
  };
};

export default function ReviewDeckPageWrapper(props: ReviewDeckPageProps) {
  return <ReviewDeckPage {...props} />;
}
