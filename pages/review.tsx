import {
  decksWithReviewInfo,
  DeckWithReviewInfo,
} from "@/koala/decks/decks-with-review-info";
import { getServersideUser } from "@/koala/get-serverside-user";
import { trpc } from "@/koala/trpc-config";
import {
  Alert,
  Button,
  Container,
  Grid,
  Group,
  Text,
} from "@mantine/core";
import { IconGitMerge } from "@tabler/icons-react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next/types";
import { useCallback, useState } from "react";
import { NoDecksState } from "@/koala/review/NoDecksState";
import { ReviewDeckCard } from "@/koala/review/ReviewDeckCard";

type ReviewPageProps = {
  decks: DeckWithReviewInfo[];
};

export const getServerSideProps: GetServerSideProps<
  ReviewPageProps
> = async (context) => {
  const dbUser = await getServersideUser(context);

  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  const { backfillDecks } = await import("@/koala/decks/backfill-decks");

  await backfillDecks(dbUser.id);
  const decks = await decksWithReviewInfo(dbUser.id);

  return {
    props: {
      decks,
    },
  };
};

export default function ReviewPage({ decks }: ReviewPageProps) {
  const router = useRouter();
  const [selectedDeckIds, setSelectedDeckIds] = useState<number[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const mergeDecks = trpc.mergeDecks.useMutation({
    onSuccess: () => {
      setSelectedDeckIds([]);
      refreshData();
    },
    onError: (error) => {
      setMergeError(error.message);
    },
  });

  const refreshData = useCallback(() => {
    void router.replace(router.asPath);
  }, [router]);

  const toggleDeckSelection = useCallback((deckId: number) => {
    setSelectedDeckIds((prev) => {
      const isSelected = prev.includes(deckId);
      if (isSelected) {
        return prev.filter((id) => id !== deckId);
      }
      return [...prev, deckId];
    });
  }, []);

  const handleMergeDecks = async () => {
    if (selectedDeckIds.length < 2) {
      setMergeError("Please select at least 2 decks to merge");
      return;
    }

    setIsMerging(true);
    try {
      const firstSelectedDeck = decks.find(
        (deck) => deck.id === selectedDeckIds[0],
      );
      if (!firstSelectedDeck) {
        throw new Error("Could not find the first selected deck");
      }

      await mergeDecks.mutateAsync({
        deckIds: selectedDeckIds,
        newDeckName: `${firstSelectedDeck.name} (Merged)`,
      });

      setMergeError(null);
    } finally {
      setIsMerging(false);
    }
  };

  if (decks.length === 0) {
    return <NoDecksState />;
  }

  const sortedDecks = [...decks].sort(
    (a, b) => b.quizzesDue - a.quizzesDue,
  );
  const canMerge = selectedDeckIds.length >= 2;

  return (
    <Container size="lg" py="md">
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <Text
          style={{
            fontSize: "32px",
            fontWeight: 700,
            color: "#E64980",
            marginBottom: "8px",
          }}
        >
          Your Decks
        </Text>
        <Text style={{ fontSize: "16px", color: "#868E96" }}>
          Choose a deck to start studying
        </Text>
      </div>

      {canMerge && (
        <>
          <Group justify="center" mb="lg">
            <Button
              leftSection={<IconGitMerge size={18} />}
              color="pink"
              onClick={handleMergeDecks}
              loading={isMerging}
              radius="xl"
            >
              Merge {selectedDeckIds.length} Decks
            </Button>
          </Group>

          {mergeError && (
            <Alert
              color="red"
              title="Error"
              mb="md"
              radius="md"
              withCloseButton
              onClose={() => setMergeError(null)}
            >
              {mergeError}
            </Alert>
          )}
        </>
      )}

      <Grid gutter="xl">
        {sortedDecks.map((deck) => (
          <Grid.Col key={deck.id} span={12}>
            <ReviewDeckCard
              deck={deck}
              isSelected={selectedDeckIds.includes(deck.id)}
              onToggleSelected={toggleDeckSelection}
              onChanged={refreshData}
            />
          </Grid.Col>
        ))}
      </Grid>
    </Container>
  );
}
