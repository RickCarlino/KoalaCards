import Link from "next/link";
import { GetServerSideProps } from "next/types";

type ReviewPageProps = {
  decks: { name: string; id: number }[];
};

export const getServerSideProps: GetServerSideProps<ReviewPageProps> = async (
  context,
) => {
  const { prismaClient } = await import("@/koala/prisma-client");
  const { getSession } = await import("next-auth/react");
  const session = await getSession(context);

  if (!session || !session.user) {
    return { redirect: { destination: "/api/auth/signin", permanent: false } };
  }

  const dbUser = await prismaClient.user.findUnique({
    where: {
      email: session.user.email ?? undefined,
    },
  });

  if (!dbUser) {
    return { redirect: { destination: "/api/auth/signin", permanent: false } };
  }

  const { backfillDecks } = await import("@/koala/decks/backfill-decks");

  backfillDecks(dbUser.id);
  const decks = await prismaClient.deck.findMany({
    where: {
      userId: dbUser.id,
    },
    select: {
      name: true,
      id: true,
    },
  });

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

  return (
    <div>
      <h1>Decks</h1>
      <ul>
        {decks.map((deck) => (
          <li key={deck.id}>
            <Link href={`/review/${deck.id}`}>
              {deck.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
