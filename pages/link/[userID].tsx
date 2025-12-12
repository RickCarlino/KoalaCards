import {
  UserOverviewView,
  type UserOverviewCounts,
  type UserOverviewRecentQuiz,
  type UserOverviewRecentWriting,
  type UserOverviewUser,
  type UserOverviewViewProps,
} from "@/koala/admin/UserOverviewView";
import { prismaClient } from "@/koala/prisma-client";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import { getSession } from "next-auth/react";

type ServerAction = { kind: "show" } | { kind: "delete"; userId: string };

export const getServerSideProps: GetServerSideProps<
  UserOverviewViewProps
> = async (context) => {
  const session = await getSession({ req: context.req });
  const viewerEmail = normalizeEmail(session?.user?.email);
  const superUsers = getAuthorizedEmails(process.env.AUTHORIZED_EMAILS);

  if (!viewerEmail || !superUsers.includes(viewerEmail)) {
    return { redirect: { destination: "/user", permanent: false } };
  }

  const userId = getRouteUserId(context);
  if (!userId) {
    return { notFound: true };
  }

  const action = getServerAction(context, userId);
  if (action.kind === "delete") {
    const viewerUser = await prismaClient.user.findUnique({
      where: { email: viewerEmail },
      select: { id: true },
    });
    if (viewerUser?.id === action.userId) {
      return {
        redirect: {
          destination: `/link/${action.userId}?error=self-delete`,
          permanent: false,
        },
      };
    }
    await prismaClient.user.delete({ where: { id: action.userId } });
    return { redirect: { destination: "/admin", permanent: false } };
  }

  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      lastSeen: true,
    },
  });

  if (!user) {
    return { notFound: true };
  }

  const [
    cardsTotal,
    cardsStudied,
    cardsFlagged,
    deckCount,
    writingCount,
    quizResultCount,
  ] = await Promise.all([
    prismaClient.card.count({ where: { userId } }),
    prismaClient.card.count({ where: { userId, repetitions: { gt: 0 } } }),
    prismaClient.card.count({ where: { userId, flagged: true } }),
    prismaClient.deck.count({ where: { userId } }),
    prismaClient.writingSubmission.count({ where: { userId } }),
    prismaClient.quizResult.count({ where: { userId } }),
  ]);

  const recentWritingRows = await prismaClient.writingSubmission.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      prompt: true,
      createdAt: true,
      submissionCharacterCount: true,
    },
  });

  const recentQuizRows = await prismaClient.quizResult.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      createdAt: true,
      definition: true,
      userInput: true,
      isAcceptable: true,
    },
  });

  const counts: UserOverviewCounts = {
    cardsTotal,
    cardsStudied,
    cardsFlagged,
    deckCount,
    writingCount,
    quizResultCount,
  };

  const recentWriting: UserOverviewRecentWriting[] = recentWritingRows.map(
    (row) => ({
      id: row.id,
      prompt: row.prompt,
      createdAt: row.createdAt.toISOString(),
      submissionCharacterCount: row.submissionCharacterCount,
    }),
  );

  const recentQuiz: UserOverviewRecentQuiz[] = recentQuizRows.map(
    (row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      definition: row.definition,
      userInput: row.userInput,
      isAcceptable: row.isAcceptable,
    }),
  );

  return {
    props: {
      user: toUserOverviewUser(user),
      error: getErrorMessage(context),
      counts,
      recentWriting,
      recentQuiz,
    },
  };
};

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) {
    return null;
  }
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) {
    return null;
  }
  return normalized;
}

function getAuthorizedEmails(envValue: string | undefined): string[] {
  return (envValue ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.includes("@"));
}

function getRouteUserId(
  context: GetServerSidePropsContext,
): string | null {
  const value = context.params?.userID;
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return null;
}

function getServerAction(
  context: GetServerSidePropsContext,
  userId: string,
): ServerAction {
  const isDeleteRequest =
    context.req.method === "POST" && context.query.intent === "delete";

  if (!isDeleteRequest) {
    return { kind: "show" };
  }
  return { kind: "delete", userId };
}

function getErrorMessage(
  context: GetServerSidePropsContext,
): string | null {
  if (context.query.error === "self-delete") {
    return "Admins cannot delete themselves.";
  }
  return null;
}

function toUserOverviewUser(user: {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: Date;
  lastSeen: Date | null;
}): UserOverviewUser {
  return {
    id: user.id,
    email: user.email ?? "(no email)",
    name: user.name ?? null,
    createdAt: user.createdAt.toISOString(),
    lastSeen: user.lastSeen ? user.lastSeen.toISOString() : null,
  };
}

export default function UserOverviewPage(props: UserOverviewViewProps) {
  return <UserOverviewView {...props} />;
}
