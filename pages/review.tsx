import {
  decksWithReviewInfo,
  DeckWithReviewInfo,
} from "@/koala/decks/decks-with-review-info";
import { getServersideUser } from "@/koala/get-serverside-user";
import { trpc } from "@/koala/trpc-config";
import {
  Badge,
  Button,
  Card,
  Container,
  Grid,
  Group,
  Switch,
  Text,
  TextInput,
  Title,
  useMantineTheme,
  Center,
  NumberInput
} from "@mantine/core";
import { IconPencil, IconCheck, IconX, IconTrash } from "@tabler/icons-react";
import Link from "next/link";
import { GetServerSideProps } from "next/types";
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
  const theme = useMantineTheme();

  function DeckCard({ deck }: { deck: DeckWithReviewInfo }) {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(deck.name);
    const [take, setTake] = useState(21);
    const updateDeckMutation = trpc.updateDeck.useMutation();
    const deleteDeckMutation = trpc.deleteDeck.useMutation();

    return (
      <Card
        shadow="md"
        padding="md"
        radius="lg"
        withBorder
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <Card.Section
          style={{
            backgroundColor: theme.colors.pink[0],
            padding: theme.spacing.md,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {isEditing ? (
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              autoFocus
              variant="unstyled"
              style={{ flex: 1 }}
            />
          ) : (
            <Text fw={700} size="xl" style={{ flex: 1, textAlign: "center" }}>
              {deck.name}
            </Text>
          )}
          <Group>
            {isEditing ? (
              <>
                <Button
                  variant="subtle"
                  color="green"
                  radius="xl"
                  onClick={async () => {
                    if (title !== deck.name && title.trim() !== "") {
                      await updateDeckMutation.mutateAsync({
                        deckId: deck.id,
                        published: deck.published,
                        name: title,
                      });
                    }
                    setIsEditing(false);
                    window.location.reload();
                  }}
                >
                  <IconCheck size={16} />
                </Button>
                <Button
                  variant="subtle"
                  color="red"
                  radius="xl"
                  onClick={() => {
                    setIsEditing(false);
                    setTitle(deck.name);
                  }}
                >
                  <IconX size={16} />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="subtle"
                  color="blue"
                  radius="xl"
                  onClick={() => setIsEditing(true)}
                >
                  <IconPencil size={16} />
                </Button>
                <Button
                  variant="subtle"
                  color="red"
                  radius="xl"
                  onClick={async () => {
                    if (!confirm("Are you sure you want to delete this deck?"))
                      return;
                    await deleteDeckMutation.mutateAsync({ deckId: deck.id });
                    window.location.reload();
                  }}
                >
                  <IconTrash size={16} />
                </Button>
              </>
            )}
          </Group>
        </Card.Section>
        <Group justify="apart" mt="md">
          <Badge color="pink" variant="light" size="lg">
            {deck.quizzesDue} Due
          </Badge>
          <Badge color="blue" variant="light" size="lg">
            {deck.newQuizzes} New
          </Badge>
        </Group>
        <Center mt="md" style={{ width: "100%" }}>
          <Group>
            <NumberInput
              value={take}
              onChange={(value) => {
                if (typeof value === "number") {
                  setTake(value);
                } else {
                  const n = parseFloat(value);
                  setTake(isNaN(n) ? 21 : n);
                }
              }}
              min={1}
              placeholder="Take"
              size="sm"
              variant="filled"
              style={{ width: 80 }}
            />
            <Button
              component={Link}
              href={`/review/${deck.id}?take=${take}`}
              variant="filled"
              color="gray"
              radius="xl"
              size="sm"
              style={{ whiteSpace: "normal", textAlign: "center" }}
            >
              Study
            </Button>
          </Group>
        </Center>
        <Group mt="md" grow align="center">
          <Switch
            checked={deck.published}
            onChange={async (event) => {
              const willPublish = event.currentTarget.checked;
              if (
                willPublish &&
                !confirm("Are you sure you want to share this deck?")
              ) {
                return;
              }
              await updateDeckMutation.mutateAsync({
                deckId: deck.id,
                published: event.currentTarget.checked,
                name: deck.name,
              });
              window.location.reload();
            }}
            label="Published"
          />
        </Group>
      </Card>
    );
  }

  if (decks.length === 0) {
    return (
      <Container size="md" py="xl">
        <Card
          shadow="md"
          padding="xl"
          radius="lg"
          withBorder
          style={{
            background: "rgba(255, 255, 255, 0.9)",
            border: `2px solid ${theme.colors.pink[3]}`,
          }}
        >
          <Title
            order={1}
            mb="lg"
            style={{ textAlign: "center", color: theme.colors.pink[6] }}
          >
            Welcome to Koala Cards 🌸
          </Title>
          <Text size="lg" mb="xl" style={{ textAlign: "center" }}>
            Start your learning journey by adding some cards. Your progress
            starts here!
          </Text>
          <Button
            component={Link}
            href="/create"
            color="pink"
            radius="xl"
            size="lg"
            fullWidth
          >
            Add Cards
          </Button>
        </Card>
      </Container>
    );
  }

  const sortedByDue = decks.sort((b, a) => a.quizzesDue - b.quizzesDue);

  return (
    <Container size="lg" py="md">
      <Title
        order={2}
        mt="md"
        mb="lg"
        style={{ textAlign: "center", color: theme.colors.pink[6] }}
      >
        Your Decks
      </Title>
      <Grid gutter="xl">
        {sortedByDue.map((deck) => (
          <Grid.Col key={deck.id} span={12}>
            <DeckCard deck={deck} />
          </Grid.Col>
        ))}
      </Grid>
    </Container>
  );
}
