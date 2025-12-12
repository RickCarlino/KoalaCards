import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import {
  firstQueryValue,
  toPositiveIntOrDefault,
  toPositiveIntOrNull,
} from "@/koala/utils/query-params";
import { DEFAULT_LANG_CODE } from "@/koala/shared-types";
import { WritingHistoryPage } from "@/koala/writing/writing-history-page";
import type {
  WritingHistoryProps,
  WritingSubmissionView,
} from "@/koala/writing/writing-history-types";
import type { Prisma } from "@prisma/client";
import { GetServerSideProps } from "next";

const ITEMS_PER_PAGE = 5;

function buildWhere(params: {
  userId: string;
  deckId: number | null;
  q: string;
}): Prisma.WritingSubmissionWhereInput {
  const where: Prisma.WritingSubmissionWhereInput = {
    userId: params.userId,
  };

  if (params.deckId !== null) {
    where.deckId = params.deckId;
  }

  if (params.q.trim().length > 0) {
    where.OR = [
      { prompt: { contains: params.q, mode: "insensitive" } },
      { submission: { contains: params.q, mode: "insensitive" } },
      { correction: { contains: params.q, mode: "insensitive" } },
    ];
  }

  return where;
}

function toWritingDeckView(deck: { id: number; name: string }) {
  return { ...deck, langCode: DEFAULT_LANG_CODE };
}

export const getServerSideProps: GetServerSideProps<
  WritingHistoryProps
> = async (ctx) => {
  const dbUser = await getServersideUser(ctx);
  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  const page = toPositiveIntOrDefault(firstQueryValue(ctx.query.page), 1);
  const q = firstQueryValue(ctx.query.q) ?? "";
  const deckId = toPositiveIntOrNull(firstQueryValue(ctx.query.deckId));
  const skip = (page - 1) * ITEMS_PER_PAGE;

  const where = buildWhere({ userId: dbUser.id, deckId, q });
  const totalCount = await prismaClient.writingSubmission.count({ where });

  const submissionsRaw = await prismaClient.writingSubmission.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: ITEMS_PER_PAGE,
    skip,
    select: {
      id: true,
      prompt: true,
      submission: true,
      correction: true,
      createdAt: true,
      deck: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
  const submissions: WritingSubmissionView[] = submissionsRaw.map((s) => ({
    id: s.id,
    prompt: s.prompt,
    submission: s.submission,
    correction: s.correction,
    createdAt: s.createdAt.toISOString(),
    deck: toWritingDeckView(s.deck),
  }));

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const decksRaw = await prismaClient.deck.findMany({
    where: { userId: dbUser.id },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true },
  });
  const decks = decksRaw.map(toWritingDeckView);

  return {
    props: {
      submissions,
      totalPages,
      currentPage: page,
      decks,
      q,
      deckId: deckId ?? null,
    },
  };
};

export default function WritingHistoryPageRoute(
  props: WritingHistoryProps,
) {
  return <WritingHistoryPage {...props} />;
}
