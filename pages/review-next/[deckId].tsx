import { trpc } from "@/koala/trpc-config";
import { Box, Container, Text, Title, Table, Anchor } from "@mantine/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GetServerSideProps, GetServerSidePropsResult } from "next";
import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { ParsedUrlQuery } from "querystring";
import { Quiz } from "@/koala/review/types";
import { uid } from "radash";

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
  _langCode: string,
  _userId: string,
): Promise<ServerSideResult> => {
  return { redirect: { destination: "/review", permanent: false } };
};

export const getServerSideProps: GetServerSideProps<
  ReviewDeckPageProps | {}
> = async (context) => {
  const dbUser = await getServersideUser(context);

  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
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
  quizzes: Quiz[];
};

const LoadingState = () => (
  <Container size="md" py="xl">
    <Box p="md">
      <Title order={3} mb="md">
        Loading
      </Title>
      <Text>
        Fetching Quizzes. This could take a while for new cards...
      </Text>
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
      <Box mb="xs">
        <Anchor component={Link} href={`/writing/${deckId}`}>
          Practice Writing
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

export default function ReviewNext({ deckId }: ReviewDeckPageProps) {
  const mutation = trpc.getNextQuizzes.useMutation();
  const [data, setData] = useState<QuizData>({
    quizzesDue: 0,
    quizzes: [],
  });
  const [isFetching, setIsFetching] = useState(true);

  const fetchQuizzes = (currentDeckId: number) => {
    setIsFetching(true);
    const takeParam = new URLSearchParams(window.location.search).get(
      "take",
    );
    const take = Math.min(parseInt(takeParam || "21", 10), 44);

    mutation
      .mutateAsync(
        { take, deckId: currentDeckId },
        {
          onSuccess: (fetchedData) => {
            const withUUID = fetchedData.quizzes.map((q) => ({
              ...q,
              uuid: uid(8),
            }));
            setData({
              quizzesDue: fetchedData.quizzesDue,
              quizzes: withUUID,
            });
          },
        },
      )
      .finally(() => setIsFetching(false));
  };

  useEffect(() => {
    if (deckId) {
      fetchQuizzes(deckId);
    }
  }, [deckId]);

  if (mutation.isError) {
    return <ErrorState message={mutation.error.message} />;
  }

  if (isFetching) {
    return <LoadingState />;
  }

  if (data.quizzes.length === 0) {
    return <NoQuizzesState deckId={deckId} />;
  }

  return (
    <Container size="xl" py="md">
      <Box p="md">
        <Title order={3} mb="md">
          Reviews ({data.quizzesDue} due)
        </Title>

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Term</Table.Th>
              <Table.Th>Definition</Table.Th>
              <Table.Th>Lesson Type</Table.Th>
              <Table.Th>Repetitions</Table.Th>
              <Table.Th>Stability</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.quizzes.map((quiz) => (
              <Table.Tr key={quiz.uuid}>
                <Table.Td>{quiz.term}</Table.Td>
                <Table.Td>{quiz.definition}</Table.Td>
                <Table.Td>{quiz.lessonType}</Table.Td>
                <Table.Td>{quiz.repetitions}</Table.Td>
                <Table.Td>{quiz.stability.toFixed(2)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Box mt="lg">
          <Anchor component={Link} href="/review">
            Back to Review Dashboard
          </Anchor>
        </Box>
      </Box>
    </Container>
  );
}
