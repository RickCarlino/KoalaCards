import {
  decksWithReviewInfo,
  DeckWithReviewInfo,
} from "@/koala/decks/decks-with-review-info";
import { getServersideUser } from "@/koala/get-serverside-user";
import Link from "next/link";
import { GetServerSideProps } from "next/types";

type ReviewPageProps = {
  decks: DeckWithReviewInfo[];
};

export const getServerSideProps: GetServerSideProps<ReviewPageProps> = async (
  context,
) => {
  const dbUser = await getServersideUser(context);

  if (!dbUser) {
    return { redirect: { destination: "/api/auth/signin", permanent: false } };
  }

  const { backfillDecks } = await import("@/koala/decks/backfill-decks");

  await backfillDecks(dbUser.id);
  const decks = await decksWithReviewInfo(dbUser.id);

  if (decks.length === 1) {
    return {
      redirect: {
        destination: `/review/${decks[0].id}`,
        permanent: false,
      },
    };
  }

  return {
    props: {
      decks,
    },
  };
};

export default function ReviewPage({ decks }: ReviewPageProps) {
  if (decks.length === 0) {
    return (
      <div>
        <h1>Welcome, Please Add Cards First</h1>
        <p>
          You can add cards <Link href={"/create"}>here</Link>.
        </p>
      </div>
    );
  }

  const sortedByDue = decks.sort((b, a) => a.quizzesDue - b.quizzesDue);

  return (
    <div>
      <h1>Decks</h1>
      <ul>
        {sortedByDue.map((deck) => {
          const cardsDue = deck.quizzesDue ? `${deck.quizzesDue} due` : "";
          const cardsNew = deck.newQuizzes ? `${deck.newQuizzes} new` : "";
          const cards = [cardsDue, cardsNew].filter(Boolean).join(", ");
          return (
            <li key={deck.id}>
              <Link href={`/review/${deck.id}`}>
                {deck.deckName} {cards ? `(${cards})` : ""}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
