import { DECK_DESCRIPTION_MAX_LENGTH } from "@/koala/decks/constants";
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
  Text,
  TextInput,
  Textarea,
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

const STUDY_TAKE_COUNT = 5;
const BLINK_KEYFRAMES = `
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

type DeckTitleFieldProps = {
  isEditing: boolean;
  title: string;
  deckName: string;
  onChange: (value: string) => void;
};

function DeckTitleField({
  isEditing,
  title,
  deckName,
  onChange,
}: DeckTitleFieldProps) {
  if (isEditing) {
    return (
      <TextInput
        value={title}
        onChange={(e) => onChange(e.currentTarget.value)}
        autoFocus
        variant="unstyled"
        style={{ flex: 1 }}
      />
    );
  }

  return (
    <Text fw={700} size="xl" style={{ flex: 1, textAlign: "center" }}>
      {deckName}
    </Text>
  );
}

type DeckActionButtonsProps = {
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
};

function DeckActionButtons({
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  isSaving,
  isDeleting,
}: DeckActionButtonsProps) {
  if (isEditing) {
    return (
      <Group>
        <Button
          variant="subtle"
          color="green"
          radius="xl"
          onClick={onSave}
          disabled={isSaving}
        >
          <IconCheck size={16} />
        </Button>
        <Button
          variant="subtle"
          color="red"
          radius="xl"
          onClick={onCancel}
          disabled={isSaving}
        >
          <IconX size={16} />
        </Button>
      </Group>
    );
  }

  return (
    <Group>
      <Button variant="subtle" color="blue" radius="xl" onClick={onEdit}>
        <IconPencil size={16} />
      </Button>
      <Button
        variant="subtle"
        color="red"
        radius="xl"
        onClick={onDelete}
        disabled={isDeleting}
      >
        <IconTrash size={16} />
      </Button>
    </Group>
  );
}

type DeckCardHeaderProps = {
  isSelected: boolean;
  onToggleSelected: () => void;
  isEditing: boolean;
  title: string;
  deckName: string;
  onTitleChange: (value: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
};

function DeckCardHeader({
  isSelected,
  onToggleSelected,
  isEditing,
  title,
  deckName,
  onTitleChange,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  isSaving,
  isDeleting,
}: DeckCardHeaderProps) {
  return (
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
        checked={isSelected}
        onChange={onToggleSelected}
        size="md"
        mr="sm"
      />
      <DeckTitleField
        isEditing={isEditing}
        title={title}
        deckName={deckName}
        onChange={onTitleChange}
      />
      <DeckActionButtons
        isEditing={isEditing}
        onEdit={onEdit}
        onSave={onSave}
        onCancel={onCancel}
        onDelete={onDelete}
        isSaving={isSaving}
        isDeleting={isDeleting}
      />
    </Card.Section>
  );
}

type DeckDescriptionFieldProps = {
  isEditing: boolean;
  description: string;
  onChange: (value: string) => void;
};

function DeckDescriptionField({
  isEditing,
  description,
  onChange,
}: DeckDescriptionFieldProps) {
  const trimmedDescription = description.trim();
  const hasDescription = trimmedDescription.length > 0;

  if (isEditing) {
    return (
      <div style={{ marginTop: "8px" }}>
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => onChange(e.currentTarget.value)}
          autosize
          minRows={2}
          maxRows={4}
          maxLength={DECK_DESCRIPTION_MAX_LENGTH}
        />
        <Text
          size="xs"
          c="dimmed"
          style={{ textAlign: "right", marginTop: "4px" }}
        >
          {description.length}/{DECK_DESCRIPTION_MAX_LENGTH} characters
        </Text>
      </div>
    );
  }

  if (!hasDescription) {
    return null;
  }

  return (
    <Text size="sm" mt="sm">
      {trimmedDescription}
    </Text>
  );
}

type DeckStatsProps = {
  quizzesDue: number;
  newQuizzes: number;
};

function DeckStats({ quizzesDue, newQuizzes }: DeckStatsProps) {
  return (
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
        {quizzesDue} Due
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
        {newQuizzes} New
      </Badge>
    </Group>
  );
}

type DeckLinksProps = {
  deckId: number;
  quizzesDue: number;
};

function DeckLinks({ deckId, quizzesDue }: DeckLinksProps) {
  const shouldBlink = quizzesDue > 0;
  const blinkAnimation = shouldBlink
    ? "blink 2s ease-in-out infinite"
    : undefined;

  return (
    <div style={{ marginTop: "16px" }}>
      <style>{BLINK_KEYFRAMES}</style>
      <Link
        href={`/review/${deckId}?take=${STUDY_TAKE_COUNT}`}
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
            animation: blinkAnimation,
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
    </div>
  );
}

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

  function DeckCard({ deck }: { deck: DeckWithReviewInfo }) {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(deck.name);
    const [description, setDescription] = useState(deck.description ?? "");
    const updateDeckMutation = trpc.updateDeck.useMutation();
    const deleteDeckMutation = trpc.deleteDeck.useMutation();
    const isSelected = selectedDeckIds.includes(deck.id);

    const handleEdit = useCallback(() => setIsEditing(true), []);
    const handleCancel = useCallback(() => {
      setIsEditing(false);
      setTitle(deck.name);
      setDescription(deck.description ?? "");
    }, [deck.description, deck.name]);

    const handleSave = useCallback(async () => {
      const trimmedTitle = title.trim();
      const normalizedTitle = trimmedTitle || deck.name;
      const normalizedDescription = description.trim();
      const descriptionValue =
        normalizedDescription.length > 0 ? normalizedDescription : null;
      const nameChanged = normalizedTitle !== deck.name;
      const descriptionChanged =
        descriptionValue !== (deck.description ?? null);
      if (nameChanged || descriptionChanged) {
        await updateDeckMutation.mutateAsync({
          deckId: deck.id,
          name: normalizedTitle,
          description: descriptionValue,
        });
        refreshData();
      }
      setTitle(normalizedTitle);
      setDescription(descriptionValue ?? "");
      setIsEditing(false);
    }, [
      deck.description,
      deck.id,
      deck.name,
      description,
      title,
      updateDeckMutation,
    ]);

    const handleDelete = useCallback(async () => {
      if (!confirm("Are you sure you want to delete this deck?")) {
        return;
      }
      await deleteDeckMutation.mutateAsync({ deckId: deck.id });
      refreshData();
    }, [deck.id, deleteDeckMutation]);

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
        <DeckCardHeader
          isSelected={isSelected}
          onToggleSelected={() => handleToggleDeckSelection(deck.id)}
          isEditing={isEditing}
          title={title}
          deckName={deck.name}
          onTitleChange={setTitle}
          onEdit={handleEdit}
          onSave={handleSave}
          onCancel={handleCancel}
          onDelete={handleDelete}
          isSaving={updateDeckMutation.isLoading}
          isDeleting={deleteDeckMutation.isLoading}
        />
        <DeckDescriptionField
          isEditing={isEditing}
          description={description}
          onChange={setDescription}
        />
        <DeckStats
          quizzesDue={deck.quizzesDue}
          newQuizzes={deck.newQuizzes}
        />
        <DeckLinks deckId={deck.id} quizzesDue={deck.quizzesDue} />
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
