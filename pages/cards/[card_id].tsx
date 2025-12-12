import { getCardOrFail } from "@/koala/get-card-or-fail";
import { getServersideUser } from "@/koala/get-serverside-user";
import { maybeGetCardImageUrl } from "@/koala/image";
import { prismaClient } from "@/koala/prisma-client";
import { CardPageView } from "@/koala/cards/card-page-view";
import type { CardPageProps } from "@/koala/cards/card-page-types";
import { DEFAULT_LANG_CODE } from "@/koala/shared-types";
import {
  firstQueryValue,
  toPositiveIntOrNull,
} from "@/koala/utils/query-params";
import { GetServerSideProps } from "next";
export default function CardPage({ card }: CardPageProps) {
  return <CardPageView card={card} />;
}

export const getServerSideProps: GetServerSideProps<
  CardPageProps
> = async (context) => {
  const dbUser = await getServersideUser(context);

  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    } as const;
  }

  const cardId = toPositiveIntOrNull(
    firstQueryValue(context.query.card_id),
  );
  if (!cardId) {
    return { notFound: true } as const;
  }

  const card = await getCardOrFail(cardId, dbUser.id);
  const imageURL = (await maybeGetCardImageUrl(card.imageBlobId)) || null;
  const deckId = card.deckId;
  const deck = deckId
    ? await prismaClient.deck.findFirst({
        where: { id: deckId, userId: dbUser.id },
        select: { name: true },
      })
    : null;

  return {
    props: {
      card: {
        id: card.id,
        term: card.term,
        definition: card.definition,
        flagged: card.flagged,
        langCode: DEFAULT_LANG_CODE,
        gender: card.gender,
        imageURL,
        repetitions: card.repetitions ?? 0,
        lapses: card.lapses ?? 0,
        lastReview: card.lastReview ?? 0,
        nextReview: card.nextReview ?? 0,
        stability: card.stability ?? 0,
        difficulty: card.difficulty ?? 0,
        deckName: deck?.name || null,
      },
    },
  };
};
