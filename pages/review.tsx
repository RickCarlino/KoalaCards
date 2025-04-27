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
  Center,
  Container,
  Grid,
  Group,
  NumberInput,
  Switch,
  Text,
  TextInput,
  Title,
  useMantineTheme,
} from "@mantine/core";
import { IconCheck, IconPencil, IconTrash, IconX } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next/types";
import { useCallback, useState } from "react";

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
  const router = useRouter();

  const refreshData = () => {
    router.replace(router.asPath);
  };

  function DeckCard({ deck }: { deck: DeckWithReviewInfo }) {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(deck.name);
    const [take, setTake] = useState(21);
    const updateDeckMutation = trpc.updateDeck.useMutation();
    const deleteDeckMutation = trpc.deleteDeck.useMutation();

    const handleEdit = useCallback(() => setIsEditing(true), []);
    const handleCancel = useCallback(() => {
      setIsEditing(false);
      setTitle(deck.name);
    }, [deck.name]);

    const handleSave = useCallback(async () => {
      if (title !== deck.name && title.trim() !== "") {
        await updateDeckMutation.mutateAsync({
          deckId: deck.id,
          published: deck.published,
          name: title.trim(),
        });
        refreshData();
      }
      setIsEditing(false);
    }, [deck.id, deck.name, deck.published, title, updateDeckMutation]);

    const handleDelete = useCallback(async () => {
      if (!confirm("Are you sure you want to delete this deck?")) return;
      await deleteDeckMutation.mutateAsync({ deckId: deck.id });
      refreshData();
    }, [deck.id, deleteDeckMutation]);

    const handlePublishToggle = useCallback(
      async (event: React.ChangeEvent<HTMLInputElement>) => {
        const willPublish = event.currentTarget.checked;
        if (
          willPublish &&
          !confirm("Are you sure you want to share this deck?")
        ) {
          event.currentTarget.checked = false; // Reset the switch visually if the user cancels
          return;
        }
        await updateDeckMutation.mutateAsync({
          deckId: deck.id,
          published: willPublish,
          name: deck.name,
        });
        refreshData();
      },
      [deck.id, deck.name, updateDeckMutation],
    );

    const handleTakeChange = useCallback((value: string | number) => {
      const numValue = typeof value === "number" ? value : parseFloat(value);
      const clampedValue = Math.max(7, Math.min(45, numValue)); // Ensure value is within range 7-45
      setTake(isNaN(clampedValue) ? 21 : clampedValue);
    }, []);

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
          {!isEditing && (
            <Text fw={700} size="xl" style={{ flex: 1, textAlign: "center" }}>
              {deck.name}
            </Text>
          )}
          {isEditing && (
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              autoFocus
              variant="unstyled"
              style={{ flex: 1 }}
            />
          )}
          <Group>
            {isEditing && (
              <>
                <Button
                  variant="subtle"
                  color="green"
                  radius="xl"
                  onClick={handleSave}
                  disabled={updateDeckMutation.isLoading}
                >
                  <IconCheck size={16} />
                </Button>
                <Button
                  variant="subtle"
                  color="red"
                  radius="xl"
                  onClick={handleCancel}
                  disabled={updateDeckMutation.isLoading}
                >
                  <IconX size={16} />
                </Button>
              </>
            )}
            {!isEditing && (
              <>
                <Button
                  variant="subtle"
                  color="blue"
                  radius="xl"
                  onClick={handleEdit}
                >
                  <IconPencil size={16} />
                </Button>
                <Button
                  variant="subtle"
                  color="red"
                  radius="xl"
                  onClick={handleDelete}
                  disabled={deleteDeckMutation.isLoading}
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
              onChange={handleTakeChange}
              min={7}
              max={45}
              placeholder="Cards"
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
              Study {take} Cards
            </Button>
            <Button
              component={Link}
              href={`/writing/${deck.id}`}
              variant="outline"
              color="pink"
              radius="xl"
              size="sm"
              style={{ whiteSpace: "normal", textAlign: "center" }}
            >
              Writing Practice
            </Button>
          </Group>
        </Center>
        <Group mt="md" grow align="center">
          <Switch
            checked={deck.published}
            onChange={handlePublishToggle}
            label="Published"
            disabled={updateDeckMutation.isLoading}
          />
        </Group>
      </Card>
    );
  }

  function NoDecksMessage() {
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
            href="/start"
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

  if (decks.length === 0) {
    return <NoDecksMessage />;
  }

  const sortedDecks = [...decks].sort((a, b) => b.quizzesDue - a.quizzesDue);

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
        {sortedDecks.map((deck) => (
          <Grid.Col key={deck.id} span={12}>
            <DeckCard deck={deck} />
          </Grid.Col>
        ))}
      </Grid>
    </Container>
  );
}
