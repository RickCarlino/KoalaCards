import {
  decksWithReviewInfo,
  DeckWithReviewInfo,
} from "@/koala/decks/decks-with-review-info";
import { getServersideUser } from "@/koala/get-serverside-user";
import { trpc } from "@/koala/trpc-config";
import Link from "next/link";
import { GetServerSideProps } from "next/types";
import {
  Button,
  Group,
  Paper,
  Title,
  Text,
  Container,
  Card,
  Badge,
  Box,
  useMantineTheme,
} from "@mantine/core";
import { useState } from "react";

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

  return {
    props: {
      decks,
    },
  };
};

export default function ReviewPage({ decks }: ReviewPageProps) {
  const deleteDeck = trpc.deleteDeck.useMutation();
  const [showDeleteButton, setShowDeleteButton] = useState(false);
  const theme = useMantineTheme();

  if (decks.length === 0) {
    return (
      <Container size="md" py="xl">
        <Paper
          p="xl"
          radius="lg"
          shadow="sm"
          style={{
            border: `1px solid ${theme.colors.pink[1]}`,
            background: "rgba(255, 255, 255, 0.8)",
          }}
        >
          <Title
            order={1}
            mb="lg"
            style={{
              color: theme.colors.pink[6],
              textAlign: "center",
              fontWeight: 700,
            }}
          >
            Welcome! 🌸
          </Title>
          <Text ta="center" size="lg" mb="xl">
            Please add some cards to get started with your learning journey
          </Text>
          <Button
            component={Link}
            href="/create"
            color="pink"
            radius="md"
            size="lg"
            style={{
              display: "block",
              margin: "0 auto",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            }}
          >
            Add Cards
          </Button>
        </Paper>
      </Container>
    );
  }

  const sortedByDue = decks.sort((b, a) => a.quizzesDue - b.quizzesDue);

  return (
    <Container size="md" py="xl">
      <Paper
        p="xl"
        radius="lg"
        shadow="sm"
        style={{
          border: `1px solid ${theme.colors.pink[1]}`,
          background: "rgba(255, 255, 255, 0.8)",
        }}
      >
        <Title
          order={1}
          mb="lg"
          style={{
            color: theme.colors.pink[6],
            textAlign: "center",
            fontWeight: 700,
          }}
        >
          Your Decks
        </Title>

        <Button
          onClick={() => setShowDeleteButton((prev) => !prev)}
          mb="xl"
          variant={showDeleteButton ? "filled" : "outline"}
          color="pink"
          radius="md"
          style={{
            display: "block",
            margin: "0 auto 20px auto",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
          }}
        >
          {showDeleteButton ? "Cancel Deletion" : "Delete a Deck"}
        </Button>

        <Box>
          {sortedByDue.map((deck) => {
            const cardsDue = deck.quizzesDue ? `${deck.quizzesDue} due` : "";
            const cardsNew = deck.newQuizzes ? `${deck.newQuizzes} new` : "";
            const cards = [cardsDue, cardsNew].filter(Boolean).join(", ");

            return (
              <Card
                key={deck.id}
                mb="md"
                padding="md"
                radius="md"
                style={{
                  borderLeft: `4px solid ${theme.colors.pink[5]}`,
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                  },
                }}
              >
                <Group justify="space-between" align="center">
                  <Group>
                    {showDeleteButton && (
                      <Button
                        color="red"
                        size="xs"
                        variant="light"
                        radius="xl"
                        onClick={async () => {
                          if (!confirm("Are you sure?")) return;
                          await deleteDeck
                            .mutateAsync({ deckId: deck.id })
                            .then(() => window.location.reload());
                        }}
                      >
                        Delete
                      </Button>
                    )}
                    <Link
                      href={`/review/${deck.id}`}
                      style={{ textDecoration: "none" }}
                    >
                      <Text size="lg" fw={600} c={theme.colors.gray[8]}>
                        {deck.deckName}
                      </Text>
                    </Link>
                  </Group>

                  {cards && (
                    <Group gap="xs">
                      {deck.quizzesDue > 0 && (
                        <Badge
                          color="pink"
                          variant="light"
                          size="lg"
                          radius="md"
                        >
                          {deck.quizzesDue} due
                        </Badge>
                      )}
                      {deck.newQuizzes > 0 && (
                        <Badge
                          color="blue"
                          variant="light"
                          size="lg"
                          radius="md"
                        >
                          {deck.newQuizzes} new
                        </Badge>
                      )}
                    </Group>
                  )}
                </Group>
              </Card>
            );
          })}
        </Box>
      </Paper>
    </Container>
  );
}
