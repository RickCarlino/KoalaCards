import MicrophonePermissions from "@/koala/microphone-permissions";
import { ReviewPage } from "@/koala/review/review-page";
import { trpc } from "@/koala/trpc-config";
import { Box, Container, Text, Title, Anchor } from "@mantine/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GetServerSideProps, GetServerSidePropsResult } from "next";
import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { decksWithReviewInfo } from "@/koala/decks/decks-with-review-info";
import { ParsedUrlQuery } from "querystring";

type ReviewDeckPageProps = {
  deckId: number;
};

type ServerSideResult = GetServerSidePropsResult<ReviewDeckPageProps | {}>;

const handleNumericDeckId = async (
  numericDeckId: number,
  userId: string,
): Promise<ServerSideResult> => {
  const deck = await prismaClient.deck.findUnique({
    where: { id: numericDeckId },
    select: { userId: true },
  });

  if (!deck || deck.userId !== userId) {
    return { redirect: { destination: "/review", permanent: false } };
  }

  return { props: { deckId: numericDeckId } };
};

const handleLanguageCode = async (
  langCode: string,
  userId: string,
): Promise<ServerSideResult> => {
  const allUserDecks = await prismaClient.deck.findMany({
    where: { userId },
    select: { id: true, langCode: true },
  });
  const deckIdToLangCodeMap = new Map(
    allUserDecks.map((d) => [d.id, d.langCode]),
  );

  const decksInfo = await decksWithReviewInfo(userId);

  const languageDecksInfo = decksInfo
    .map((info) => ({
      ...info,
      langCode: deckIdToLangCodeMap.get(info.id),
    }))
    .filter((info) => info.langCode === langCode && info.quizzesDue > 0);

  if (languageDecksInfo.length > 0) {
    languageDecksInfo.sort((a, b) => b.quizzesDue - a.quizzesDue);
    const bestDeck = languageDecksInfo[0];
    return {
      redirect: { destination: `/review/${bestDeck.id}`, permanent: false },
    };
  } else {
    return { redirect: { destination: "/review", permanent: false } };
  }
};

export const getServerSideProps: GetServerSideProps<
  ReviewDeckPageProps | {}
> = async (context) => {
  const dbUser = await getServersideUser(context);

  if (!dbUser) {
    return { redirect: { destination: "/api/auth/signin", permanent: false } };
  }

  const { deckId: deckIdParam } = context.params as ParsedUrlQuery;
  if (!deckIdParam || typeof deckIdParam !== "string") {
    return { redirect: { destination: "/review", permanent: false } };
  }

  const isNumeric = /^\d+$/.test(deckIdParam);

  if (isNumeric) {
    return handleNumericDeckId(parseInt(deckIdParam, 10), dbUser.id);
  } else {
    return handleLanguageCode(deckIdParam, dbUser.id);
  }
};

type QuizData = {
  quizzesDue: number;
  quizzes: any[];
};

const LoadingState = () => (
  <Container size="md" py="xl">
    <Box p="md">
      <Title order={3} mb="md">
        Loading
      </Title>
      <Text>Fetching Quizzes. This could take a while for new cards...</Text>
    </Box>
  </Container>
);

const ErrorState = ({ message }: { message: string }) => (
  <Container size="md" py="xl">
    <Box p="md">
      <Title order={3} mb="md">
        Error
      </Title>
      <Text>{message}</Text>
    </Box>
  </Container>
);

const NoQuizzesState = ({ deckId }: { deckId: number }) => (
  <Container size="md" py="xl">
    <Box p="md">
      <Title order={3} mb="md">
        No More Quizzes Available
      </Title>
      <Text mb="md">
        You've reviewed all available quizzes for this session. You can:
      </Text>
      <Box mb="xs">
        <Anchor component={Link} href={`/cards?deckId=${deckId}`}>
          Add more cards to this deck
        </Anchor>
      </Box>
      <Box>
        <Anchor component={Link} href="/review">
          Go back to deck selection
        </Anchor>
      </Box>
    </Box>
  </Container>
);

export default function Review({ deckId }: ReviewDeckPageProps) {
  const mutation = trpc.getNextQuizzes.useMutation();
  const [data, setData] = useState<QuizData>({ quizzesDue: 0, quizzes: [] });
  const [isFetching, setIsFetching] = useState(true);

  const fetchQuizzes = (currentDeckId: number) => {
    setIsFetching(true);
    const takeParam = new URLSearchParams(window.location.search).get("take");
    const take = Math.min(parseInt(takeParam || "21", 10), 44);

    mutation
      .mutateAsync(
        { take, deckId: currentDeckId },
        { onSuccess: (fetchedData) => setData(fetchedData) },
      )
      .finally(() => setIsFetching(false));
  };

  useEffect(() => {
    if (deckId) {
      fetchQuizzes(deckId);
    }
  }, [deckId]);

  const handleSave = async () => {
    fetchQuizzes(deckId);
  };

  if (mutation.isError) {
    return MicrophonePermissions(
      <ErrorState message={mutation.error.message} />,
    );
  }

  if (isFetching) {
    return MicrophonePermissions(<LoadingState />);
  }

  if (data.quizzes.length > 0) {
    return MicrophonePermissions(
      <ReviewPage
        quizzesDue={data.quizzesDue}
        quizzes={data.quizzes}
        onSave={handleSave}
      />,
    );
  }

  return MicrophonePermissions(<NoQuizzesState deckId={deckId} />);
}
