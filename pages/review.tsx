import {
  decksWithReviewInfo,
  DeckWithReviewInfo,
} from "@/koala/decks/decks-with-review-info";
import { getServersideUser } from "@/koala/get-serverside-user";
import { trpc } from "@/koala/trpc-config";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Container,
  Grid,
  Group,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconCheck,
  IconGitMerge,
  IconPencil,
  IconPlus,
  IconStars,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next/types";
import { useCallback, useState } from "react";

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
  // Blink animation styles from index.tsx
  const blinkKeyframes = `
    @keyframes blink {
      0% {
        border-color: #ffdeeb;
        box-shadow: 0 4px 12px rgba(246, 101, 149, 0);
      }
      50% {
        border-color: #f06595;
        box-shadow: 0 4px 20px rgba(246, 101, 149, 0.3);
      }
      100% {
        border-color: #ffdeeb;
        box-shadow: 0 4px 12px rgba(246, 101, 149, 0);
      }
    }
  `;

  const mergeDecks = trpc.mergeDecks.useMutation({
    onSuccess: () => {
      setSelectedDeckIds([]);
      refreshData();
    },
    onError: (error) => {
      setMergeError(error.message);
    },
  });

  const refreshData = () => {
    router.replace(router.asPath);
  };

  const handleToggleDeckSelection = (deckId: number) => {
    setSelectedDeckIds((prev) =>
      prev.includes(deckId)
        ? prev.filter((id) => id !== deckId)
        : [...prev, deckId],
    );
  };

  const handleMergeDecks = async () => {
    if (selectedDeckIds.length < 2) {
      setMergeError("Please select at least 2 decks to merge");
      return;
    }

    setIsMerging(true);
    try {
      // Find the first selected deck to use its name
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
    } catch (error) {
      console.error("Error merging decks:", error);
    } finally {
      setIsMerging(false);
    }
  };

  function DeckCard({ deck }: { deck: DeckWithReviewInfo }) {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(deck.name);
    const take = 4;
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

    return (
      <Card
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#FFF0F6",
          border: "2px solid #FFDEEB",
          borderRadius: "12px",
          padding: "16px",
          transition: "all 0.3s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow =
            "0 6px 16px rgba(246, 101, 149, 0.12)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <Card.Section
          style={{
            backgroundColor: "#FFDEEB",
            padding: "12px",
            marginBottom: "12px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Checkbox
            checked={selectedDeckIds.includes(deck.id)}
            onChange={() => handleToggleDeckSelection(deck.id)}
            size="md"
            mr="sm"
          />
          {!isEditing && (
            <Text
              fw={700}
              size="xl"
              style={{ flex: 1, textAlign: "center" }}
            >
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
          <Badge
            style={{
              backgroundColor: "#FFDEEB",
              color: "#E64980",
              border: "1px solid #FCC2D7",
              padding: "6px 12px",
              fontSize: "14px",
            }}
          >
            {deck.quizzesDue} Due
          </Badge>
          <Badge
            style={{
              backgroundColor: "#E3F2FD",
              color: "#1976D2",
              border: "1px solid #90CAF9",
              padding: "6px 12px",
              fontSize: "14px",
            }}
          >
            {deck.newQuizzes} New
          </Badge>
        </Group>
        <div style={{ marginTop: "16px" }}>
          <style>{blinkKeyframes}</style>
          <Link
            href={`/review/${deck.id}?take=${take}`}
            style={{
              textDecoration: "none",
              display: "block",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "10px 20px",
                backgroundColor: "#F06595",
                color: "white",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "16px",
                cursor: "pointer",
                transition: "all 0.3s ease",
                border: "2px solid #F06595",
                animation:
                  deck.quizzesDue > 0
                    ? "blink 2s ease-in-out infinite"
                    : undefined,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#E64980";
                e.currentTarget.style.borderColor = "#E64980";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#F06595";
                e.currentTarget.style.borderColor = "#F06595";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <IconStars size={20} stroke={2} />
              Study Cards
            </div>
          </Link>
          <Link
            href={`/writing/${deck.id}`}
            style={{ textDecoration: "none", display: "block" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "8px 16px",
                backgroundColor: "transparent",
                color: "#E64980",
                borderRadius: "8px",
                fontWeight: 500,
                fontSize: "14px",
                cursor: "pointer",
                transition: "all 0.3s ease",
                border: "1px solid #FCC2D7",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#FFDEEB";
                e.currentTarget.style.borderColor = "#F06595";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.borderColor = "#FCC2D7";
              }}
            >
              <IconPencil size={16} stroke={1.5} />
              Writing Practice
            </div>
          </Link>
        </div>
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
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <Text
            style={{
              fontSize: "32px",
              fontWeight: 700,
              color: "#E64980",
              marginBottom: "8px",
            }}
          >
            Welcome to Koala Cards 🌸
          </Text>
          <Text
            style={{
              fontSize: "16px",
              color: "#868E96",
              marginBottom: "32px",
            }}
          >
            Start your learning journey by adding some cards
          </Text>
        </div>
        <Card
          style={{
            backgroundColor: "#FFF0F6",
            border: "2px solid #FFDEEB",
            borderRadius: "12px",
            padding: "32px",
            textAlign: "center",
          }}
        >
          <Link href="/create" style={{ textDecoration: "none" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px 32px",
                backgroundColor: "#F06595",
                color: "white",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "18px",
                cursor: "pointer",
                transition: "all 0.3s ease",
                border: "2px solid #F06595",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#E64980";
                e.currentTarget.style.borderColor = "#E64980";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#F06595";
                e.currentTarget.style.borderColor = "#F06595";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <IconPlus size={24} stroke={2} />
              Add Your First Cards
            </div>
          </Link>
        </Card>
      </Container>
    );
  }

  if (decks.length === 0) {
    return <NoDecksMessage />;
  }

  const sortedDecks = [...decks].sort(
    (a, b) => b.quizzesDue - a.quizzesDue,
  );

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

      {selectedDeckIds.length >= 2 && (
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
            <DeckCard deck={deck} />
          </Grid.Col>
        ))}
      </Grid>
    </Container>
  );
}
