import { backfillDecks } from "@/koala/decks/backfill-decks";
import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { DEFAULT_LANG_CODE } from "@/koala/shared-types";
import type { LanguageInputPageProps } from "@/koala/types/create-types";
import type { GetServerSideProps } from "next";
export { default } from "@/koala/create/CreatePage";

export const getServerSideProps: GetServerSideProps<
  LanguageInputPageProps
> = async (context) => {
  const dbUser = await getServersideUser(context);
  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    } as const;
  }

  await backfillDecks(dbUser.id);
  const decks = await prismaClient.deck.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
  });

  if (decks.length === 0) {
    return {
      redirect: { destination: "/create-new", permanent: false },
    } as const;
  }

  return {
    props: {
      decks: decks.map((deck) => ({
        id: deck.id,
        name: deck.name,
        langCode: DEFAULT_LANG_CODE,
      })),
    },
  };
};
