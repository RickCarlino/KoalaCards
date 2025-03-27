import MicrophonePermissions from "@/koala/microphone-permissions";
import { ReviewPage } from "@/koala/review/review-page";
import { trpc } from "@/koala/trpc-config";
import { Box, Container, Text, Title, Anchor } from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

function useDeckID() {
  const router = useRouter();
  const { deckId } = router.query;

  if (!deckId) {
    throw new Error("deckId is required in the URL");
  }

  return Number(deckId);
}

export default function Review() {
  const mutation = trpc.getNextQuizzes.useMutation();
  const [data, setData] = useState({
    quizzesDue: 0,
    quizzes: [],
  } as {
    quizzesDue: number;
    quizzes: any[];
  });
  const deckId = useDeckID();
  const [isFetching, setIsFetching] = useState(false);

  const fetchQuizzes = () => {
    setIsFetching(true);
    // Get the "take" param from the URL using NextJS router.
    const take = Math.min(
      parseInt(new URLSearchParams(window.location.search).get("take") || "21"),
      44,
    );
    mutation
      .mutateAsync({ take, deckId }, { onSuccess: (data) => setData(data) })
      .finally(() => setIsFetching(false));
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const onSave = async () => {
    // Called by child component when it wants more quizzes.
    fetchQuizzes();
  };

  let el;

  if (mutation.isError) {
    el = (
      <Container size="md" py="xl">
        <Box p="md">
          <Title order={3} mb="md">
            Error
          </Title>
          <Text>{mutation.error.message}</Text>
        </Box>
      </Container>
    );
  } else if (isFetching) {
    el = (
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
  } else if (data.quizzes.length > 0) {
    el = (
      <ReviewPage
        quizzesDue={data.quizzesDue}
        quizzes={data.quizzes}
        onSave={onSave}
      />
    );
  } else {
    el = (
      <Container size="md" py="xl">
        <Box p="md">
          <Title order={3} mb="md">
            No Quizzes Available
          </Title>
          <Text mb="md">No quizzes found for this deck. You can:</Text>
          <Box mb="xs">
            <Anchor component={Link} href="/cards">
              Add more cards to this deck
            </Anchor>
          </Box>
          <Box>
            <Anchor component={Link} href="/">
              Go back to deck overview
            </Anchor>
          </Box>
        </Box>
      </Container>
    );
  }

  return MicrophonePermissions(el);
}
