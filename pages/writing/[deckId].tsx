import { getServersideUser } from "@/koala/get-serverside-user";
import { GetServerSideProps } from "next";

const buildReviewPath = (deckId: number) => `/review/${deckId}`;

const buildWritingPracticeUrl = (returnTo: string) =>
  `/writing/practice?returnTo=${encodeURIComponent(returnTo)}`;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const dbUser = await getServersideUser(ctx);
  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  const parsedId = Number(ctx.params?.deckId);
  const hasDeckId = Number.isFinite(parsedId) && parsedId > 0;
  const returnTo = hasDeckId ? buildReviewPath(parsedId) : "/review";

  return {
    redirect: {
      destination: buildWritingPracticeUrl(returnTo),
      permanent: false,
    },
  };
};

export default function WritingDeckRedirect() {
  return null;
}
